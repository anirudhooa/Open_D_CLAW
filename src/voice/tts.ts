// ─────────────────────────────────────────────────────────
// voice/tts.ts — Text-to-speech: ElevenLabs (primary) + Edge TTS (fallback)
// ─────────────────────────────────────────────────────────
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fs from "fs";
import { ELEVENLABS_API_KEY } from "../config.js";

const execFileAsync = promisify(execFile);

// ElevenLabs voice IDs (free tier defaults)
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — clear, natural
const ELEVENLABS_MODEL = "eleven_monolingual_v1";

/**
 * Convert text to speech.
 * Tries ElevenLabs first (better quality), falls back to Edge TTS (unlimited free).
 */
export async function textToSpeech(text: string): Promise<string> {
    // Try ElevenLabs if configured
    if (ELEVENLABS_API_KEY) {
        try {
            return await elevenLabsTts(text);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // If we hit the free limit (quota exceeded), fall through to Edge TTS
            if (msg.includes("quota") || msg.includes("limit") || msg.includes("429") || msg.includes("401")) {
                console.warn("  ⚠️ ElevenLabs free limit reached, falling back to Edge TTS");
            } else {
                console.warn("  ⚠️ ElevenLabs error, falling back to Edge TTS:", msg);
            }
        }
    }

    // Fallback: Edge TTS (completely free, unlimited)
    return await edgeTts(text);
}

/**
 * ElevenLabs TTS — high quality, 10K chars/month free.
 */
async function elevenLabsTts(text: string): Promise<string> {
    const outPath = path.join(os.tmpdir(), `gravity-tts-${Date.now()}.mp3`);

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
            method: "POST",
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY!,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({
                text: text.slice(0, 2500), // Keep under free tier limits per request
                model_id: ELEVENLABS_MODEL,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        }
    );

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`ElevenLabs ${response.status}: ${body}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outPath, buffer);

    console.log(`  🗣️ ElevenLabs TTS: ${text.length} chars → ${(buffer.length / 1024).toFixed(1)} KB`);
    return outPath;
}

/**
 * Edge TTS — free, unlimited, decent quality.
 */
async function edgeTts(text: string, voice = "en-US-AriaNeural"): Promise<string> {
    const outPath = path.join(os.tmpdir(), `gravity-tts-${Date.now()}.mp3`);

    try {
        await execFileAsync(
            "npx",
            ["edge-tts", "--voice", voice, "--text", text, "--write-media", outPath],
            { timeout: 30000, windowsHide: true }
        );
    } catch {
        // Fallback with shell: true for Windows compatibility
        const { spawn } = await import("child_process");
        return new Promise((resolve, reject) => {
            const proc = spawn(
                "npx",
                ["edge-tts", "--voice", voice, "--text", text, "--write-media", outPath],
                { shell: true, windowsHide: true }
            );
            proc.on("close", (code) => {
                if (code === 0) resolve(outPath);
                else reject(new Error(`Edge TTS exited with code ${code}`));
            });
            proc.on("error", reject);
        });
    }

    console.log(`  🗣️ Edge TTS: ${text.length} chars`);
    return outPath;
}

/** Clean up temp TTS files */
export function cleanupTtsFile(filePath: string): void {
    try {
        fs.unlinkSync(filePath);
    } catch {
        // Ignore — OS will clean tmp
    }
}
