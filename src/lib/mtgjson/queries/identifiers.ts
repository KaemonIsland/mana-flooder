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

export function getIdentifiersByUuids(uuids: string[]) {
  if (!uuids.length) return new Map<string, IdentifierMap>();
  const columns = getTableColumns("cardIdentifiers");
  if (!columns.size || !columns.has("uuid")) {
    return new Map<string, IdentifierMap>();
  }

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const rows = db
    .prepare(
      `SELECT * FROM cardIdentifiers WHERE uuid IN (${placeholders.join(", ")})`,
    )
    .all(params) as Array<Record<string, unknown>>;

  const map = new Map<string, IdentifierMap>();
  rows.forEach((row) => {
    const uuid = row.uuid ? String(row.uuid) : null;
    if (!uuid) return;
    const identifiers = mapIdentifiers(row);
    if (identifiers) {
      map.set(uuid, identifiers);
    }
  });

  return map;
}

export function getTokenIdentifiersByUuid(uuid: string) {
  return mapIdentifiers(getIdentifierRow("tokenIdentifiers", uuid));
}
