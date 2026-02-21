// ─────────────────────────────────────────────────────────
// agent/usage.ts — Token usage tracking
// ─────────────────────────────────────────────────────────
import { getDb } from "../memory/db.js";

export function logUsage(
    model: string,
    promptTokens: number,
    completionTokens: number
): void {
    const db = getDb();
    db.prepare(
        `INSERT INTO usage_log (model, prompt_tokens, completion_tokens) VALUES (?, ?, ?)`
    ).run(model, promptTokens, completionTokens);
}

export interface UsageSummary {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalCalls: number;
    todayPromptTokens: number;
    todayCompletionTokens: number;
    todayCalls: number;
}

export function getUsageSummary(): UsageSummary {
    const db = getDb();

    const total = db
        .prepare(
            `SELECT COALESCE(SUM(prompt_tokens),0) as pt, COALESCE(SUM(completion_tokens),0) as ct, COUNT(*) as calls FROM usage_log`
        )
        .get() as { pt: number; ct: number; calls: number };

    const today = db
        .prepare(
            `SELECT COALESCE(SUM(prompt_tokens),0) as pt, COALESCE(SUM(completion_tokens),0) as ct, COUNT(*) as calls FROM usage_log WHERE date(created_at) = date('now')`
        )
        .get() as { pt: number; ct: number; calls: number };

    return {
        totalPromptTokens: total.pt,
        totalCompletionTokens: total.ct,
        totalCalls: total.calls,
        todayPromptTokens: today.pt,
        todayCompletionTokens: today.ct,
        todayCalls: today.calls,
    };
}
