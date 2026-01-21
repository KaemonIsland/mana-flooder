import Database from "better-sqlite3";
import { env } from "@/lib/env";

let mtgjsonDb: Database.Database | null = null;

export function getMtgjsonDb() {
  if (!mtgjsonDb) {
    mtgjsonDb = new Database(env.MTGJSON_DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
  }
  return mtgjsonDb;
}
