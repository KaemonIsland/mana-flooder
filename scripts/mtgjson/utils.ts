import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const MTGJSON_BASE_URL = "https://mtgjson.com/api/v5";
export const MTGJSON_DIR = process.env.MTGJSON_DIR ?? "/data/mtgjson";
export const MTGJSON_DB_PATH =
  process.env.MTGJSON_DB_PATH ?? `${MTGJSON_DIR}/AllPrintings.sqlite`;
export const MTGJSON_ARCHIVE_PATH = `${MTGJSON_DIR}/AllPrintings.sqlite.xz`;
export const MTGJSON_META_PATH = `${MTGJSON_DIR}/Meta.json`;

export function resolveSqlitePath(connectionString?: string) {
  if (!connectionString) return "/data/app/app.sqlite";
  if (connectionString.startsWith("file:")) {
    return connectionString.replace("file:", "");
  }
  return connectionString;
}

export const APP_DB_PATH = resolveSqlitePath(process.env.DATABASE_URL);

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function ensureParentDir(path: string) {
  await ensureDir(dirname(path));
}
