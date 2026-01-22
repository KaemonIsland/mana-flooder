import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getSearchDb } from "@/lib/search/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";
import { normalizeStringArray, toNumber } from "./queries/shared";

export type CanonicalPrinting = {
  canonicalKey: string;
  representativeUuid: string;
  name: string;
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
  text: string | null;
  colors: string[];
  colorIdentity: string[];
  rarity: string | null;
  latestSetCode: string | null;
  latestReleaseDate: string | null;
  keywords: string[];
};

export type CanonicalPrintingRef = {
  uuid: string;
  setCode: string | null;
  releaseDate: string | null;
};

function normalizeName(value: string) {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || trimmed;
}

function getCanonicalKeyFromSearchDb(uuid: string): string | null {
  try {
    const db = getSearchDb();
    const row = db
      .prepare(
        "SELECT canonicalKey FROM card_search_printings WHERE uuid = ? LIMIT 1",
      )
      .get(uuid) as { canonicalKey?: string } | undefined;
    return row?.canonicalKey ?? null;
  } catch {
    return null;
  }
}

function getCanonicalKeyFromMtgjson(uuid: string): string | null {
  const cardColumns = getTableColumns("cards");
  if (!cardColumns.size || !cardColumns.has("uuid")) return null;

  const identifierColumns = getTableColumns("cardIdentifiers");
  const textColumn = pickColumn("cards", ["text", "originalText"]);
  const joinIdentifiers = identifierColumns.size
    ? "LEFT JOIN cardIdentifiers ci ON c.uuid = ci.uuid"
    : "";

  const selectParts = [
    "c.uuid as uuid",
    "c.name as name",
    cardColumns.has("asciiName") ? "c.asciiName as asciiName" : "NULL as asciiName",
    cardColumns.has("layout") ? "c.layout as layout" : "NULL as layout",
    cardColumns.has("side") ? "c.side as side" : "NULL as side",
    identifierColumns.has("scryfallOracleId")
      ? "ci.scryfallOracleId as scryfallOracleId"
      : "NULL as scryfallOracleId",
    identifierColumns.has("oracleId")
      ? "ci.oracleId as identifierOracleId"
      : "NULL as identifierOracleId",
    cardColumns.has("oracleId")
      ? "c.oracleId as cardOracleId"
      : "NULL as cardOracleId",
    textColumn ? `c.${textColumn} as text` : "NULL as text",
  ];

  const db = getMtgjsonDb();
  const row = db
    .prepare(
      `
        SELECT ${selectParts.join(", ")}
        FROM cards c
        ${joinIdentifiers}
        WHERE c.uuid = ?
      `,
    )
    .get(uuid) as
    | {
        uuid: string;
        name: string;
        asciiName?: string | null;
        layout?: string | null;
        side?: string | null;
        scryfallOracleId?: string | null;
        identifierOracleId?: string | null;
        cardOracleId?: string | null;
      }
    | undefined;

  if (!row) return null;

  const oracleId =
    row.scryfallOracleId ?? row.identifierOracleId ?? row.cardOracleId ?? null;
  if (oracleId) return String(oracleId);

  const fallbackName = normalizeName(row.asciiName ?? row.name ?? row.uuid);
  const layout = (row.layout ?? "unknown").toString().toLowerCase() || "unknown";
  const side = (row.side ?? "front").toString().toLowerCase() || "front";
  return `${fallbackName}::${layout}::${side}`;
}

export function getCanonicalKeyForUuid(uuid: string): string | null {
  return getCanonicalKeyFromSearchDb(uuid) ?? getCanonicalKeyFromMtgjson(uuid);
}

export function getRepresentativePrintingForCanonicalKey(
  canonicalKey: string,
): CanonicalPrinting | null {
  try {
    const db = getSearchDb();
    const row = db
      .prepare(
        `
          SELECT
            canonicalKey,
            representativeUuid,
            name,
            manaCost,
            manaValue,
            type,
            text,
            colors,
            colorIdentity,
            rarity,
            latestSetCode,
            latestReleaseDate,
            keywords
          FROM card_search
          WHERE canonicalKey = ?
          LIMIT 1
        `,
      )
      .get(canonicalKey) as
      | {
          canonicalKey: string;
          representativeUuid: string;
          name: string;
          manaCost?: string | null;
          manaValue?: number | null;
          type?: string | null;
          text?: string | null;
          colors?: string | null;
          colorIdentity?: string | null;
          rarity?: string | null;
          latestSetCode?: string | null;
          latestReleaseDate?: string | null;
          keywords?: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      canonicalKey: row.canonicalKey,
      representativeUuid: row.representativeUuid,
      name: row.name,
      manaCost: row.manaCost ?? null,
      manaValue: toNumber(row.manaValue),
      typeLine: row.type ?? null,
      text: row.text ?? null,
      colors: normalizeStringArray(row.colors ?? null),
      colorIdentity: normalizeStringArray(row.colorIdentity ?? null),
      rarity: row.rarity ?? null,
      latestSetCode: row.latestSetCode ?? null,
      latestReleaseDate: row.latestReleaseDate ?? null,
      keywords: normalizeStringArray(row.keywords ?? null),
    };
  } catch {
    return null;
  }
}

export function getCanonicalPrintingsForKeys(
  canonicalKeys: string[],
): CanonicalPrinting[] {
  if (!canonicalKeys.length) return [];
  try {
    const db = getSearchDb();
    const params: Record<string, string> = {};
    const placeholders = canonicalKeys.map((key, index) => {
      const param = `key_${index}`;
      params[param] = key;
      return `@${param}`;
    });

    const rows = db
      .prepare(
        `
          SELECT
            canonicalKey,
            representativeUuid,
            name,
            manaCost,
            manaValue,
            type,
            text,
            colors,
            colorIdentity,
            rarity,
            latestSetCode,
            latestReleaseDate,
            keywords
          FROM card_search
          WHERE canonicalKey IN (${placeholders.join(", ")})
        `,
      )
      .all(params) as Array<{
      canonicalKey: string;
      representativeUuid: string;
      name: string;
      manaCost?: string | null;
      manaValue?: number | null;
      type?: string | null;
      text?: string | null;
      colors?: string | null;
      colorIdentity?: string | null;
      rarity?: string | null;
      latestSetCode?: string | null;
      latestReleaseDate?: string | null;
      keywords?: string | null;
    }>;

    return rows.map((row) => ({
      canonicalKey: row.canonicalKey,
      representativeUuid: row.representativeUuid,
      name: row.name,
      manaCost: row.manaCost ?? null,
      manaValue: toNumber(row.manaValue),
      typeLine: row.type ?? null,
      text: row.text ?? null,
      colors: normalizeStringArray(row.colors ?? null),
      colorIdentity: normalizeStringArray(row.colorIdentity ?? null),
      rarity: row.rarity ?? null,
      latestSetCode: row.latestSetCode ?? null,
      latestReleaseDate: row.latestReleaseDate ?? null,
      keywords: normalizeStringArray(row.keywords ?? null),
    }));
  } catch {
    return [];
  }
}

export function getAllPrintingsForCanonicalKey(
  canonicalKey: string,
): CanonicalPrintingRef[] {
  try {
    const db = getSearchDb();
    const rows = db
      .prepare(
        `
          SELECT uuid, setCode, releaseDate
          FROM card_search_printings
          WHERE canonicalKey = ?
          ORDER BY releaseDate DESC, setCode ASC
        `,
      )
      .all(canonicalKey) as Array<{
      uuid: string;
      setCode: string | null;
      releaseDate: string | null;
    }>;

    return rows.map((row) => ({
      uuid: row.uuid,
      setCode: row.setCode ?? null,
      releaseDate: row.releaseDate ?? null,
    }));
  } catch {
    return [];
  }
}
