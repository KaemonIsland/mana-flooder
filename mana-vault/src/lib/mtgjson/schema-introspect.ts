import { getMtgjsonDb } from "@/lib/mtgjson/db";

export type TableColumn = {
  name: string;
  type: string | null;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

const tableInfoCache = new Map<string, TableColumn[]>();
const tableExistsCache = new Map<string, boolean>();

function assertSafeName(name: string) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe table name: ${name}`);
  }
}

export function hasTable(tableName: string) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName) ?? false;
  }
  const db = getMtgjsonDb();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  const exists = Boolean(row?.name);
  tableExistsCache.set(tableName, exists);
  return exists;
}

export function getTableInfo(tableName: string): TableColumn[] {
  if (tableInfoCache.has(tableName)) {
    return tableInfoCache.get(tableName) ?? [];
  }
  if (!hasTable(tableName)) {
    tableInfoCache.set(tableName, []);
    return [];
  }
  assertSafeName(tableName);
  const db = getMtgjsonDb();
  const rows = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as TableColumn[];
  tableInfoCache.set(tableName, rows);
  return rows;
}

export function getTableColumns(tableName: string): Set<string> {
  return new Set(getTableInfo(tableName).map((row) => row.name));
}

export function hasColumn(tableName: string, columnName: string) {
  return getTableColumns(tableName).has(columnName);
}

export function pickColumn(tableName: string, candidates: string[]) {
  const columns = getTableColumns(tableName);
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
}
