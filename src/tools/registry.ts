// ─────────────────────────────────────────────────────────
// tools/registry.ts — Central tool registry (OpenAI format)
// ─────────────────────────────────────────────────────────
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions.js";

/** Shape every tool must export */
export interface ToolDefinition {
    /** OpenAI-format function tool schema */
    schema: ChatCompletionFunctionTool;
    /** Execute the tool and return a string result */
    execute: (input: Record<string, unknown>) => Promise<string>;
}

/** All registered tools, keyed by function name */
const tools = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
    tools.set(def.schema.function.name, def);
}

export function getToolSchemas(): ChatCompletionFunctionTool[] {
    return [...tools.values()].map((t) => t.schema);
}

export function getTool(name: string): ToolDefinition | undefined {
    return tools.get(name);
}
