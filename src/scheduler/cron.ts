// ─────────────────────────────────────────────────────────
// scheduler/cron.ts — Cron scheduler with SQLite persistence
// ─────────────────────────────────────────────────────────
import cron from "node-cron";
import { getDb } from "../memory/db.js";

interface ScheduledTask {
    id: number;
    name: string;
    cron_expr: string;
    message: string;
    chat_id: number;
    enabled: number;
    created_at: string;
}

// Active cron jobs keyed by task ID
const activeJobs = new Map<number, cron.ScheduledTask>();

// Callback for when a scheduled task fires
type TaskCallback = (chatId: number, message: string, taskName: string) => Promise<void>;
let onTaskFire: TaskCallback | null = null;

export function setTaskCallback(cb: TaskCallback): void {
    onTaskFire = cb;
}

/** Create a new scheduled task */
export function createSchedule(
    name: string,
    cronExpr: string,
    message: string,
    chatId: number
): ScheduledTask {
    if (!cron.validate(cronExpr)) {
        throw new Error(`Invalid cron expression: "${cronExpr}"`);
    }

    const db = getDb();
    const result = db
        .prepare(
            `INSERT INTO scheduled_tasks (name, cron_expr, message, chat_id) VALUES (?, ?, ?, ?)`
        )
        .run(name, cronExpr, message, chatId);

    const task = db
        .prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`)
        .get(result.lastInsertRowid) as ScheduledTask;

    startJob(task);
    return task;
}

/** List all scheduled tasks */
export function listSchedules(): ScheduledTask[] {
    const db = getDb();
    return db.prepare(`SELECT * FROM scheduled_tasks ORDER BY id`).all() as ScheduledTask[];
}

/** Delete a scheduled task */
export function deleteSchedule(id: number): boolean {
    const job = activeJobs.get(id);
    if (job) {
        job.stop();
        activeJobs.delete(id);
    }
    const db = getDb();
    const result = db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`).run(id);
    return result.changes > 0;
}

/** Toggle a task on/off */
export function toggleSchedule(id: number, enabled: boolean): boolean {
    const db = getDb();
    db.prepare(`UPDATE scheduled_tasks SET enabled = ? WHERE id = ?`).run(
        enabled ? 1 : 0,
        id
    );
    if (enabled) {
        const task = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id) as ScheduledTask | undefined;
        if (task) startJob(task);
    } else {
        const job = activeJobs.get(id);
        if (job) {
            job.stop();
            activeJobs.delete(id);
        }
    }
    return true;
}

/** Start a cron job for a task */
function startJob(task: ScheduledTask): void {
    if (activeJobs.has(task.id)) {
        activeJobs.get(task.id)!.stop();
    }

    const job = cron.schedule(task.cron_expr, async () => {
        console.log(`  ⏰ Scheduled task fired: ${task.name}`);
        if (onTaskFire) {
            await onTaskFire(task.chat_id, task.message, task.name);
        }
    });

    activeJobs.set(task.id, job);
}

/** Restore all persisted schedules on startup */
export function restoreSchedules(): void {
    const db = getDb();
    const tasks = db
        .prepare(`SELECT * FROM scheduled_tasks WHERE enabled = 1`)
        .all() as ScheduledTask[];

    for (const task of tasks) {
        try {
            startJob(task);
            console.log(`  ⏰ Restored schedule: ${task.name} (${task.cron_expr})`);
        } catch (err) {
            console.warn(`  ⚠️ Failed to restore schedule ${task.id}: ${err}`);
        }
    }
}
