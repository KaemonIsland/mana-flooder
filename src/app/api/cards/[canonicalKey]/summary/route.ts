import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAllPrintingsForCanonicalKey,
  getRepresentativePrintingForCanonicalKey,
} from "@/lib/mtgjson/canonical";
import { resolveCardImage } from "@/lib/mtgjson/images";
import { getCardByUuid, getPrintingsByUuids } from "@/lib/mtgjson/queries/cards";
import { getIdentifiersByUuids } from "@/lib/mtgjson/queries/identifiers";
import { getLatestPricesByUuids } from "@/lib/mtgjson/queries/prices";

type RouteContext = {
  params: { canonicalKey: string };
};

function normalizeFinish(finishes: string[]) {
  return finishes.map((finish) => finish.toLowerCase());
}

function hasFoilFinish(finishes: string[]) {
  const normalized = normalizeFinish(finishes);
  return normalized.some(
    (finish) =>
      finish.includes("foil") ||
      finish.includes("etched") ||
      finish.includes("gloss"),
  );
}

function hasNonFoilFinish(finishes: string[]) {
  const normalized = normalizeFinish(finishes);
  return normalized.some(
    (finish) => finish.includes("nonfoil") || finish.includes("normal"),
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { canonicalKey: rawKey } = await context.params;
  const canonicalKey = decodeURIComponent(rawKey);
  const representative = getRepresentativePrintingForCanonicalKey(canonicalKey);

  if (!representative) {
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

  const { searchParams } = new URL(request.url);
  const requestedUuid = searchParams.get("printingUuid");
  const activeUuid = requestedUuid && printingUuids.includes(requestedUuid)
    ? requestedUuid
    : representative.representativeUuid;

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

  const identifiersMap = getIdentifiersByUuids(printingUuids);
  const printings = getPrintingsByUuids(printingUuids).sort((a, b) => {
    const left = b.releaseDate ?? "";
    const right = a.releaseDate ?? "";
    if (left !== right) return left.localeCompare(right);
    return (a.setCode ?? "").localeCompare(b.setCode ?? "");
  });

  const printingsWithOwned = printings.map((printing) => ({
    uuid: printing.uuid,
    setCode: printing.setCode ?? null,
    setName: printing.setName ?? null,
    releaseDate: printing.releaseDate ?? null,
    collectorNumber: printing.number ?? null,
    rarity: printing.rarity ?? null,
    finishes: printing.finishes,
    hasFoil: hasFoilFinish(printing.finishes),
    hasNonfoil: hasNonFoilFinish(printing.finishes),
    qty: collectionMap.get(printing.uuid)?.qty ?? 0,
    foilQty: collectionMap.get(printing.uuid)?.foilQty ?? 0,
    imageUrl: resolveCardImage(identifiersMap.get(printing.uuid) ?? null),
  }));

  const activeCard = getCardByUuid(activeUuid);
  if (!activeCard) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const prices = getLatestPricesByUuids([activeUuid]).get(activeUuid) ?? {
    usd: null,
    eur: null,
    tix: null,
    date: null,
  };

  return NextResponse.json({
    canonicalKey,
    representativeUuid: representative.representativeUuid,
    activePrinting: {
      uuid: activeUuid,
      name: activeCard.name,
      imageUrl: resolveCardImage(identifiersMap.get(activeUuid) ?? null),
      manaCost: activeCard.manaCost ?? null,
      typeLine: activeCard.typeLine ?? null,
      oracleText: activeCard.text ?? null,
      artist: activeCard.artist ?? null,
      flavor: activeCard.flavorText ?? null,
    },
    prices: {
      usd: prices.usd ?? null,
      eur: prices.eur ?? null,
      tix: prices.tix ?? null,
      date: prices.date ?? null,
    },
    collectionTotals,
    decks,
    printings: printingsWithOwned,
  });
}
