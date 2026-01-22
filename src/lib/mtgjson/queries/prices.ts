import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, hasTable, pickColumn } from "@/lib/mtgjson/schema-introspect";
import { parseJson, toNumber } from "@/lib/mtgjson/queries/shared";

export type MtgjsonCardPrice = {
  uuid: string;
  usd: number | null;
  eur: number | null;
  tix: number | null;
  date: string | null;
};

type PriceColumnMatch = {
  uuidColumn: string;
  dateColumn: string | null;
  usdColumn: string | null;
  eurColumn: string | null;
  tixColumn: string | null;
  jsonColumn: string | null;
};

type ColumnScore = {
  name: string;
  score: number;
};

const EXCLUDE_TOKENS = ["foil", "etched", "promo", "gloss"];

function scoreColumn(name: string, currency: string, providerHints: string[]) {
  const lower = name.toLowerCase();
  if (!lower.includes(currency)) return -1;
  let score = 10;
  if (providerHints.some((hint) => lower.includes(hint))) score += 6;
  if (EXCLUDE_TOKENS.some((token) => lower.includes(token))) score -= 4;
  return score;
}

function selectPriceColumn(
  columns: Set<string>,
  currency: string,
  providerHints: string[],
) {
  const scored: ColumnScore[] = [];
  for (const name of columns) {
    const score = scoreColumn(name, currency, providerHints);
    if (score >= 0) scored.push({ name, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored[0]?.name ?? null;
}

function resolvePriceColumns(): PriceColumnMatch | null {
  if (!hasTable("cardPrices")) return null;
  const columns = getTableColumns("cardPrices");
  if (!columns.size) return null;

  const uuidColumn = pickColumn("cardPrices", [
    "uuid",
    "cardUuid",
    "cardUUID",
    "cardId",
  ]);
  if (!uuidColumn) return null;

  const dateColumn = pickColumn("cardPrices", [
    "date",
    "priceDate",
    "updatedAt",
    "createdAt",
    "lastUpdated",
  ]);
  const jsonColumn = pickColumn("cardPrices", [
    "prices",
    "price",
    "priceData",
    "data",
  ]);

  const usdColumn = selectPriceColumn(columns, "usd", ["tcgplayer", "tcg"]);
  const eurColumn = selectPriceColumn(columns, "eur", ["cardmarket", "mkm"]);
  const tixColumn = selectPriceColumn(columns, "tix", ["mtgo", "cardhoarder"]);

  return {
    uuidColumn,
    dateColumn,
    usdColumn,
    eurColumn,
    tixColumn,
    jsonColumn,
  };
}

function extractCurrencyFromJson(
  value: unknown,
  currency: "usd" | "eur" | "tix",
  depth = 0,
): number | null {
  if (depth > 4) return null;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes(currency)) {
      const asNumber = toNumber(entry);
      if (asNumber !== null) return asNumber;
    }
    const nested = extractCurrencyFromJson(entry, currency, depth + 1);
    if (nested !== null) return nested;
  }

  return null;
}

export function getPriceSupport() {
  const columns = resolvePriceColumns();
  if (!columns) {
    return { usd: false, eur: false, tix: false };
  }
  const hasJson = Boolean(columns.jsonColumn);
  return {
    usd: Boolean(columns.usdColumn || hasJson),
    eur: Boolean(columns.eurColumn || hasJson),
    tix: Boolean(columns.tixColumn || hasJson),
  };
}

export function getLatestPricesByUuids(uuids: string[]) {
  const result = new Map<string, MtgjsonCardPrice>();
  if (!uuids.length) return result;

  const columns = resolvePriceColumns();
  if (!columns) return result;

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const selectParts = [`${columns.uuidColumn} as uuid`];
  if (columns.dateColumn) selectParts.push(`${columns.dateColumn} as date`);
  if (columns.usdColumn) selectParts.push(`${columns.usdColumn} as usd`);
  if (columns.eurColumn) selectParts.push(`${columns.eurColumn} as eur`);
  if (columns.tixColumn) selectParts.push(`${columns.tixColumn} as tix`);
  const needsJson =
    Boolean(columns.jsonColumn) &&
    (!columns.usdColumn || !columns.eurColumn || !columns.tixColumn);
  if (needsJson && columns.jsonColumn) {
    selectParts.push(`${columns.jsonColumn} as priceData`);
  }

  const orderClause = columns.dateColumn
    ? `ORDER BY ${columns.dateColumn} DESC`
    : "";

  const rows = db
    .prepare(
      `
        SELECT ${selectParts.join(", ")}
        FROM cardPrices
        WHERE ${columns.uuidColumn} IN (${placeholders.join(", ")})
        ${orderClause}
      `,
    )
    .all(params) as Array<{
    uuid: string;
    date?: string | null;
    usd?: unknown;
    eur?: unknown;
    tix?: unknown;
    priceData?: unknown;
  }>;

  for (const row of rows) {
    if (result.has(row.uuid)) continue;

    let usd = columns.usdColumn ? toNumber(row.usd) : null;
    let eur = columns.eurColumn ? toNumber(row.eur) : null;
    let tix = columns.tixColumn ? toNumber(row.tix) : null;

    if ((usd === null || eur === null || tix === null) && row.priceData) {
      const parsed = parseJson<Record<string, unknown> | null>(row.priceData, null);
      usd = usd ?? extractCurrencyFromJson(parsed, "usd");
      eur = eur ?? extractCurrencyFromJson(parsed, "eur");
      tix = tix ?? extractCurrencyFromJson(parsed, "tix");
    }

    result.set(row.uuid, {
      uuid: row.uuid,
      usd,
      eur,
      tix,
      date: row.date ?? null,
    });
  }

  return result;
}
