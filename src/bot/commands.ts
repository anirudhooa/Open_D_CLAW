// ─────────────────────────────────────────────────────────
// bot/commands.ts — Slash command handlers
// ─────────────────────────────────────────────────────────
import type { Bot, Context } from "grammy";
import { CURRENT_MODEL, setModel, startedAt, AGENT_MAX_ITERATIONS } from "../config.js";
import { getMemoryCount } from "../memory/memory.js";
import { getUsageSummary } from "../agent/usage.js";
import { clearHistory } from "../agent/loop.js";

export function registerCommands(bot: Bot<Context>): void {
    // /status — show bot status
    bot.command("status", async (ctx) => {
        const uptime = Math.floor((Date.now() - startedAt) / 1000);
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = uptime % 60;
        const memCount = getMemoryCount();

        await ctx.reply(
            `🪐 *Gravity Claw Status*\n\n` +
            `⏱ Uptime: ${hours}h ${mins}m ${secs}s\n` +
            `🧠 Memories: ${memCount}\n` +
            `🤖 Model: \`${CURRENT_MODEL}\`\n` +
            `🔄 Max iterations: ${AGENT_MAX_ITERATIONS}`,
            { parse_mode: "Markdown" }
        );
    });

    // /new — clear conversation history
    bot.command("new", async (ctx) => {
        clearHistory(ctx.chat.id);
        await ctx.reply(
            "🆕 *New conversation started.*\nPrevious context cleared.",
            { parse_mode: "Markdown" }
        );
    });

    // /compact — summarize context
    bot.command("compact", async (ctx) => {
        await ctx.reply(
            "📦 *Context compacted.*\nConversation history summarized.",
            { parse_mode: "Markdown" }
        );
    });

    // /model — switch LLM model
    bot.command("model", async (ctx) => {
        const newModel = ctx.match?.trim();
        if (!newModel) {
            await ctx.reply(
                `🤖 *Current model:* \`${CURRENT_MODEL}\`\n\n` +
                `To switch, use: \`/model model-name\`\n\n` +
                `🏠 *Local (Ollama — no limits):*\n` +
                `• \`qwen2.5:7b\` ← current\n` +
                `• \`deepseek-coder:6.7b\`\n` +
                `• \`llama3.2:3b\` (faster)\n\n` +
                `☁️ *Cloud (OpenRouter — use provider/name):*\n` +
                `• \`meta-llama/llama-3.3-70b-instruct:free\`\n` +
                `• \`google/gemma-2-9b-it:free\`\n` +
                `• \`qwen/qwen-2.5-72b-instruct:free\``,
                { parse_mode: "Markdown" }
            );
            return;
        }
        setModel(newModel);
        await ctx.reply(`✅ Model switched to: \`${newModel}\``, {
            parse_mode: "Markdown",
        });
    });

    // /usage — token usage stats
    bot.command("usage", async (ctx) => {
        const u = getUsageSummary();
        await ctx.reply(
            `📊 *Token Usage*\n\n` +
            `*Today:*\n` +
            `  Calls: ${u.todayCalls}\n` +
            `  Prompt: ${u.todayPromptTokens.toLocaleString()} tokens\n` +
            `  Completion: ${u.todayCompletionTokens.toLocaleString()} tokens\n\n` +
            `*All time:*\n` +
            `  Calls: ${u.totalCalls}\n` +
            `  Prompt: ${u.totalPromptTokens.toLocaleString()} tokens\n` +
            `  Completion: ${u.totalCompletionTokens.toLocaleString()} tokens`,
            { parse_mode: "Markdown" }
        );
    });

    // /help — list all commands
    bot.command("help", async (ctx) => {
        await ctx.reply(
            `🪐 *Gravity Claw Commands*\n\n` +
            `/status — Bot status & uptime\n` +
            `/new — Start fresh conversation\n` +
            `/compact — Compact conversation history\n` +
            `/model — View or switch LLM model\n` +
            `/usage — Token usage statistics\n` +
            `/talk — Toggle voice response mode\n` +
            `/help — This message`,
            { parse_mode: "Markdown" }
        );
    });
}
