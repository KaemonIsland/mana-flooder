import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCardLookups } from "@/lib/search/lookup";
import { computeDeckStats } from "@/lib/decks/stats";

type RouteContext = {
  params: { deckId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const deckId = context.params.deckId;

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { cards: true, categories: true },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const cardUuids = deck.cards.map((card) => card.cardUuid);
  const cardLookups = getCardLookups(cardUuids);
  const lookupMap = new Map(
    cardLookups.map((card) => [card.cardUuid, card]),
  );

  const collection = await prisma.collectionCard.findMany({
    where: cardUuids.length ? { cardUuid: { in: cardUuids } } : undefined,
  });
  const collectionMap = new Map(
    collection.map((card) => [card.cardUuid, card]),
  );

  const cards = deck.cards.map((card) => ({
    ...card,
    details: lookupMap.get(card.cardUuid) ?? null,
    ownedQty: collectionMap.get(card.cardUuid)?.qty ?? 0,
  }));

  const { stats, validation } = computeDeckStats(deck.cards, cardLookups);

  return NextResponse.json({
    deck: {
      id: deck.id,
      name: deck.name,
      allowMissing: deck.allowMissing,
      notes: deck.notes,
      categories: deck.categories.sort((a, b) => a.sortOrder - b.sortOrder),
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    },
    cards,
    stats,
    validation,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const body = await request.json();

  const name = body.name as string | undefined;
  const allowMissing = body.allowMissing as boolean | undefined;
  const notes = body.notes as string | undefined;

  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: {
      name: name?.trim() ?? undefined,
      allowMissing: allowMissing ?? undefined,
      notes: notes ?? undefined,
    },
  });

  return NextResponse.json({ deck });
}
