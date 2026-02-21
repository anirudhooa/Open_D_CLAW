// ─────────────────────────────────────────────────────────
// agent/loop.ts — Agentic tool-use loop (OpenRouter + Ollama)
// ─────────────────────────────────────────────────────────
import OpenAI from "openai";
import type {
    ChatCompletionMessageParam,
    ChatCompletionMessageFunctionToolCall,
} from "openai/resources/chat/completions.js";
import { OPENROUTER_API_KEY, AGENT_MAX_ITERATIONS, CURRENT_MODEL } from "../config.js";
import { getToolSchemas, getTool } from "../tools/registry.js";
import { getRelevantMemories } from "../memory/memory.js";
import { logUsage } from "./usage.js";

// ── Two LLM clients: OpenRouter (cloud) + Ollama (local) ─
const openRouterClient = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY,
});

const ollamaClient = new OpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama",
});

/** Pick the right client based on model name */
function getClient(): OpenAI {
    if (!CURRENT_MODEL.includes("/")) {
        return ollamaClient;
    }
    return openRouterClient;
}

const BASE_SYSTEM_PROMPT = `You are Gravity Claw — a helpful, concise personal AI assistant.

Rules:
- ALWAYS respond in English. Never use any other language.
- Be direct. Avoid filler.
- When you don't know something, say so honestly.
- Use the tools provided when they're relevant; don't guess facts you can look up.
- Keep responses short unless the user asks for detail.
- Never reveal API keys, tokens, or other secrets.
- You are running locally on the user's machine. Respect their privacy.
- When the user tells you to remember something, use the save_memory tool.
- You can search your memories to recall information from past conversations.`;

// ── Conversation history per chat (keyed by chatId) ───────
const MAX_HISTORY = 20; // Keep last 20 messages per chat
const chatHistories = new Map<number, ChatCompletionMessageParam[]>();

/** Get or create conversation history for a chat */
function getHistory(chatId: number): ChatCompletionMessageParam[] {
    if (!chatHistories.has(chatId)) {
        chatHistories.set(chatId, []);
    }
    return chatHistories.get(chatId)!;
}

/** Clear history for a chat (used by /new command) */
export function clearHistory(chatId: number): void {
    chatHistories.delete(chatId);
}

/** Trim history to keep it under the limit */
function trimHistory(history: ChatCompletionMessageParam[]): void {
    // Keep only user + assistant messages (skip tool messages for trimming count)
    while (history.length > MAX_HISTORY * 2) {
        history.shift();
    }
}

/** Sleep helper for retries */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call LLM with retry on rate limits */
async function callWithRetry(
    llmClient: OpenAI,
    params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    maxRetries = 3
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await llmClient.chat.completions.create(params);
        } catch (err: unknown) {
            const error = err as { status?: number; message?: string };

            if (
                (error.status === 429 || error.status === 502 || error.status === 503) &&
                attempt < maxRetries
            ) {
                const waitSec = Math.pow(2, attempt + 1);
                console.log(`  ⏳ Rate limited (${error.status}), retrying in ${waitSec}s… (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(waitSec * 1000);
                continue;
            }

            throw err;
        }
    }
    throw new Error("Max retries exceeded");
}

/**
 * Run the agentic loop: send message → handle tool calls → repeat
 * until the LLM produces a final text response or we hit the safety limit.
 * Now maintains per-chat conversation history.
 */
export async function runAgentLoop(userMessage: string, chatId = 0): Promise<string> {
    const tools = getToolSchemas();
    const client = getClient();

    // Build system prompt with relevant memories
    let systemPrompt = BASE_SYSTEM_PROMPT;
    const memories = getRelevantMemories(userMessage);
    if (memories.length > 0) {
        const memBlock = memories
            .map((m) => `- [${m.category}] ${m.content}`)
            .join("\n");
        systemPrompt += `\n\nRelevant memories:\n${memBlock}`;
    }

    // Get conversation history for this chat
    const history = getHistory(chatId);

    // Add the new user message to history
    history.push({ role: "user", content: userMessage });
    trimHistory(history);

    // Build full message list: system + history
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history,
    ];

    for (let i = 0; i < AGENT_MAX_ITERATIONS; i++) {
        const response = await callWithRetry(client, {
            model: CURRENT_MODEL,
            max_tokens: 1024,
            tools,
            messages,
        });

        // Track usage
        if (response.usage) {
            logUsage(
                CURRENT_MODEL,
                response.usage.prompt_tokens ?? 0,
                response.usage.completion_tokens ?? 0
            );
        }

        const choice = response.choices[0];
        if (!choice) {
            return "(No response from model)";
        }

        const assistantMessage = choice.message;
        messages.push(assistantMessage);

        if (
            !assistantMessage.tool_calls ||
            assistantMessage.tool_calls.length === 0
        ) {
            const reply = assistantMessage.content || "(No response)";
            // Save assistant reply to history
            history.push({ role: "assistant", content: reply });
            trimHistory(history);
            return reply;
        }

        for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.type !== "function") continue;
            const fnCall = toolCall as ChatCompletionMessageFunctionToolCall;

            const fnName = fnCall.function.name;
            const tool = getTool(fnName);
            let result: string;

            if (!tool) {
                result = `Error: unknown tool "${fnName}"`;
                console.warn(`⚠️  Unknown tool requested: ${fnName}`);
            } else {
                try {
                    console.log(`  🔧 Running tool: ${fnName}`);
                    const args = JSON.parse(fnCall.function.arguments || "{}");
                    result = await tool.execute(args);
                } catch (err) {
                    result = `Error executing ${fnName}: ${err instanceof Error ? err.message : String(err)}`;
                    console.error(`  ❌ Tool error: ${result}`);
                }
            }

            messages.push({
                role: "tool",
                tool_call_id: fnCall.id,
                content: result,
            });
        }

        if (choice.finish_reason === "stop") {
            const reply = assistantMessage.content || "(No response)";
            history.push({ role: "assistant", content: reply });
            trimHistory(history);
            return reply;
        }
    }

    return "⚠️ Reached the maximum number of tool iterations. Stopping for safety.";
}
