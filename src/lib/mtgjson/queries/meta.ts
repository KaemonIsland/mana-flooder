import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns } from "@/lib/mtgjson/schema-introspect";
import { parseJson } from "./shared";

export type MtgjsonMetaSummary = {
  version: string | null;
  date: string | null;
};

export function getMetaSummary(): MtgjsonMetaSummary | null {
  try {
    const columns = getTableColumns("meta");
    if (!columns.size) return null;

    const db = getMtgjsonDb();

    if (columns.has("key") && columns.has("value")) {
      const rows = db
        .prepare("SELECT key, value FROM meta WHERE key IN ('date', 'version')")
        .all() as Array<{ key: string; value: string }>;
      const map = new Map(rows.map((row) => [row.key, row.value]));
      return {
        date: map.get("date") ?? null,
        version: map.get("version") ?? null,
      };
    }

    if (columns.has("date") || columns.has("version")) {
      const row = db
        .prepare(
          `
            SELECT
              ${columns.has("date") ? "date" : "NULL"} as date,
              ${columns.has("version") ? "version" : "NULL"} as version
            FROM meta
            LIMIT 1
          `,
        )
        .get() as { date?: string; version?: string } | undefined;
      return {
        date: row?.date ?? null,
        version: row?.version ?? null,
      };
    }

    if (columns.has("data")) {
      const row = db
        .prepare("SELECT data FROM meta LIMIT 1")
        .get() as { data?: string } | undefined;
      const parsed = parseJson<Record<string, string>>(row?.data, {});
      return {
        date: parsed.date ?? null,
        version: parsed.version ?? null,
      };
    }

    return null;
  } catch {
    return null;
  }
}
