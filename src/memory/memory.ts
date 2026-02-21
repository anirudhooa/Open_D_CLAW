// ─────────────────────────────────────────────────────────
// memory/memory.ts — Memory CRUD operations
// ─────────────────────────────────────────────────────────
import { getDb } from "./db.js";

export interface Memory {
    id: number;
    category: string;
    content: string;
    metadata: string | null;
    access_count: number;
    created_at: string;
    updated_at: string;
}

/** Save a new memory */
export function saveMemory(
    content: string,
    category = "general",
    metadata?: string
): Memory {
    const db = getDb();
    const stmt = db.prepare(
        `INSERT INTO memories (content, category, metadata) VALUES (?, ?, ?)`
    );
    const result = stmt.run(content, category, metadata ?? null);
    return db
        .prepare(`SELECT * FROM memories WHERE id = ?`)
        .get(result.lastInsertRowid) as Memory;
}

/** Full-text search memories */
export function searchMemories(query: string, limit = 10): Memory[] {
    const db = getDb();
    // FTS5 search with ranking
    const rows = db
        .prepare(
            `SELECT m.* FROM memories m
       JOIN memories_fts f ON m.id = f.rowid
       WHERE memories_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
        )
        .all(query, limit) as Memory[];

    // Bump access counts
    for (const row of rows) {
        db.prepare(
            `UPDATE memories SET access_count = access_count + 1, updated_at = datetime('now') WHERE id = ?`
        ).run(row.id);
    }

    return rows;
}

/** List memories by category */
export function listMemories(
    category?: string,
    limit = 20
): Memory[] {
    const db = getDb();
    if (category) {
        return db
            .prepare(
                `SELECT * FROM memories WHERE category = ? ORDER BY updated_at DESC LIMIT ?`
            )
            .all(category, limit) as Memory[];
    }
    return db
        .prepare(`SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?`)
        .all(limit) as Memory[];
}

/** Delete a memory by ID */
export function deleteMemory(id: number): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return result.changes > 0;
}

/** Get memory count */
export function getMemoryCount(): number {
    const db = getDb();
    const row = db.prepare(`SELECT COUNT(*) as count FROM memories`).get() as {
        count: number;
    };
    return row.count;
}

/** Auto-load relevant memories for a user message */
export function getRelevantMemories(userMessage: string): Memory[] {
    try {
        // Search FTS with the user's message words
        const searchTerms = userMessage
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 2)
            .slice(0, 5)
            .join(" OR ");

        if (!searchTerms) return [];
        return searchMemories(searchTerms, 5);
    } catch {
        return [];
    }
}
