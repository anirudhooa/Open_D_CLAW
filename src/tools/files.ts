// ─────────────────────────────────────────────────────────
// tools/files.ts — File system tools
// ─────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { registerTool } from "./registry.js";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_OUTPUT = 4000;

// ── read_file ────────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "read_file",
            description: "Read the contents of a file. Limited to 1 MB.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Absolute or relative file path." },
                },
                required: ["path"],
            },
        },
    },
    async execute(input) {
        const filePath = input.path as string;
        try {
            const stat = fs.statSync(filePath);
            if (stat.size > MAX_FILE_SIZE) {
                return `File too large (${(stat.size / 1024).toFixed(0)} KB). Max: 1 MB.`;
            }
            let content = fs.readFileSync(filePath, "utf-8");
            if (content.length > MAX_OUTPUT) {
                content = content.slice(0, MAX_OUTPUT) + "\n...(truncated)";
            }
            return content;
        } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

// ── write_file ───────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "write_file",
            description: "Write content to a file. Creates parent directories if needed.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path to write." },
                    content: { type: "string", description: "Content to write." },
                },
                required: ["path", "content"],
            },
        },
    },
    async execute(input) {
        const filePath = input.path as string;
        const content = input.content as string;
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content, "utf-8");
            return `✅ Written ${content.length} chars to ${filePath}`;
        } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

// ── list_directory ───────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "list_directory",
            description: "List files and directories in a path.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path." },
                },
                required: ["path"],
            },
        },
    },
    async execute(input) {
        const dirPath = input.path as string;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const lines = entries.slice(0, 100).map((e) => {
                const type = e.isDirectory() ? "📁" : "📄";
                try {
                    const stat = fs.statSync(path.join(dirPath, e.name));
                    const size = e.isFile() ? ` (${(stat.size / 1024).toFixed(1)} KB)` : "";
                    return `${type} ${e.name}${size}`;
                } catch {
                    return `${type} ${e.name}`;
                }
            });
            return lines.join("\n") || "(empty directory)";
        } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

// ── search_files ─────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "search_files",
            description: "Search for files by name glob in a directory tree.",
            parameters: {
                type: "object",
                properties: {
                    directory: { type: "string", description: "Root directory to search." },
                    pattern: { type: "string", description: "Part of filename to match." },
                },
                required: ["directory", "pattern"],
            },
        },
    },
    async execute(input) {
        const dir = input.directory as string;
        const pattern = (input.pattern as string).toLowerCase();
        const results: string[] = [];

        function walk(d: string, depth: number): void {
            if (depth > 5 || results.length > 50) return;
            try {
                const entries = fs.readdirSync(d, { withFileTypes: true });
                for (const e of entries) {
                    if (e.name.startsWith(".") || e.name === "node_modules") continue;
                    const full = path.join(d, e.name);
                    if (e.isDirectory()) walk(full, depth + 1);
                    else if (e.name.toLowerCase().includes(pattern)) results.push(full);
                }
            } catch { /* skip */ }
        }

        walk(dir, 0);
        return results.length > 0
            ? results.join("\n")
            : `No files matching "${pattern}" found.`;
    },
});
