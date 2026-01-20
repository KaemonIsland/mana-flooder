import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";
import { normalizeStringArray } from "./shared";
import { getCardTokenIds } from "./cards";

export type MtgjsonToken = {
  uuid: string;
  name: string;
  typeLine: string | null;
  text: string | null;
  colors: string[];
  colorIdentity: string[];
  setCode: string | null;
  setName: string | null;
  power: string | null;
  toughness: string | null;
  layout: string | null;
  side: string | null;
  number: string | null;
  releaseDate: string | null;
};

function buildTokenSelect() {
  const tokenColumns = getTableColumns("tokens");
  const setColumns = getTableColumns("sets");
  const tokenSetCodeColumn = pickColumn("tokens", ["setCode", "set_code"]);
  const setCodeColumn = pickColumn("sets", ["code", "setCode"]);
  const releaseDateColumn = pickColumn("sets", ["releaseDate"]);

  const joinSets =
    tokenSetCodeColumn && setCodeColumn
      ? `LEFT JOIN sets s ON t.${tokenSetCodeColumn} = s.${setCodeColumn}`
      : "";

  const selectParts = [
    "t.uuid as uuid",
    "t.name as name",
    tokenColumns.has("type") ? "t.type as typeLine" : "NULL as typeLine",
    tokenColumns.has("text") ? "t.text as text" : "NULL as text",
    tokenColumns.has("colors") ? "t.colors as colors" : "NULL as colors",
    tokenColumns.has("colorIdentity")
      ? "t.colorIdentity as colorIdentity"
      : "NULL as colorIdentity",
    tokenSetCodeColumn ? `t.${tokenSetCodeColumn} as setCode` : "NULL as setCode",
    setColumns.has("name") ? "s.name as setName" : "NULL as setName",
    tokenColumns.has("power") ? "t.power as power" : "NULL as power",
    tokenColumns.has("toughness") ? "t.toughness as toughness" : "NULL as toughness",
    tokenColumns.has("layout") ? "t.layout as layout" : "NULL as layout",
    tokenColumns.has("side") ? "t.side as side" : "NULL as side",
    tokenColumns.has("number") ? "t.number as number" : "NULL as number",
    releaseDateColumn ? `s.${releaseDateColumn} as releaseDate` : "NULL as releaseDate",
  ];

  return { joinSets, select: selectParts.join(", ") };
}

export function getTokensByUuids(uuids: string[]): MtgjsonToken[] {
  if (!uuids.length) return [];
  const tokenColumns = getTableColumns("tokens");
  if (!tokenColumns.size || !tokenColumns.has("uuid")) return [];

  const db = getMtgjsonDb();
  const params: Record<string, string> = {};
  const placeholders = uuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const select = buildTokenSelect();
  const rows = db
    .prepare(
      `
        SELECT ${select.select}
        FROM tokens t
        ${select.joinSets}
        WHERE t.uuid IN (${placeholders.join(", ")})
      `,
    )
    .all(params);

  return rows.map((row) => ({
    uuid: row.uuid as string,
    name: row.name as string,
    typeLine: (row.typeLine as string | null) ?? null,
    text: (row.text as string | null) ?? null,
    colors: normalizeStringArray(row.colors),
    colorIdentity: normalizeStringArray(row.colorIdentity),
    setCode: (row.setCode as string | null) ?? null,
    setName: (row.setName as string | null) ?? null,
    power: (row.power as string | null) ?? null,
    toughness: (row.toughness as string | null) ?? null,
    layout: (row.layout as string | null) ?? null,
    side: (row.side as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    releaseDate: (row.releaseDate as string | null) ?? null,
  }));
}

export function getTokensForCard(uuid: string): MtgjsonToken[] {
  const tokenIds = getCardTokenIds(uuid);
  if (!tokenIds.length) return [];
  return getTokensByUuids(tokenIds);
}
