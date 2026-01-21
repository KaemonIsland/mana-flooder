import Database from "better-sqlite3";
import { readFile, stat } from "node:fs/promises";
import {
  APP_DB_PATH,
  MTGJSON_DB_PATH,
  MTGJSON_META_PATH,
  ensureParentDir,
} from "./utils";

type JsonValue = string | number | boolean | object | null;

type GroupedCard = {
  canonicalKey: string;
  representativeUuid: string;
  name: string;
  asciiName: string | null;
  manaValue: number | null;
  manaCost: string | null;
  typeLine: string | null;
  text: string | null;
  colors: string;
  colorIdentity: string;
  rarity: string | null;
  latestSetCode: string | null;
  latestReleaseDate: string | null;
  keywords: string;
  normalizedName: string | null;
};

function parseJson<T extends JsonValue>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeStringArray(value: unknown): string[] {
  const parsed = parseJson<JsonValue>(value, null);
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map((entry) => String(entry));
  }
  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function toJsonArrayString(value: unknown) {
  const values = normalizeStringArray(value);
  values.sort();
  return JSON.stringify(values);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeName(value: string) {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || trimmed;
}

function tableExists(db: Database.Database, tableName: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function getTableColumns(db: Database.Database, tableName: string) {
  if (!tableExists(db, tableName)) return new Set<string>();
  const rows = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

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

function compareReleaseDate(next: string | null, current: string | null) {
  if (next && current) return next > current;
  if (next && !current) return true;
  return false;
}

function getCanonicalKey(row: {
  uuid: string;
  name: string | null;
  asciiName: string | null;
  layout: string | null;
  side: string | null;
  scryfallOracleId: string | null;
  identifierOracleId: string | null;
  cardOracleId: string | null;
}) {
  const oracleId =
    row.scryfallOracleId ??
    row.identifierOracleId ??
    row.cardOracleId ??
    null;
  if (oracleId) return String(oracleId);

  const fallbackName = normalizeName(row.asciiName ?? row.name ?? row.uuid);
  const layout = (row.layout ?? "unknown").toString().toLowerCase() || "unknown";
  const side = (row.side ?? "front").toString().toLowerCase() || "front";
  return `${fallbackName}::${layout}::${side}`;
}

async function main() {
  await ensureParentDir(APP_DB_PATH);

  const mtgDb = new Database(MTGJSON_DB_PATH, { readonly: true });
  const appDb = new Database(APP_DB_PATH);

  appDb.pragma("journal_mode = WAL");

  appDb.exec(`
    DROP TABLE IF EXISTS search_cards;
    DROP TABLE IF EXISTS search_cards_fts;

    CREATE TABLE IF NOT EXISTS card_search (
      canonicalKey TEXT PRIMARY KEY,
      representativeUuid TEXT NOT NULL,
      name TEXT NOT NULL,
      asciiName TEXT,
      manaValue REAL,
      manaCost TEXT,
      type TEXT,
      text TEXT,
      colors TEXT,
      colorIdentity TEXT,
      rarity TEXT,
      latestSetCode TEXT,
      latestReleaseDate TEXT,
      keywords TEXT,
      normalizedName TEXT
    );

    CREATE TABLE IF NOT EXISTS card_search_printings (
      canonicalKey TEXT NOT NULL,
      uuid TEXT NOT NULL,
      setCode TEXT,
      releaseDate TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_card_search_name ON card_search(name);
    CREATE INDEX IF NOT EXISTS idx_card_search_ascii_name ON card_search(asciiName);
    CREATE INDEX IF NOT EXISTS idx_card_search_latest_release ON card_search(latestReleaseDate);
    CREATE INDEX IF NOT EXISTS idx_card_search_latest_set ON card_search(latestSetCode);
    CREATE INDEX IF NOT EXISTS idx_card_search_printings_key ON card_search_printings(canonicalKey);
    CREATE INDEX IF NOT EXISTS idx_card_search_printings_uuid ON card_search_printings(uuid);

    DROP TABLE IF EXISTS card_search_fts;
    CREATE VIRTUAL TABLE card_search_fts USING fts5(
      name,
      type,
      text,
      canonicalKey UNINDEXED,
      representativeUuid UNINDEXED
    );
  `);

  appDb.exec("DELETE FROM card_search");
  appDb.exec("DELETE FROM card_search_printings");
  appDb.exec("DELETE FROM card_search_fts");

  const insertPrinting = appDb.prepare(`
    INSERT INTO card_search_printings (
      canonicalKey,
      uuid,
      setCode,
      releaseDate
    ) VALUES (
      @canonicalKey,
      @uuid,
      @setCode,
      @releaseDate
    )
  `);

  const insertCard = appDb.prepare(`
    INSERT INTO card_search (
      canonicalKey,
      representativeUuid,
      name,
      asciiName,
      manaValue,
      manaCost,
      type,
      text,
      colors,
      colorIdentity,
      rarity,
      latestSetCode,
      latestReleaseDate,
      keywords,
      normalizedName
    ) VALUES (
      @canonicalKey,
      @representativeUuid,
      @name,
      @asciiName,
      @manaValue,
      @manaCost,
      @typeLine,
      @text,
      @colors,
      @colorIdentity,
      @rarity,
      @latestSetCode,
      @latestReleaseDate,
      @keywords,
      @normalizedName
    )
  `);

  const insertFts = appDb.prepare(`
    INSERT INTO card_search_fts (
      name,
      type,
      text,
      canonicalKey,
      representativeUuid
    ) VALUES (
      @name,
      @typeLine,
      @text,
      @canonicalKey,
      @representativeUuid
    )
  `);

  const cardsColumns = getTableColumns(mtgDb, "cards");
  if (!cardsColumns.size) {
    throw new Error("cards table not found in MTGJSON database.");
  }

  const setsColumns = getTableColumns(mtgDb, "sets");
  const identifiersColumns = getTableColumns(mtgDb, "cardIdentifiers");

  const cardSetCodeColumn = cardsColumns.has("setCode")
    ? "setCode"
    : cardsColumns.has("set_code")
      ? "set_code"
      : null;
  const setCodeColumn = setsColumns.has("code")
    ? "code"
    : setsColumns.has("setCode")
      ? "setCode"
      : null;
  const releaseDateColumn = setsColumns.has("releaseDate")
    ? "releaseDate"
    : null;
  const textColumn = cardsColumns.has("text")
    ? "text"
    : cardsColumns.has("originalText")
      ? "originalText"
      : null;

  const joinSets =
    cardSetCodeColumn && setCodeColumn
      ? `LEFT JOIN sets s ON c.${cardSetCodeColumn} = s.${setCodeColumn}`
      : "";
  const joinIdentifiers = identifiersColumns.size
    ? "LEFT JOIN cardIdentifiers ci ON c.uuid = ci.uuid"
    : "";

  const selectParts = [
    "c.uuid as uuid",
    "c.name as name",
    selectColumn(cardsColumns, "asciiName", "asciiName", "c"),
    selectColumn(cardsColumns, "manaCost", "manaCost", "c"),
    selectColumn(cardsColumns, "manaValue", "manaValue", "c"),
    selectColumn(cardsColumns, "type", "typeLine", "c"),
    textColumn ? `c.${textColumn} as text` : "NULL as text",
    selectColumn(cardsColumns, "colors", "colors", "c"),
    selectColumn(cardsColumns, "colorIdentity", "colorIdentity", "c"),
    selectColumn(cardsColumns, "rarity", "rarity", "c"),
    cardSetCodeColumn ? `c.${cardSetCodeColumn} as setCode` : "NULL as setCode",
    selectColumn(cardsColumns, "keywords", "keywords", "c"),
    selectColumn(cardsColumns, "layout", "layout", "c"),
    selectColumn(cardsColumns, "side", "side", "c"),
    selectColumn(identifiersColumns, "scryfallOracleId", "scryfallOracleId", "ci"),
    selectColumn(identifiersColumns, "oracleId", "identifierOracleId", "ci"),
    selectColumn(cardsColumns, "oracleId", "cardOracleId", "c"),
    releaseDateColumn ? `s.${releaseDateColumn} as releaseDate` : "NULL as releaseDate",
  ];

  const query = `
    SELECT ${selectParts.join(", ")}
    FROM cards c
    ${joinIdentifiers}
    ${joinSets}
  `;
  const rows = mtgDb.prepare(query);

  const groups = new Map<string, GroupedCard>();
  let count = 0;

  const insertAll = appDb.transaction(() => {
    for (const row of rows.iterate()) {
      const canonicalKey = getCanonicalKey({
        uuid: row.uuid,
        name: row.name ?? null,
        asciiName: row.asciiName ?? null,
        layout: row.layout ?? null,
        side: row.side ?? null,
        scryfallOracleId: row.scryfallOracleId ?? null,
        identifierOracleId: row.identifierOracleId ?? null,
        cardOracleId: row.cardOracleId ?? null,
      });

      const releaseDate = row.releaseDate ? String(row.releaseDate) : null;
      insertPrinting.run({
        canonicalKey,
        uuid: row.uuid,
        setCode: row.setCode ?? null,
        releaseDate,
      });

      const existing = groups.get(canonicalKey);
      const shouldReplace = compareReleaseDate(
        releaseDate,
        existing?.latestReleaseDate ?? null,
      );

      if (!existing || shouldReplace) {
        const name = String(row.name ?? "");
        const asciiName =
          row.asciiName !== null && row.asciiName !== undefined
            ? String(row.asciiName)
            : null;
        const normalizedName = normalizeName(asciiName ?? name);

        const rarity =
          row.rarity !== null && row.rarity !== undefined
            ? String(row.rarity).toLowerCase()
            : null;

        groups.set(canonicalKey, {
          canonicalKey,
          representativeUuid: row.uuid,
          name,
          asciiName,
          manaValue: toNumber(row.manaValue),
          manaCost: row.manaCost ?? null,
          typeLine: row.typeLine ?? null,
          text: row.text ?? null,
          colors: toJsonArrayString(row.colors),
          colorIdentity: toJsonArrayString(row.colorIdentity),
          rarity,
          latestSetCode: row.setCode ?? null,
          latestReleaseDate: releaseDate,
          keywords: toJsonArrayString(row.keywords),
          normalizedName,
        });
      }

      count += 1;
      if (count % 5000 === 0) {
        console.log(`Indexed ${count} printings...`);
      }
    }
  });

  console.log("Building canonical search index...");
  insertAll();
  console.log(`Processed ${count} printings.`);

  const insertGrouped = appDb.transaction(() => {
    for (const card of groups.values()) {
      insertCard.run({
        canonicalKey: card.canonicalKey,
        representativeUuid: card.representativeUuid,
        name: card.name,
        asciiName: card.asciiName,
        manaValue: card.manaValue,
        manaCost: card.manaCost,
        typeLine: card.typeLine ?? "",
        text: card.text ?? "",
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        rarity: card.rarity,
        latestSetCode: card.latestSetCode,
        latestReleaseDate: card.latestReleaseDate,
        keywords: card.keywords,
        normalizedName: card.normalizedName,
      });
      insertFts.run({
        name: card.name,
        typeLine: card.typeLine ?? "",
        text: card.text ?? "",
        canonicalKey: card.canonicalKey,
        representativeUuid: card.representativeUuid,
      });
    }
  });

  insertGrouped();
  console.log(`Indexed ${groups.size} canonical cards.`);

  try {
    const metaRaw = await readFile(MTGJSON_META_PATH, "utf-8");
    const meta = JSON.parse(metaRaw) as Record<string, unknown>;
    const mtgjsonBuildDate =
      (meta.date as string | undefined) ??
      (meta.data as { date?: string } | undefined)?.date ??
      null;
    const mtgjsonVersion =
      (meta.version as string | undefined) ??
      (meta.data as { version?: string } | undefined)?.version ??
      null;
    const fileStats = await stat(MTGJSON_DB_PATH);
    const now = new Date().toISOString();

    const settings = appDb
      .prepare("SELECT id FROM AppSetting LIMIT 1")
      .get() as { id?: string } | undefined;

    if (settings?.id) {
      appDb
        .prepare(
          `
          UPDATE AppSetting
          SET mtgjsonBuildDate = ?,
              mtgjsonVersion = ?,
              importStatus = ?,
              lastImportAt = ?,
              searchIndexUpdatedAt = ?,
              mtgjsonFileSize = ?,
              updatedAt = ?
          WHERE id = ?
        `,
        )
        .run(
          mtgjsonBuildDate,
          mtgjsonVersion,
          "complete",
          now,
          now,
          fileStats.size,
          now,
          settings.id,
        );
    } else {
      appDb
        .prepare(
          `
          INSERT INTO AppSetting (
            id,
            mtgjsonBuildDate,
            mtgjsonVersion,
            importStatus,
            lastImportAt,
            searchIndexUpdatedAt,
            mtgjsonFileSize,
            createdAt,
            updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          "app",
          mtgjsonBuildDate,
          mtgjsonVersion,
          "complete",
          now,
          now,
          fileStats.size,
          now,
          now,
        );
    }
  } catch (error) {
    console.warn("Skipping AppSetting update:", error);
  }

  mtgDb.close();
  appDb.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
