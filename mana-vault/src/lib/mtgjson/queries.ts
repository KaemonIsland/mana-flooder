import { getMtgjsonDb } from "@/lib/mtgjson/db";

export type MtgjsonCardDetails = {
  uuid: string;
  name: string;
  manaCost: string | null;
  manaValue: number | null;
  type: string | null;
  rarity: string | null;
  setCode: string | null;
  setName: string | null;
  text: string | null;
  colors: string[];
  colorIdentity: string[];
  supertypes: string[];
  types: string[];
  subtypes: string[];
  legalities: Record<string, string>;
  leadershipSkills: Record<string, boolean>;
  identifiers: Record<string, string>;
  artist: string | null;
  number: string | null;
  power: string | null;
  toughness: string | null;
  oracleId: string | null;
};

export type MtgjsonPrinting = {
  uuid: string;
  setCode: string;
  setName: string | null;
  rarity: string | null;
  number: string | null;
  releaseDate: string | null;
};

export type MtgjsonSetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
};

type JsonValue = string | number | boolean | object | null;

const emptyArray: string[] = [];
const emptyRecord: Record<string, string> = {};
const emptyBoolRecord: Record<string, boolean> = {};

function parseJson<T extends JsonValue>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    return (value as T) ?? fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeStringArray(value: unknown): string[] {
  const parsed = parseJson<JsonValue>(value, null);
  if (!parsed) return emptyArray;
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map((entry) => String(entry));
  }
  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return emptyArray;
}

export function getCardDetailsByUuid(uuid: string): MtgjsonCardDetails | null {
  const db = getMtgjsonDb();
  const row = db
    .prepare(
      `
        SELECT
          c.uuid,
          c.name,
          c.manaCost,
          c.manaValue,
          c.type,
          c.rarity,
          c.setCode,
          c.text,
          c.colors,
          c.colorIdentity,
          c.supertypes,
          c.types,
          c.subtypes,
          c.legalities,
          c.leadershipSkills,
          c.identifiers,
          c.artist,
          c.number,
          c.power,
          c.toughness,
          c.oracleId,
          s.name as setName
        FROM cards c
        LEFT JOIN sets s ON c.setCode = s.code
        WHERE c.uuid = ?
      `,
    )
    .get(uuid);

  if (!row) {
    return null;
  }

  return {
    uuid: row.uuid as string,
    name: row.name as string,
    manaCost: (row.manaCost as string | null) ?? null,
    manaValue:
      typeof row.manaValue === "number"
        ? (row.manaValue as number)
        : row.manaValue
          ? Number(row.manaValue)
          : null,
    type: (row.type as string | null) ?? null,
    rarity: (row.rarity as string | null) ?? null,
    setCode: (row.setCode as string | null) ?? null,
    setName: (row.setName as string | null) ?? null,
    text: (row.text as string | null) ?? null,
    colors: normalizeStringArray(row.colors),
    colorIdentity: normalizeStringArray(row.colorIdentity),
    supertypes: normalizeStringArray(row.supertypes),
    types: normalizeStringArray(row.types),
    subtypes: normalizeStringArray(row.subtypes),
    legalities: parseJson<Record<string, string>>(row.legalities, emptyRecord),
    leadershipSkills: parseJson<Record<string, boolean>>(
      row.leadershipSkills,
      emptyBoolRecord,
    ),
    identifiers: parseJson<Record<string, string>>(
      row.identifiers,
      emptyRecord,
    ),
    artist: (row.artist as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    power: (row.power as string | null) ?? null,
    toughness: (row.toughness as string | null) ?? null,
    oracleId: (row.oracleId as string | null) ?? null,
  };
}

export function getCardPrintings(
  oracleId: string | null,
  name: string,
): MtgjsonPrinting[] {
  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT
          c.uuid,
          c.setCode,
          c.rarity,
          c.number,
          s.name as setName,
          s.releaseDate as releaseDate
        FROM cards c
        LEFT JOIN sets s ON c.setCode = s.code
        WHERE (? IS NOT NULL AND c.oracleId = ?)
           OR (? IS NULL AND c.name = ?)
        ORDER BY s.releaseDate DESC, c.setCode ASC
      `,
    )
    .all(oracleId, oracleId, oracleId, name);

  return rows.map((row) => ({
    uuid: row.uuid as string,
    setCode: row.setCode as string,
    rarity: (row.rarity as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    setName: (row.setName as string | null) ?? null,
    releaseDate: (row.releaseDate as string | null) ?? null,
  }));
}

export function getSetSummaries(): MtgjsonSetSummary[] {
  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT code, name, releaseDate, type
        FROM sets
        ORDER BY releaseDate DESC
      `,
    )
    .all();

  return rows.map((row) => ({
    code: row.code as string,
    name: row.name as string,
    releaseDate: (row.releaseDate as string | null) ?? null,
    type: (row.type as string | null) ?? null,
  }));
}
