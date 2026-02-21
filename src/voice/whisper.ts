// ─────────────────────────────────────────────────────────
// voice/whisper.ts — Voice transcription via Groq Whisper
// ─────────────────────────────────────────────────────────
import OpenAI from "openai";
import { GROQ_API_KEY } from "../config.js";
import fs from "fs";

let groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
    if (!groqClient) {
        if (!GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY not set — voice transcription unavailable.");
        }
        groqClient = new OpenAI({
            baseURL: "https://api.groq.com/openai/v1",
            apiKey: GROQ_API_KEY,
        });
    }
    return groqClient;
}

/**
 * Transcribe an audio file using Groq's free Whisper API
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    const client = getGroqClient();

    const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-large-v3",
        language: "en",
    });

    return transcription.text;
}
