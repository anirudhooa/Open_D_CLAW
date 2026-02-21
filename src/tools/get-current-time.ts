// ─────────────────────────────────────────────────────────
// tools/get-current-time.ts — Returns the current date/time
// ─────────────────────────────────────────────────────────
import { registerTool } from "./registry.js";

registerTool({
    schema: {
        type: "function",
        function: {
            name: "get_current_time",
            description:
                "Returns the current date and time in the user's local timezone. " +
                "Use this when the user asks what time or date it is.",
            parameters: {
                type: "object",
                properties: {
                    timezone: {
                        type: "string",
                        description:
                            'IANA timezone string, e.g. "Asia/Kolkata". Defaults to the system timezone if omitted.',
                    },
                },
                required: [],
            },
        },
    },

    async execute(input) {
        const tz = (input.timezone as string) || undefined;
        const now = new Date();
        const formatted = now.toLocaleString("en-US", {
            timeZone: tz,
            dateStyle: "full",
            timeStyle: "long",
        });
        return formatted;
    },
});
