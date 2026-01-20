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
    include: { cards: true },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const cardUuids = deck.cards.map((card) => card.cardUuid);
  const lookups = getCardLookups(cardUuids);
  const { stats, validation } = computeDeckStats(deck.cards, lookups);

  return NextResponse.json({ stats, validation });
}
