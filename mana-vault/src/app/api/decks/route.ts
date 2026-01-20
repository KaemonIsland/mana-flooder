import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/decks/defaults";
import { getCardLookups } from "@/lib/search/lookup";

export async function GET() {
  const decks = await prisma.deck.findMany({
    include: { cards: true, categories: true },
    orderBy: { updatedAt: "desc" },
  });

  const commanderUuids = Array.from(
    new Set(
      decks.flatMap((deck) =>
        deck.cards.filter((card) => card.isCommander).map((card) => card.cardUuid),
      ),
    ),
  );
  const commanderLookups = getCardLookups(commanderUuids);
  const lookupMap = new Map(
    commanderLookups.map((card) => [card.cardUuid, card]),
  );

  const summaries = decks.map((deck) => {
    const totalCards = deck.cards.reduce((sum, card) => sum + card.qty, 0);
    const commanders = deck.cards.filter((card) => card.isCommander);
    const commanderNames = commanders
      .map((card) => lookupMap.get(card.cardUuid)?.name ?? card.cardUuid)
      .join(" / ");
    const commanderIdentity = commanders
      .map(
        (card) =>
          lookupMap.get(card.cardUuid)?.colorIdentity?.toUpperCase() ?? "",
      )
      .join("");

    return {
      id: deck.id,
      name: deck.name,
      commanderNames,
      colorIdentity: commanderIdentity,
      totalCards,
      updatedAt: deck.updatedAt,
    };
  });

  return NextResponse.json({ decks: summaries });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();

  if (!name) {
    return NextResponse.json({ error: "Deck name is required" }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: {
      name,
      categories: {
        create: DEFAULT_CATEGORIES.map((category, index) => ({
          name: category,
          sortOrder: index,
        })),
      },
    },
    include: { categories: true },
  });

  return NextResponse.json({ deck });
}
