import type { IdentifierMap } from "@/lib/mtgjson/queries/identifiers";

const SCRYFALL_IMAGE_BASE = "https://api.scryfall.com/cards";

export function resolveCardImage(identifiers: IdentifierMap | null) {
  if (!identifiers) return null;
  const scryfallId =
    identifiers.scryfallId ??
    identifiers.scryfallCardId ??
    identifiers.scryfallID ??
    null;
  if (scryfallId) {
    return `${SCRYFALL_IMAGE_BASE}/${scryfallId}?format=image&version=normal`;
  }

  const multiverseId =
    identifiers.multiverseId ?? identifiers.multiverseID ?? null;
  if (multiverseId) {
    return `https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=${multiverseId}&type=card`;
  }

  return null;
}
