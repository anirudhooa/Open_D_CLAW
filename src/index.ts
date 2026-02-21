// ─────────────────────────────────────────────────────────
// index.ts — Application entry point
// ─────────────────────────────────────────────────────────

// 1. Load config first (validates env vars, exits on failure)
import { logConfig } from "./config.js";

// 2. Initialize database (creates tables if needed)
import { getDb, closeDb } from "./memory/db.js";
getDb(); // Ensure DB is initialized early

// 3. Register all tools (side-effect imports)
import "./tools/index.js";

// 4. Start the Live Canvas server (localhost only)
import { startCanvasServer } from "./canvas/server.js";

// 5. Restore scheduled tasks from database
import { restoreSchedules, setTaskCallback } from "./scheduler/cron.js";

// 6. Import the Telegram bot
import { bot } from "./bot/telegram.js";
import { runAgentLoop } from "./agent/loop.js";

// ── Boot sequence ─────────────────────────────────────────
logConfig();

// Start canvas
startCanvasServer();

// Restore cron schedules and wire the callback
restoreSchedules();
setTaskCallback(async (chatId, message, taskName) => {
    console.log(`  ⏰ Schedule fired: ${taskName}`);
    try {
        const reply = await runAgentLoop(message);
        await bot.api.sendMessage(chatId, reply);
    } catch (err) {
        console.error(`  ❌ Schedule error (${taskName}):`, err);
    }
});

// Start Telegram bot
console.log("\n🚀 Starting Telegram long-polling…\n");

bot.start({
    onStart: (botInfo) => {
        console.log(`✅ Bot running as @${botInfo.username}`);
        console.log("   Send me a message on Telegram!\n");
    },
});

// ── Graceful shutdown ─────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`\n🛑 Received ${signal}. Shutting down…`);
    bot.stop();
    closeDb();
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
