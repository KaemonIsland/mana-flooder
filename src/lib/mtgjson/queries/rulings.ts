import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";

export type CardRuling = {
  date: string | null;
  text: string;
  source: string | null;
};

export function getRulingsByUuid(uuid: string): CardRuling[] {
  const columns = getTableColumns("cardRulings");
  if (!columns.size || !columns.has("uuid")) return [];

  const textColumn = pickColumn("cardRulings", ["text", "ruling"]);
  if (!textColumn) return [];

  const dateColumn = pickColumn("cardRulings", ["date"]);
  const sourceColumn = pickColumn("cardRulings", ["source", "provider"]);

  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT
          ${dateColumn ? `${dateColumn} as date` : "NULL as date"},
          ${textColumn} as text,
          ${sourceColumn ? `${sourceColumn} as source` : "NULL as source"}
        FROM cardRulings
        WHERE uuid = ?
        ORDER BY date ASC
      `,
    )
    .all(uuid);

  return rows.map((row) => ({
    date: (row.date as string | null) ?? null,
    text: String(row.text ?? ""),
    source: (row.source as string | null) ?? null,
  }));
}
