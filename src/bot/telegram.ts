// ─────────────────────────────────────────────────────────
// bot/telegram.ts — Grammy bot with all features
// ─────────────────────────────────────────────────────────
import { Bot, InputFile } from "grammy";
import fs from "fs";
import path from "path";
import os from "os";
import {
    TELEGRAM_BOT_TOKEN,
    ALLOWED_USERS,
    GROQ_API_KEY,
    talkModeUsers,
} from "../config.js";
import { runAgentLoop } from "../agent/loop.js";
import { registerCommands } from "./commands.js";

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

// ── Security middleware: silently drop unauthorized users ─
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !ALLOWED_USERS.has(userId)) {
        return; // Silently ignore
    }
    await next();
});

// ── Register slash commands (must come before message handlers) ─
registerCommands(bot);

// ── /talk — toggle voice response mode ────────────────────
bot.command("talk", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (talkModeUsers.has(userId)) {
        talkModeUsers.delete(userId);
        await ctx.reply("🔇 *Talk Mode OFF* — Responses will be text.", {
            parse_mode: "Markdown",
        });
    } else {
        talkModeUsers.add(userId);
        await ctx.reply(
            "🎙 *Talk Mode ON* — Responses will be sent as voice messages.",
            { parse_mode: "Markdown" }
        );
    }
});

// ── Handle voice messages ─────────────────────────────────
bot.on("message:voice", async (ctx) => {
    if (!GROQ_API_KEY) {
        await ctx.reply("⚠️ Voice transcription not configured (GROQ_API_KEY missing).");
        return;
    }

    const typingInterval = startTyping(ctx);

    try {
        // Download the voice file
        const file = await ctx.getFile();
        const filePath = path.join(os.tmpdir(), `gravity-voice-${Date.now()}.ogg`);

        const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        // Transcribe
        const { transcribeAudio } = await import("../voice/whisper.js");
        const text = await transcribeAudio(filePath);

        // Clean up temp file
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }

        if (!text.trim()) {
            stopTyping(typingInterval);
            await ctx.reply("🤷 Couldn't understand the audio. Try again?");
            return;
        }

        // Show transcription
        await ctx.reply(`🎤 _"${text}"_`, { parse_mode: "Markdown" });

        // Process through agent
        const reply = await runAgentLoop(text, ctx.chat.id);

        stopTyping(typingInterval);

        // Send as voice or text depending on talk mode
        if (talkModeUsers.has(ctx.from.id)) {
            await sendVoiceReply(ctx, reply);
        } else {
            await sendTextReply(ctx, reply);
        }
    } catch (err) {
        stopTyping(typingInterval);
        console.error("❌ Voice error:", err);
        await ctx.reply("Something went wrong processing your voice message.");
    }
});

// ── Handle photos/documents ───────────────────────────────
bot.on("message:photo", async (ctx) => {
    const caption = ctx.message.caption || "User sent a photo.";
    const typingInterval = startTyping(ctx);
    const statusMsg = await ctx.reply("⏳ _Processing your photo..._", { parse_mode: "Markdown" });

    try {
        const reply = await runAgentLoop(
            `[The user sent a photo with caption: "${caption}"]. Acknowledge it and respond helpfully.`,
            ctx.chat.id
        );
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);
        await sendTextReply(ctx, reply);
    } catch (err) {
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);
        console.error("❌ Photo error:", err);
        await ctx.reply("Something went wrong.");
    }
});

bot.on("message:document", async (ctx) => {
    const fileName = ctx.message.document.file_name || "unknown";
    const caption = ctx.message.caption || "";
    const typingInterval = startTyping(ctx);
    const statusMsg = await ctx.reply("⏳ _Processing your file..._", { parse_mode: "Markdown" });

    try {
        const reply = await runAgentLoop(
            `[The user sent a file: "${fileName}". Caption: "${caption}"]. Acknowledge it and respond helpfully.`,
            ctx.chat.id
        );
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);
        await sendTextReply(ctx, reply);
    } catch (err) {
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);
        console.error("❌ Document error:", err);
        await ctx.reply("Something went wrong.");
    }
});

// ── Handle text messages (group-chat aware) ───────────────
bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    const userId = ctx.from.id;
    const isGroup =
        ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    const botUsername = ctx.me.username;

    // In group chats, only respond when mentioned or replied to
    if (isGroup) {
        const isMentioned =
            userMessage.includes(`@${botUsername}`) ||
            ctx.message.reply_to_message?.from?.id === ctx.me.id;
        if (!isMentioned) return;
    }

    console.log(`\n💬 [${userId}] ${userMessage}`);

    const typingInterval = startTyping(ctx);
    const statusMsg = await ctx.reply("⏳ _Thinking..._", { parse_mode: "Markdown" });

    try {
        const reply = await runAgentLoop(userMessage, ctx.chat.id);
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);

        if (talkModeUsers.has(userId)) {
            await sendVoiceReply(ctx, reply);
        } else {
            await sendTextReply(ctx, reply);
        }
    } catch (err) {
        stopTyping(typingInterval);
        await deleteStatus(ctx, statusMsg.message_id);
        console.error("❌ Agent error:", err);
        await ctx.reply("Something went wrong. Check the console for details.");
    }
});

// ── Handle callback queries (inline keyboard) ─────────────
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    console.log(`  🔘 Callback: ${data}`);
    await ctx.answerCallbackQuery({ text: `Action: ${data}` });
});

// ── Typing indicator with interval ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function startTyping(ctx: any): ReturnType<typeof setInterval> {
    ctx.replyWithChatAction("typing").catch(() => { });
    return setInterval(() => {
        ctx.replyWithChatAction("typing").catch(() => { });
    }, 4000);
}

function stopTyping(interval: ReturnType<typeof setInterval>): void {
    clearInterval(interval);
}

/** Delete the "Thinking..." status message */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteStatus(ctx: any, messageId: number): Promise<void> {
    try {
        await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch {
        // Ignore — message may already be deleted
    }
}

// ── Send text reply (split long messages) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendTextReply(ctx: any, text: string): Promise<void> {
    const chunks = splitMessage(text, 4000);
    for (const chunk of chunks) {
        try {
            await ctx.reply(chunk, { parse_mode: "Markdown" });
        } catch {
            // If Markdown fails, send as plain text
            await ctx.reply(chunk);
        }
    }
}

// ── Send voice reply (TTS) ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendVoiceReply(ctx: any, text: string): Promise<void> {
    try {
        const { textToSpeech, cleanupTtsFile } = await import("../voice/tts.js");
        const audioPath = await textToSpeech(text);
        await ctx.replyWithVoice(new InputFile(audioPath));
        cleanupTtsFile(audioPath);
    } catch (err) {
        console.error("  ⚠️ TTS failed, falling back to text:", err);
        await sendTextReply(ctx, text);
    }
}

// ── Utility: split long messages ──────────────────────────
function splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }

        let splitIdx = remaining.lastIndexOf("\n", maxLen);
        if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
            splitIdx = remaining.lastIndexOf(" ", maxLen);
        }
        if (splitIdx === -1) {
            splitIdx = maxLen;
        }

        chunks.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx).trimStart();
    }

    return chunks;
}
