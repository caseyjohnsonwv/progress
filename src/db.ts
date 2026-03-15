import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { CalorieEntry } from "./types.js";

export type EntryRow = {
  id: string;
  note: string;
  calories: number;
  consumed_at: string;
  day: string;
};

export type DatabaseClient = {
  insertEntry(entry: CalorieEntry): void;
  deleteEntry(entryId: string): number;
  getEntryById(entryId: string): EntryRow | null;
  updateEntryById(entryId: string, patch: { note?: string; calories?: number }): EntryRow | null;
  listEntriesByDay(day: string): EntryRow[];
  searchPastEntriesByNote(input: { query: string; beforeDay: string; limit: number }): EntryRow[];
  getConsumedCaloriesByDay(day: string): number;
};

export function createDatabase(dbPath: string): DatabaseClient {
  const parentDir = path.dirname(dbPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      note TEXT NOT NULL,
      calories INTEGER NOT NULL CHECK(calories >= 0),
      consumed_at TEXT NOT NULL,
      day TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_day_consumed_at
    ON entries(day, consumed_at);
  `);

  const insertStmt = db.prepare(
    `INSERT INTO entries (id, note, calories, consumed_at, day)
     VALUES (@id, @note, @calories, @consumed_at, @day)`,
  );

  const deleteStmt = db.prepare(`DELETE FROM entries WHERE id = ?`);
  const getByIdStmt = db.prepare(
    `SELECT id, note, calories, consumed_at, day
     FROM entries
     WHERE id = ?`,
  );
  const updateStmt = db.prepare(
    `UPDATE entries
     SET note = @note,
         calories = @calories
     WHERE id = @id`,
  );

  const listByDayStmt = db.prepare(
    `SELECT id, note, calories, consumed_at, day
     FROM entries
     WHERE day = ?
     ORDER BY consumed_at ASC`,
  );
  const searchPastByNoteStmt = db.prepare(
    `SELECT id, note, calories, consumed_at, day
     FROM entries
     WHERE day < @before_day
       AND LOWER(note) LIKE '%' || LOWER(@query) || '%'
     ORDER BY consumed_at DESC
     LIMIT @limit`,
  );

  const consumedStmt = db.prepare(
    `SELECT COALESCE(SUM(calories), 0) AS consumed
     FROM entries
     WHERE day = ?`,
  );

  return {
    insertEntry(entry: CalorieEntry): void {
      insertStmt.run(entry);
    },
    deleteEntry(entryId: string): number {
      const result = deleteStmt.run(entryId);
      return result.changes;
    },
    getEntryById(entryId: string): EntryRow | null {
      const entry = getByIdStmt.get(entryId) as EntryRow | undefined;
      return entry ?? null;
    },
    updateEntryById(entryId: string, patch: { note?: string; calories?: number }): EntryRow | null {
      const existing = getByIdStmt.get(entryId) as EntryRow | undefined;
      if (!existing) {
        return null;
      }

      updateStmt.run({
        id: entryId,
        note: patch.note ?? existing.note,
        calories: patch.calories ?? existing.calories,
      });

      const updated = getByIdStmt.get(entryId) as EntryRow | undefined;
      return updated ?? null;
    },
    listEntriesByDay(day: string): EntryRow[] {
      return listByDayStmt.all(day) as EntryRow[];
    },
    searchPastEntriesByNote(input: { query: string; beforeDay: string; limit: number }): EntryRow[] {
      return searchPastByNoteStmt.all({
        before_day: input.beforeDay,
        query: input.query,
        limit: input.limit,
      }) as EntryRow[];
    },
    getConsumedCaloriesByDay(day: string): number {
      const row = consumedStmt.get(day) as { consumed: number } | undefined;
      return row?.consumed ?? 0;
    },
  };
}
