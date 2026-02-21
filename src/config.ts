// ─────────────────────────────────────────────────────────
// config.ts — Load and validate environment variables
// ─────────────────────────────────────────────────────────
import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`❌ Missing required env var: ${name}`);
        console.error(`   Copy .env.example → .env and fill in your values.`);
        process.exit(1);
    }
    return value;
}

function optional(name: string): string | undefined {
    return process.env[name] || undefined;
}

// ── Telegram ──────────────────────────────────────────────
export const TELEGRAM_BOT_TOKEN = required("TELEGRAM_BOT_TOKEN");

export const ALLOWED_USERS: Set<number> = new Set(
    required("TELEGRAM_ALLOWED_USERS")
        .split(",")
        .map((id) => {
            const n = Number(id.trim());
            if (Number.isNaN(n)) {
                console.error(`❌ Invalid user ID in TELEGRAM_ALLOWED_USERS: "${id}"`);
                process.exit(1);
            }
            return n;
        })
);

// ── OpenRouter ────────────────────────────────────────────
export const OPENROUTER_API_KEY = required("OPENROUTER_API_KEY");

// ── Groq (free Whisper) ──────────────────────────────────
export const GROQ_API_KEY = optional("GROQ_API_KEY");

// ── ElevenLabs (free 10K chars/mo) ───────────────────────
export const ELEVENLABS_API_KEY = optional("ELEVENLABS_API_KEY");

// ── Agent ─────────────────────────────────────────────────
export const AGENT_MAX_ITERATIONS = Number(
    process.env.AGENT_MAX_ITERATIONS ?? "10"
);

// ── State ─────────────────────────────────────────────────
export const startedAt = Date.now();

// ── Talk mode per user ────────────────────────────────────
export const talkModeUsers = new Set<number>();

// ── Model selection (can be changed at runtime) ───────────
export let CURRENT_MODEL = process.env.LLM_MODEL ?? "qwen2.5:7b";
export function setModel(model: string): void {
    CURRENT_MODEL = model;
}

/** Check if current model is local (Ollama) */
export function isLocalModel(): boolean {
    return !CURRENT_MODEL.includes("/");
}

// ── Logging helper (never log secrets) ────────────────────
export function logConfig(): void {
    const provider = isLocalModel() ? "Ollama (local)" : "OpenRouter";
    console.log("┌─────────────────────────────────────────┐");
    console.log("│        🪐  Gravity Claw  v0.1.0         │");
    console.log("├─────────────────────────────────────────┤");
    console.log(`│  Allowed users : ${[...ALLOWED_USERS].join(", ").padEnd(21)}│`);
    console.log(`│  Max iterations: ${String(AGENT_MAX_ITERATIONS).padEnd(21)}│`);
    console.log(`│  Model         : ${CURRENT_MODEL.slice(0, 21).padEnd(21)}│`);
    console.log(`│  Provider      : ${provider.padEnd(21)}│`);
    console.log(`│  Groq Whisper  : ${GROQ_API_KEY ? "configured" : "not set  "}${"".padEnd(10)}│`);
    console.log("└─────────────────────────────────────────┘");
}
