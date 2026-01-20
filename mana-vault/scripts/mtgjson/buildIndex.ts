import Database from "better-sqlite3";
import { readFile, stat } from "node:fs/promises";
import {
  APP_DB_PATH,
  MTGJSON_DB_PATH,
  MTGJSON_META_PATH,
  ensureParentDir,
} from "./utils";

type JsonValue = string | number | boolean | object | null;

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

function normalizeColorString(value: unknown) {
  const colors = normalizeStringArray(value);
  return colors.sort().join("");
}

function safeLower(value: string | null) {
  return value?.toLowerCase() ?? "";
}

async function main() {
  await ensureParentDir(APP_DB_PATH);

  const mtgDb = new Database(MTGJSON_DB_PATH, { readonly: true });
  const appDb = new Database(APP_DB_PATH);

  appDb.pragma("journal_mode = WAL");

  appDb.exec(`
    CREATE TABLE IF NOT EXISTS search_cards (
      id INTEGER PRIMARY KEY,
      card_uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      set_code TEXT NOT NULL,
      set_name TEXT,
      mana_cost TEXT,
      mana_value REAL,
      type_line TEXT,
      rarity TEXT,
      colors TEXT,
      color_identity TEXT,
      supertypes TEXT,
      types TEXT,
      text TEXT,
      is_legendary INTEGER,
      is_basic INTEGER,
      is_commander INTEGER,
      legal_commander TEXT,
      is_banned_commander INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_search_cards_set ON search_cards(set_code);
    CREATE INDEX IF NOT EXISTS idx_search_cards_rarity ON search_cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_search_cards_mana_value ON search_cards(mana_value);
    CREATE INDEX IF NOT EXISTS idx_search_cards_colors ON search_cards(colors);
    CREATE INDEX IF NOT EXISTS idx_search_cards_color_identity ON search_cards(color_identity);
    CREATE INDEX IF NOT EXISTS idx_search_cards_commander ON search_cards(is_commander);
    CREATE INDEX IF NOT EXISTS idx_search_cards_legendary ON search_cards(is_legendary);
    CREATE INDEX IF NOT EXISTS idx_search_cards_basic ON search_cards(is_basic);
    DROP TABLE IF EXISTS search_cards_fts;
    CREATE VIRTUAL TABLE search_cards_fts USING fts5(
      name,
      type_line,
      text,
      content='search_cards',
      content_rowid='id'
    );
  `);

  appDb.exec("DELETE FROM search_cards");

  const insertCard = appDb.prepare(`
    INSERT INTO search_cards (
      card_uuid,
      name,
      set_code,
      set_name,
      mana_cost,
      mana_value,
      type_line,
      rarity,
      colors,
      color_identity,
      supertypes,
      types,
      text,
      is_legendary,
      is_basic,
      is_commander,
      legal_commander,
      is_banned_commander
    ) VALUES (
      @cardUuid,
      @name,
      @setCode,
      @setName,
      @manaCost,
      @manaValue,
      @typeLine,
      @rarity,
      @colors,
      @colorIdentity,
      @supertypes,
      @types,
      @text,
      @isLegendary,
      @isBasic,
      @isCommander,
      @legalCommander,
      @isBannedCommander
    )
  `);

  const insertFts = appDb.prepare(`
    INSERT INTO search_cards_fts (rowid, name, type_line, text)
    VALUES (@rowId, @name, @typeLine, @text)
  `);

  const rows = mtgDb.prepare(`
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
      c.leadershipSkills,
      c.legalities,
      s.name as setName
    FROM cards c
    LEFT JOIN sets s ON c.setCode = s.code
  `);

  let count = 0;
  const insertAll = appDb.transaction(() => {
    for (const row of rows.iterate()) {
      const supertypes = normalizeStringArray(row.supertypes);
      const types = normalizeStringArray(row.types);
      const typeLine = (row.type as string | null) ?? "";
      const isLegendary = supertypes.includes("Legendary") ? 1 : 0;
      const isBasic = supertypes.includes("Basic") ? 1 : 0;

      const leadershipSkills = parseJson<Record<string, boolean>>(
        row.leadershipSkills,
        {},
      );
      const leadershipCommander = leadershipSkills?.commander === true;
      const fallbackCommander =
        isLegendary === 1 && typeLine.toLowerCase().includes("creature");

      const legalities = parseJson<Record<string, string>>(row.legalities, {});
      const legalCommander = legalities.commander ?? "Unknown";
      const isBannedCommander = safeLower(legalCommander) === "banned" ? 1 : 0;

      const card = {
        cardUuid: row.uuid,
        name: row.name,
        setCode: row.setCode,
        setName: row.setName ?? null,
        manaCost: row.manaCost ?? null,
        manaValue:
          typeof row.manaValue === "number"
            ? row.manaValue
            : row.manaValue
              ? Number(row.manaValue)
              : null,
        typeLine: row.type ?? null,
        rarity: row.rarity ?? null,
        colors: normalizeColorString(row.colors),
        colorIdentity: normalizeColorString(row.colorIdentity),
        supertypes: supertypes.join(","),
        types: types.join(","),
        text: row.text ?? "",
        isLegendary,
        isBasic,
        isCommander: leadershipCommander || fallbackCommander ? 1 : 0,
        legalCommander,
        isBannedCommander,
      };

      const info = insertCard.run(card);
      insertFts.run({
        rowId: info.lastInsertRowid,
        name: card.name,
        typeLine: card.typeLine ?? "",
        text: card.text ?? "",
      });
      count += 1;

      if (count % 5000 === 0) {
        console.log(`Indexed ${count} cards...`);
      }
    }
  });

  console.log("Building search index...");
  insertAll();
  console.log(`Indexed ${count} cards.`);

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
