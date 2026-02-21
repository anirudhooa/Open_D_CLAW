// ─────────────────────────────────────────────────────────
// memory/db.ts — SQLite connection singleton
// ─────────────────────────────────────────────────────────
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "gravity-claw.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!_db) {
        _db = new Database(DB_PATH);
        _db.pragma("journal_mode = WAL");
        _db.pragma("foreign_keys = ON");
        initSchema(_db);
        console.log(`  📦 SQLite database: ${DB_PATH}`);
    }
    return _db;
}

function initSchema(db: Database.Database): void {
    db.exec(`
    -- Core memories table
    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category    TEXT    NOT NULL DEFAULT 'general',
      content     TEXT    NOT NULL,
      metadata    TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- FTS5 for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      category,
      content=memories,
      content_rowid=id
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, category)
      VALUES (new.id, new.content, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, category)
      VALUES ('delete', old.id, old.content, old.category);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, category)
      VALUES ('delete', old.id, old.content, old.category);
      INSERT INTO memories_fts(rowid, content, category)
      VALUES (new.id, new.content, new.category);
    END;

    -- Knowledge graph tables
    CREATE TABLE IF NOT EXISTS entities (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      type        TEXT    NOT NULL DEFAULT 'concept',
      properties  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      from_entity INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      to_entity   INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      relation    TEXT    NOT NULL,
      weight      REAL    NOT NULL DEFAULT 1.0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_entity, to_entity, relation)
    );

    -- Scheduled tasks table
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      cron_expr   TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      chat_id     INTEGER NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Conversation history for /compact
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      role        TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Usage tracking
    CREATE TABLE IF NOT EXISTS usage_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      model         TEXT    NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function closeDb(): void {
    if (_db) {
        _db.close();
        _db = null;
    }
}
