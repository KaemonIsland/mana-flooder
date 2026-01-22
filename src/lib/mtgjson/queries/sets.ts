import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";

export type MtgjsonSetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
  symbol: string | null;
};

function selectColumn(
  columns: Set<string>,
  columnName: string,
  alias: string,
  tableAlias: string,
) {
  if (columns.has(columnName)) {
    return `${tableAlias}.${columnName} as ${alias}`;
  }
  return `NULL as ${alias}`;
}

export function getSetSummaries(): MtgjsonSetSummary[] {
  const columns = getTableColumns("sets");
  if (!columns.size) return [];

  const codeColumn = pickColumn("sets", ["code", "setCode"]);
  const symbolColumn = pickColumn("sets", [
    "keyruneCode",
    "symbol",
    "iconSvgUri",
    "iconSvgURI",
    "iconSvg",
  ]);
  if (!codeColumn) return [];

  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT
          ${codeColumn} as code,
          ${selectColumn(columns, "name", "name", "sets")},
          ${selectColumn(columns, "releaseDate", "releaseDate", "sets")},
          ${selectColumn(columns, "type", "type", "sets")},
          ${symbolColumn ? `sets.${symbolColumn} as symbol` : "NULL as symbol"}
        FROM sets
        ORDER BY releaseDate DESC
      `,
    )
    .all();

  return rows.map((row) => ({
    code: row.code as string,
    name: (row.name as string | null) ?? (row.code as string),
    releaseDate: (row.releaseDate as string | null) ?? null,
    type: (row.type as string | null) ?? null,
    symbol: (row.symbol as string | null) ?? null,
  }));
}

export function getSetByCode(code: string): MtgjsonSetSummary | null {
  const columns = getTableColumns("sets");
  if (!columns.size) return null;
  const codeColumn = pickColumn("sets", ["code", "setCode"]);
  const symbolColumn = pickColumn("sets", [
    "keyruneCode",
    "symbol",
    "iconSvgUri",
    "iconSvgURI",
    "iconSvg",
  ]);
  if (!codeColumn) return null;

  const db = getMtgjsonDb();
  const row = db
    .prepare(
      `
        SELECT
          ${codeColumn} as code,
          ${selectColumn(columns, "name", "name", "sets")},
          ${selectColumn(columns, "releaseDate", "releaseDate", "sets")},
          ${selectColumn(columns, "type", "type", "sets")},
          ${symbolColumn ? `sets.${symbolColumn} as symbol` : "NULL as symbol"}
        FROM sets
        WHERE ${codeColumn} = ?
      `,
    )
    .get(code);

  if (!row) return null;
  return {
    code: row.code as string,
    name: (row.name as string | null) ?? (row.code as string),
    releaseDate: (row.releaseDate as string | null) ?? null,
    type: (row.type as string | null) ?? null,
    symbol: (row.symbol as string | null) ?? null,
  };
}
