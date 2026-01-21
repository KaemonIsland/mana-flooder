import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";

export type CardLegality = {
  format: string;
  status: string;
};

function resolveLegalityColumns() {
  const columns = getTableColumns("cardLegalities");
  const formatColumn = pickColumn("cardLegalities", ["format", "formatName"]);
  const statusColumn = pickColumn("cardLegalities", [
    "legality",
    "status",
    "legal",
    "legalStatus",
  ]);
  const hasUuid = columns.has("uuid");
  return { formatColumn, statusColumn, hasUuid };
}

export function getLegalitiesByUuid(uuid: string): CardLegality[] {
  const { formatColumn, statusColumn, hasUuid } = resolveLegalityColumns();
  if (!formatColumn || !statusColumn || !hasUuid) return [];

  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT ${formatColumn} as format,
               ${statusColumn} as status
        FROM cardLegalities
        WHERE uuid = ?
      `,
    )
    .all(uuid);

  return rows
    .filter((row) => row.format !== null && row.status !== null)
    .map((row) => ({
      format: String(row.format),
      status: String(row.status),
    }));
}

export function getCommanderLegality(uuid: string): string | null {
  const { formatColumn, statusColumn, hasUuid } = resolveLegalityColumns();
  if (!formatColumn || !statusColumn || !hasUuid) return null;

  const db = getMtgjsonDb();
  const row = db
    .prepare(
      `
        SELECT ${statusColumn} as status
        FROM cardLegalities
        WHERE uuid = ?
          AND LOWER(${formatColumn}) = 'commander'
        LIMIT 1
      `,
    )
    .get(uuid) as { status?: string } | undefined;

  return row?.status ?? null;
}

export function getCommanderLegalitiesForUuids(uuids: string[]) {
  const { formatColumn, statusColumn, hasUuid } = resolveLegalityColumns();
  if (!formatColumn || !statusColumn || !hasUuid) return new Map<string, string>();
  if (!uuids.length) return new Map();

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const rows = db
    .prepare(
      `
        SELECT uuid,
               ${statusColumn} as status
        FROM cardLegalities
        WHERE uuid IN (${placeholders.join(", ")})
          AND LOWER(${formatColumn}) = 'commander'
      `,
    )
    .all(params) as Array<{ uuid: string; status: string }>;

  const map = new Map<string, string>();
  rows.forEach((row) => {
    map.set(row.uuid, row.status);
  });
  return map;
}
