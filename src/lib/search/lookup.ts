import { getCardBasicsByUuids } from "@/lib/mtgjson/queries/cards";
import { getCommanderLegalitiesForUuids } from "@/lib/mtgjson/queries/legalities";

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
  const basics = getCardBasicsByUuids(cardUuids);
  const legalities = getCommanderLegalitiesForUuids(cardUuids);

  const normalizeColors = (values: string[]) =>
    Array.from(new Set(values.map((entry) => entry.toUpperCase())))
      .sort()
      .join("");

  return basics.map((card) => {
    const typeLine = card.typeLine ?? null;
    const supertypes = card.supertypes ?? [];
    const isLegendary = supertypes.includes("Legendary");
    const isBasic = supertypes.includes("Basic");

    const leadershipCommander = card.leadershipSkills?.commander === true;
    const fallbackCommander =
      isLegendary && typeLine?.toLowerCase().includes("creature");

    const legalCommander = legalities.get(card.uuid) ?? "Unknown";
    const isBannedCommander = legalCommander.toLowerCase() === "banned";

    return {
      cardUuid: card.uuid,
      name: card.name,
      colorIdentity: normalizeColors(card.colorIdentity ?? []),
      typeLine,
      manaValue: card.manaValue ?? null,
      colors: normalizeColors(card.colors ?? []),
      isBasic,
      isLegendary,
      isCommander: leadershipCommander || fallbackCommander,
      legalCommander,
      isBannedCommander,
    };
  });
}
