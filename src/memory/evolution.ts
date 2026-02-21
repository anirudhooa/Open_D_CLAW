// ─────────────────────────────────────────────────────────
// memory/evolution.ts — Self-evolving memory system
// ─────────────────────────────────────────────────────────
import { getDb } from "./db.js";

interface MemoryRow {
    id: number;
    content: string;
    category: string;
    access_count: number;
    updated_at: string;
}

/**
 * Apply memory decay — reduce relevance of old, rarely-accessed memories.
 * Called periodically (e.g., from a scheduled task).
 */
export function applyDecay(): { decayed: number; deleted: number } {
    const db = getDb();

    // Memories not accessed in 30+ days with low access count → delete
    const deleted = db
        .prepare(
            `DELETE FROM memories
       WHERE access_count < 2
       AND updated_at < datetime('now', '-30 days')`
        )
        .run().changes;

    // Memories not accessed in 7+ days → "decay" (just tracking for now)
    const decayed = db
        .prepare(
            `SELECT COUNT(*) as count FROM memories
       WHERE updated_at < datetime('now', '-7 days')`
        )
        .get() as { count: number };

    return { decayed: decayed.count, deleted };
}

/**
 * Find and merge duplicate memories (similar content).
 * Uses simple substring matching — not perfect, but lightweight.
 */
export function mergeDuplicates(): number {
    const db = getDb();
    const allMemories = db
        .prepare(`SELECT * FROM memories ORDER BY id`)
        .all() as MemoryRow[];

    let merged = 0;

    for (let i = 0; i < allMemories.length; i++) {
        for (let j = i + 1; j < allMemories.length; j++) {
            const a = allMemories[i];
            const b = allMemories[j];

            if (!a || !b) continue;

            // Check if content is very similar (one contains the other)
            const similarity = computeSimilarity(a.content, b.content);
            if (similarity > 0.8) {
                // Keep the one with more access count, merge content
                const keep = a.access_count >= b.access_count ? a : b;
                const remove = keep === a ? b : a;

                // Update the kept memory with combined info
                const combined =
                    keep.content.length >= remove.content.length
                        ? keep.content
                        : remove.content;

                db.prepare(
                    `UPDATE memories SET content = ?, access_count = access_count + ? WHERE id = ?`
                ).run(combined, remove.access_count, keep.id);

                db.prepare(`DELETE FROM memories WHERE id = ?`).run(remove.id);
                merged++;
            }
        }
    }

    return merged;
}

/** Simple Jaccard-like similarity on word sets */
function computeSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));

    let intersection = 0;
    for (const word of setA) {
        if (setB.has(word)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Get memory statistics for the evolution system.
 */
export function getMemoryStats(): {
    total: number;
    byCategory: Record<string, number>;
    avgAccessCount: number;
    oldestDays: number;
} {
    const db = getDb();

    const total = (
        db.prepare(`SELECT COUNT(*) as c FROM memories`).get() as { c: number }
    ).c;

    const categories = db
        .prepare(
            `SELECT category, COUNT(*) as c FROM memories GROUP BY category`
        )
        .all() as { category: string; c: number }[];

    const byCategory: Record<string, number> = {};
    for (const row of categories) byCategory[row.category] = row.c;

    const avg = (
        db
            .prepare(
                `SELECT COALESCE(AVG(access_count), 0) as a FROM memories`
            )
            .get() as { a: number }
    ).a;

    const oldest = (
        db
            .prepare(
                `SELECT COALESCE(MIN(julianday('now') - julianday(created_at)), 0) as d FROM memories`
            )
            .get() as { d: number }
    ).d;

    return {
        total,
        byCategory,
        avgAccessCount: Math.round(avg * 10) / 10,
        oldestDays: Math.round(oldest),
    };
}

/**
 * Run full evolution cycle: decay → merge → report
 */
export function runEvolutionCycle(): string {
    const { decayed, deleted } = applyDecay();
    const merged = mergeDuplicates();
    const stats = getMemoryStats();

    return [
        `🧬 Memory Evolution Report:`,
        `  Decayed (7+ days inactive): ${decayed}`,
        `  Deleted (30+ days, low access): ${deleted}`,
        `  Duplicates merged: ${merged}`,
        `  Total memories: ${stats.total}`,
        `  Avg access count: ${stats.avgAccessCount}`,
        `  Categories: ${Object.entries(stats.byCategory).map(([k, v]) => `${k}(${v})`).join(", ")}`,
    ].join("\n");
}
