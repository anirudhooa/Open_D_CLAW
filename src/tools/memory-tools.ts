// ─────────────────────────────────────────────────────────
// tools/memory-tools.ts — Memory tools for the agent
// ─────────────────────────────────────────────────────────
import { registerTool } from "./registry.js";
import {
    saveMemory,
    searchMemories,
    listMemories,
    deleteMemory,
} from "../memory/memory.js";

// ── save_memory ──────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "save_memory",
            description:
                "Save a piece of information to long-term memory. Use this to remember facts, preferences, instructions, or anything the user wants you to remember across conversations.",
            parameters: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "The information to remember.",
                    },
                    category: {
                        type: "string",
                        description:
                            'Category for the memory, e.g. "preference", "fact", "instruction", "person", "project". Defaults to "general".',
                    },
                },
                required: ["content"],
            },
        },
    },
    async execute(input) {
        const content = input.content as string;
        const category = (input.category as string) || "general";
        const mem = saveMemory(content, category);
        return `✅ Memory saved (ID: ${mem.id}, category: ${mem.category})`;
    },
});

// ── search_memories ──────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "search_memories",
            description:
                "Search long-term memory for relevant information. Uses full-text search to find matching memories.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Search query to find relevant memories.",
                    },
                    limit: {
                        type: "number",
                        description: "Maximum results to return (default: 5).",
                    },
                },
                required: ["query"],
            },
        },
    },
    async execute(input) {
        const query = input.query as string;
        const limit = (input.limit as number) || 5;
        const results = searchMemories(query, limit);
        if (results.length === 0) return "No memories found matching that query.";
        return results
            .map(
                (m) =>
                    `[${m.id}] (${m.category}) ${m.content} — accessed ${m.access_count}x`
            )
            .join("\n");
    },
});

// ── list_memories ────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "list_memories",
            description:
                "List stored memories, optionally filtered by category.",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description: "Filter by category. Omit to list all.",
                    },
                    limit: {
                        type: "number",
                        description: "Max results (default: 20).",
                    },
                },
                required: [],
            },
        },
    },
    async execute(input) {
        const category = input.category as string | undefined;
        const limit = (input.limit as number) || 20;
        const results = listMemories(category, limit);
        if (results.length === 0) return "No memories stored yet.";
        return results
            .map((m) => `[${m.id}] (${m.category}) ${m.content}`)
            .join("\n");
    },
});

// ── delete_memory ────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "delete_memory",
            description: "Delete a specific memory by its ID.",
            parameters: {
                type: "object",
                properties: {
                    id: {
                        type: "number",
                        description: "The memory ID to delete.",
                    },
                },
                required: ["id"],
            },
        },
    },
    async execute(input) {
        const id = input.id as number;
        const success = deleteMemory(id);
        return success
            ? `✅ Memory ${id} deleted.`
            : `❌ Memory ${id} not found.`;
    },
});
