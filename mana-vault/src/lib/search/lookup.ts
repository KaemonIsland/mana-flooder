import { getSearchDb } from "@/lib/search/db";

export type CardLookup = {
  cardUuid: string;
  name: string;
  colorIdentity: string;
  typeLine: string | null;
  manaValue: number | null;
  colors: string;
  isBasic: boolean;
  isLegendary: boolean;
  isCommander: boolean;
  legalCommander: string | null;
  isBannedCommander: boolean;
};

export function getCardLookups(cardUuids: string[]): CardLookup[] {
  if (!cardUuids.length) return [];
  let db;
  try {
    db = getSearchDb();
  } catch {
    return [];
  }

  const params: Record<string, string> = {};
  const placeholders = cardUuids.map((uuid, index) => {
    const key = `uuid_${index}`;
    params[key] = uuid;
    return `@${key}`;
  });

  const query = `
    SELECT
      card_uuid as cardUuid,
      name,
      color_identity as colorIdentity,
      type_line as typeLine,
      mana_value as manaValue,
      colors,
      is_basic as isBasic,
      is_legendary as isLegendary,
      is_commander as isCommander,
      legal_commander as legalCommander,
      is_banned_commander as isBannedCommander
    FROM search_cards
    WHERE card_uuid IN (${placeholders.join(", ")})
  `;

  return db.prepare(query).all(params) as CardLookup[];
}
