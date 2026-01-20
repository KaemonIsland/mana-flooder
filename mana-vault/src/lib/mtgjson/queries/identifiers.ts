import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns } from "@/lib/mtgjson/schema-introspect";

export type IdentifierMap = Record<string, string>;

function mapIdentifiers(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  const entries = Object.entries(row)
    .filter(([key, value]) => key !== "uuid" && value !== null && value !== undefined)
    .map(([key, value]) => [key, String(value)]);
  return Object.fromEntries(entries) as IdentifierMap;
}

function getIdentifierRow(tableName: string, uuid: string) {
  const columns = getTableColumns(tableName);
  if (!columns.size || !columns.has("uuid")) return null;
  const db = getMtgjsonDb();
  return db
    .prepare(`SELECT * FROM ${tableName} WHERE uuid = ?`)
    .get(uuid) as Record<string, unknown> | undefined;
}

export function getIdentifiersByUuid(uuid: string) {
  return mapIdentifiers(getIdentifierRow("cardIdentifiers", uuid));
}

export function getTokenIdentifiersByUuid(uuid: string) {
  return mapIdentifiers(getIdentifierRow("tokenIdentifiers", uuid));
}
