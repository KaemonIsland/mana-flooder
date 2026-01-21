import Database from "better-sqlite3";
import { env } from "@/lib/env";

let searchDb: Database.Database | null = null;

function resolveSqlitePath(connectionString?: string) {
  if (!connectionString) return "/data/app/app.sqlite";
  if (connectionString.startsWith("file:")) {
    return connectionString.replace("file:", "");
  }
  return connectionString;
}

export function getSearchDb() {
  if (!searchDb) {
    const dbPath = resolveSqlitePath(env.DATABASE_URL);
    searchDb = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    });
  }
  return searchDb;
}
