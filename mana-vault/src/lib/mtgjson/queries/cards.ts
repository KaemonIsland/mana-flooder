import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";
import { normalizeStringArray, parseJson, toNumber } from "./shared";

export type MtgjsonCard = {
  uuid: string;
  name: string;
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
  rarity: string | null;
  setCode: string | null;
  setName: string | null;
  text: string | null;
  colors: string[];
  colorIdentity: string[];
  supertypes: string[];
  types: string[];
  subtypes: string[];
  keywords: string[];
  finishes: string[];
  leadershipSkills: Record<string, boolean>;
  layout: string | null;
  side: string | null;
  number: string | null;
  artist: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
};

export type MtgjsonPrintingRow = {
  uuid: string;
  name: string;
  setCode: string | null;
  setName: string | null;
  releaseDate: string | null;
  number: string | null;
  rarity: string | null;
  finishes: string[];
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
};

export type MtgjsonCardLookup = {
  uuid: string;
  name: string;
  manaValue: number | null;
  typeLine: string | null;
  colors: string[];
  colorIdentity: string[];
  supertypes: string[];
  leadershipSkills: Record<string, boolean>;
};

type JsonValue = string | number | boolean | object | null;

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

function buildCardsSelect() {
  const cardColumns = getTableColumns("cards");
  const setColumns = getTableColumns("sets");
  const cardSetCodeColumn = pickColumn("cards", ["setCode", "set_code"]);
  const setCodeColumn = pickColumn("sets", ["code", "setCode"]);
  const textColumn = pickColumn("cards", ["text", "originalText"]);

  const joinSets =
    cardSetCodeColumn && setCodeColumn
      ? `LEFT JOIN sets s ON c.${cardSetCodeColumn} = s.${setCodeColumn}`
      : "";

  const selectParts = [
    "c.uuid as uuid",
    "c.name as name",
    selectColumn(cardColumns, "manaCost", "manaCost", "c"),
    selectColumn(cardColumns, "manaValue", "manaValue", "c"),
    selectColumn(cardColumns, "type", "typeLine", "c"),
    selectColumn(cardColumns, "rarity", "rarity", "c"),
    cardSetCodeColumn ? `c.${cardSetCodeColumn} as setCode` : "NULL as setCode",
    selectColumn(setColumns, "name", "setName", "s"),
    textColumn ? `c.${textColumn} as text` : "NULL as text",
    selectColumn(cardColumns, "colors", "colors", "c"),
    selectColumn(cardColumns, "colorIdentity", "colorIdentity", "c"),
    selectColumn(cardColumns, "supertypes", "supertypes", "c"),
    selectColumn(cardColumns, "types", "types", "c"),
    selectColumn(cardColumns, "subtypes", "subtypes", "c"),
    selectColumn(cardColumns, "keywords", "keywords", "c"),
    selectColumn(cardColumns, "finishes", "finishes", "c"),
    selectColumn(cardColumns, "leadershipSkills", "leadershipSkills", "c"),
    selectColumn(cardColumns, "layout", "layout", "c"),
    selectColumn(cardColumns, "side", "side", "c"),
    selectColumn(cardColumns, "number", "number", "c"),
    selectColumn(cardColumns, "artist", "artist", "c"),
    selectColumn(cardColumns, "power", "power", "c"),
    selectColumn(cardColumns, "toughness", "toughness", "c"),
    selectColumn(cardColumns, "loyalty", "loyalty", "c"),
  ];

  return {
    joinSets,
    select: selectParts.join(", "),
  };
}

export function getCardByUuid(uuid: string): MtgjsonCard | null {
  const cardColumns = getTableColumns("cards");
  if (!cardColumns.size) return null;

  const db = getMtgjsonDb();
  const select = buildCardsSelect();
  const row = db
    .prepare(
      `
        SELECT ${select.select}
        FROM cards c
        ${select.joinSets}
        WHERE c.uuid = ?
      `,
    )
    .get(uuid);

  if (!row) return null;

  return {
    uuid: row.uuid as string,
    name: row.name as string,
    manaCost: (row.manaCost as string | null) ?? null,
    manaValue: toNumber(row.manaValue),
    typeLine: (row.typeLine as string | null) ?? null,
    rarity: (row.rarity as string | null) ?? null,
    setCode: (row.setCode as string | null) ?? null,
    setName: (row.setName as string | null) ?? null,
    text: (row.text as string | null) ?? null,
    colors: normalizeStringArray(row.colors),
    colorIdentity: normalizeStringArray(row.colorIdentity),
    supertypes: normalizeStringArray(row.supertypes),
    types: normalizeStringArray(row.types),
    subtypes: normalizeStringArray(row.subtypes),
    keywords: normalizeStringArray(row.keywords),
    finishes: normalizeStringArray(row.finishes),
    leadershipSkills: parseJson<Record<string, boolean>>(
      row.leadershipSkills,
      {},
    ),
    layout: (row.layout as string | null) ?? null,
    side: (row.side as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    artist: (row.artist as string | null) ?? null,
    power: (row.power as string | null) ?? null,
    toughness: (row.toughness as string | null) ?? null,
    loyalty: (row.loyalty as string | null) ?? null,
  };
}

export function getCardBasicsByUuids(uuids: string[]): MtgjsonCardLookup[] {
  if (!uuids.length) return [];
  const cardColumns = getTableColumns("cards");
  if (!cardColumns.size) return [];

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const selectParts = [
    "c.uuid as uuid",
    "c.name as name",
    selectColumn(cardColumns, "manaValue", "manaValue", "c"),
    selectColumn(cardColumns, "type", "typeLine", "c"),
    selectColumn(cardColumns, "colors", "colors", "c"),
    selectColumn(cardColumns, "colorIdentity", "colorIdentity", "c"),
    selectColumn(cardColumns, "supertypes", "supertypes", "c"),
    selectColumn(cardColumns, "leadershipSkills", "leadershipSkills", "c"),
  ];

  const rows = db
    .prepare(
      `
        SELECT ${selectParts.join(", ")}
        FROM cards c
        WHERE c.uuid IN (${placeholders.join(", ")})
      `,
    )
    .all(params);

  return rows.map((row) => ({
    uuid: row.uuid as string,
    name: row.name as string,
    manaValue: toNumber(row.manaValue),
    typeLine: (row.typeLine as string | null) ?? null,
    colors: normalizeStringArray(row.colors),
    colorIdentity: normalizeStringArray(row.colorIdentity),
    supertypes: normalizeStringArray(row.supertypes),
    leadershipSkills: parseJson<Record<string, boolean>>(
      row.leadershipSkills,
      {},
    ),
  }));
}

export function getPrintingsByUuids(uuids: string[]): MtgjsonPrintingRow[] {
  if (!uuids.length) return [];
  const cardColumns = getTableColumns("cards");
  if (!cardColumns.size) return [];

  const setColumns = getTableColumns("sets");
  const cardSetCodeColumn = pickColumn("cards", ["setCode", "set_code"]);
  const setCodeColumn = pickColumn("sets", ["code", "setCode"]);
  const releaseDateColumn = pickColumn("sets", ["releaseDate"]);

  const joinSets =
    cardSetCodeColumn && setCodeColumn
      ? `LEFT JOIN sets s ON c.${cardSetCodeColumn} = s.${setCodeColumn}`
      : "";

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const selectParts = [
    "c.uuid as uuid",
    "c.name as name",
    cardSetCodeColumn ? `c.${cardSetCodeColumn} as setCode` : "NULL as setCode",
    selectColumn(setColumns, "name", "setName", "s"),
    releaseDateColumn ? `s.${releaseDateColumn} as releaseDate` : "NULL as releaseDate",
    selectColumn(cardColumns, "number", "number", "c"),
    selectColumn(cardColumns, "rarity", "rarity", "c"),
    selectColumn(cardColumns, "finishes", "finishes", "c"),
    selectColumn(cardColumns, "manaCost", "manaCost", "c"),
    selectColumn(cardColumns, "manaValue", "manaValue", "c"),
    selectColumn(cardColumns, "type", "typeLine", "c"),
  ];

  const rows = db
    .prepare(
      `
        SELECT ${selectParts.join(", ")}
        FROM cards c
        ${joinSets}
        WHERE c.uuid IN (${placeholders.join(", ")})
      `,
    )
    .all(params);

  return rows.map((row) => ({
    uuid: row.uuid as string,
    name: row.name as string,
    setCode: (row.setCode as string | null) ?? null,
    setName: (row.setName as string | null) ?? null,
    releaseDate: (row.releaseDate as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    rarity: (row.rarity as string | null) ?? null,
    finishes: normalizeStringArray(row.finishes),
    manaCost: (row.manaCost as string | null) ?? null,
    manaValue: toNumber(row.manaValue),
    typeLine: (row.typeLine as string | null) ?? null,
  }));
}

export function getCardTokenIds(uuid: string): string[] {
  const cardColumns = getTableColumns("cards");
  if (!cardColumns.size) return [];
  const tokenColumn = pickColumn("cards", ["tokenIds", "tokens"]);
  if (!tokenColumn) return [];

  const db = getMtgjsonDb();
  const row = db
    .prepare(`SELECT ${tokenColumn} as tokenIds FROM cards WHERE uuid = ?`)
    .get(uuid) as { tokenIds?: JsonValue } | undefined;

  return normalizeStringArray(row?.tokenIds ?? null);
}
