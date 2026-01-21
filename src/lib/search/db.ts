import Database from "better-sqlite3";
import { env } from "@/lib/env";

let searchDb: Database.Database | null = null;

const REQUIRED_TABLES = [
  "card_search",
  "card_search_printings",
  "card_search_fts",
];

function resolveSqlitePath(connectionString?: string) {
  if (!connectionString) return "/data/app/app.sqlite";
  if (connectionString.startsWith("file:")) {
    return connectionString.replace("file:", "");
  }
  return connectionString;
}

function assertSearchIndex(db: Database.Database, dbPath: string) {
  const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`,
    )
    .all(...REQUIRED_TABLES) as Array<{ name: string }>;

  const found = new Set(rows.map((row) => row.name));
  const missing = REQUIRED_TABLES.filter((name) => !found.has(name));

  if (missing.length) {
    throw new Error(
      `Search index missing tables (${missing.join(", ")}) in ${dbPath}. ` +
        "Run pnpm mtgjson:reindex or POST /api/mtgjson/reindex.",
    );
  }
}

export function getSearchDb() {
  if (!searchDb) {
    const dbPath = resolveSqlitePath(env.DATABASE_URL);
    const db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      assertSearchIndex(db, dbPath);
    } catch (error) {
      db.close();
      throw error;
    }
    searchDb = db;
  }
  return searchDb;
}
