import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAllPrintingsForCanonicalKey,
  getRepresentativePrintingForCanonicalKey,
} from "@/lib/mtgjson/canonical";
import { resolveCardImage } from "@/lib/mtgjson/images";
import { getPrintingsByUuids, getCardByUuid } from "@/lib/mtgjson/queries/cards";
import { getIdentifiersByUuids } from "@/lib/mtgjson/queries/identifiers";

type RouteContext = {
  params: { canonicalKey: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const canonicalKey = decodeURIComponent(context.params.canonicalKey);
  const representative = getRepresentativePrintingForCanonicalKey(canonicalKey);
  if (!representative) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = getCardByUuid(representative.representativeUuid);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const printingRefs = getAllPrintingsForCanonicalKey(canonicalKey);
  const printingUuids = Array.from(
    new Set(
      (printingRefs.length
        ? printingRefs.map((ref) => ref.uuid)
        : [representative.representativeUuid]
      ).filter(Boolean),
    ),
  );
  const printings = getPrintingsByUuids(printingUuids).sort((a, b) => {
    const left = b.releaseDate ?? "";
    const right = a.releaseDate ?? "";
    if (left !== right) return left.localeCompare(right);
    return (a.setCode ?? "").localeCompare(b.setCode ?? "");
  });

  const [collectionCards, deckCards] = await Promise.all([
    printingUuids.length
      ? prisma.collectionCard.findMany({
          where: { cardUuid: { in: printingUuids } },
        })
      : Promise.resolve([]),
    printingUuids.length
      ? prisma.deckCard.findMany({
          where: { cardUuid: { in: printingUuids } },
          include: { deck: true },
        })
      : Promise.resolve([]),
  ]);

  const collectionTotals = collectionCards.reduce(
    (totals, entry) => ({
      qty: totals.qty + entry.qty,
      foilQty: totals.foilQty + entry.foilQty,
    }),
    { qty: 0, foilQty: 0 },
  );

  const collectionMap = new Map(
    collectionCards.map((entry) => [entry.cardUuid, entry]),
  );

  const identifiersMap = getIdentifiersByUuids(printingUuids);

  const printingsWithOwned = printings.map((printing) => ({
    ...printing,
    qty: collectionMap.get(printing.uuid)?.qty ?? 0,
    foilQty: collectionMap.get(printing.uuid)?.foilQty ?? 0,
    imageUrl: resolveCardImage(identifiersMap.get(printing.uuid) ?? null),
  }));

  const deckMap = new Map<
    string,
    { id: string; name: string; totalQty: number; categories: Map<string, number> }
  >();
  deckCards.forEach((entry) => {
    const deckId = entry.deckId;
    if (!deckMap.has(deckId)) {
      deckMap.set(deckId, {
        id: deckId,
        name: entry.deck.name,
        totalQty: 0,
        categories: new Map<string, number>(),
      });
    }
    const deck = deckMap.get(deckId);
    if (!deck) return;
    deck.totalQty += entry.qty;
    deck.categories.set(
      entry.category,
      (deck.categories.get(entry.category) ?? 0) + entry.qty,
    );
  });

  const decks = Array.from(deckMap.values()).map((deck) => ({
    ...deck,
    categories: Array.from(deck.categories.entries()).map(([name, count]) => ({
      name,
      count,
    })),
  }));
  decks.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    canonicalKey,
    representativeUuid: representative.representativeUuid,
    imageUrl: resolveCardImage(
      identifiersMap.get(representative.representativeUuid) ?? null,
    ),
    card: {
      name: card.name,
      manaCost: card.manaCost ?? null,
      typeLine: card.typeLine ?? null,
      text: card.text ?? null,
    },
    collectionTotals,
    decks,
    printings: printingsWithOwned,
  });
}
