// ─────────────────────────────────────────────────────────
// tools/scheduler-tools.ts — Scheduler tools for the agent
// ─────────────────────────────────────────────────────────
import { registerTool } from "./registry.js";
import {
    createSchedule,
    listSchedules,
    deleteSchedule,
} from "../scheduler/cron.js";

// ── schedule_task ────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "schedule_task",
            description:
                'Create a scheduled task that will send a message at recurring times. Uses cron syntax.\n\nExamples:\n- "0 9 * * *" = every day at 9 AM\n- "*/30 * * * *" = every 30 minutes\n- "0 9 * * 1-5" = weekdays at 9 AM',
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Name for this schedule." },
                    cron_expression: {
                        type: "string",
                        description: "Cron expression (5 fields: min hour dom month dow).",
                    },
                    message: {
                        type: "string",
                        description:
                            "The message/prompt to process when the schedule fires.",
                    },
                    chat_id: {
                        type: "number",
                        description: "Telegram chat ID to send the result to.",
                    },
                },
                required: ["name", "cron_expression", "message", "chat_id"],
            },
        },
    },
    async execute(input) {
        try {
            const task = createSchedule(
                input.name as string,
                input.cron_expression as string,
                input.message as string,
                input.chat_id as number
            );
            return `✅ Schedule "${task.name}" created (ID: ${task.id}, cron: ${task.cron_expr})`;
        } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

// ── list_schedules ───────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "list_schedules",
            description: "List all scheduled tasks.",
            parameters: { type: "object", properties: {}, required: [] },
        },
    },
    async execute() {
        const schedules = listSchedules();
        if (schedules.length === 0) return "No scheduled tasks.";
        return schedules
            .map(
                (s) =>
                    `[${s.id}] ${s.name} — ${s.cron_expr} — ${s.enabled ? "✅ enabled" : "⏸ paused"}`
            )
            .join("\n");
    },
});

// ── delete_schedule ──────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "delete_schedule",
            description: "Delete a scheduled task by its ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "number", description: "Schedule ID to delete." },
                },
                required: ["id"],
            },
        },
    },
    async execute(input) {
        const success = deleteSchedule(input.id as number);
        return success
            ? `✅ Schedule ${input.id} deleted.`
            : `❌ Schedule ${input.id} not found.`;
    },
});
