// ─────────────────────────────────────────────────────────
// tools/shell.ts — Shell command execution tool
// ─────────────────────────────────────────────────────────
import { exec } from "child_process";
import { promisify } from "util";
import { registerTool } from "./registry.js";

const execAsync = promisify(exec);

const BLOCKED_COMMANDS = [
    "rm -rf /", "rm -rf /*", "format", "del /s /q",
    "mkfs", "dd ", ":(){", "shutdown", "reboot",
    "poweroff", "init 0", "init 6",
];

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 4000;

registerTool({
    schema: {
        type: "function",
        function: {
            name: "run_shell_command",
            description:
                "Execute a shell command and return its output. Use for system tasks, checking installed software, running scripts, etc. Dangerous commands are blocked.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The shell command to execute.",
                    },
                    cwd: {
                        type: "string",
                        description: "Working directory (optional).",
                    },
                },
                required: ["command"],
            },
        },
    },

    async execute(input) {
        const command = input.command as string;
        const cwd = input.cwd as string | undefined;

        // Safety check
        const lower = command.toLowerCase();
        for (const blocked of BLOCKED_COMMANDS) {
            if (lower.includes(blocked)) {
                return `🛑 BLOCKED: Command contains dangerous pattern "${blocked}".`;
            }
        }

        console.log(`    💻 Shell: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: TIMEOUT_MS,
                cwd,
                maxBuffer: 1024 * 1024,
                windowsHide: true,
            });

            let output = stdout || stderr || "(no output)";
            if (output.length > MAX_OUTPUT) {
                output = output.slice(0, MAX_OUTPUT) + "\n...(truncated)";
            }
            return output;
        } catch (err: unknown) {
            const error = err as { message?: string; killed?: boolean };
            if (error.killed) {
                return `⏰ Command timed out after ${TIMEOUT_MS / 1000}s.`;
            }
            return `Error: ${error.message ?? String(err)}`.slice(0, MAX_OUTPUT);
        }
    },
});
