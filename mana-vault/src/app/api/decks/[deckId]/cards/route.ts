import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { deckId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const body = await request.json();
  const cardUuid = body.cardUuid as string | undefined;
  const qty = Number(body.qty ?? 1);
  const category = body.category as string | undefined;
  const isCommander = Boolean(body.isCommander ?? false);

  if (!cardUuid) {
    return NextResponse.json({ error: "Missing cardUuid" }, { status: 400 });
  }

  const deckCategories = await prisma.deckCategory.findMany({
    where: { deckId },
    orderBy: { sortOrder: "asc" },
  });
  const fallbackCategory = deckCategories[0]?.name ?? "Utility";

  const existing = await prisma.deckCard.findUnique({
    where: { deckId_cardUuid: { deckId, cardUuid } },
  });

  if (existing) {
    const updated = await prisma.deckCard.update({
      where: { deckId_cardUuid: { deckId, cardUuid } },
      data: {
        qty: Math.max(0, existing.qty + qty),
        category: category ?? existing.category,
        isCommander: isCommander || existing.isCommander,
      },
    });
    return NextResponse.json({ card: updated });
  }

  const created = await prisma.deckCard.create({
    data: {
      deckId,
      cardUuid,
      qty: Math.max(1, qty),
      category: category ?? fallbackCategory,
      isCommander,
    },
  });

  return NextResponse.json({ card: created });
}

export async function PATCH(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const body = await request.json();
  const cardUuid = body.cardUuid as string | undefined;

  if (!cardUuid) {
    return NextResponse.json({ error: "Missing cardUuid" }, { status: 400 });
  }

  const existing = await prisma.deckCard.findUnique({
    where: { deckId_cardUuid: { deckId, cardUuid } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const delta = body.delta !== undefined ? Number(body.delta) : null;
  const qty = body.qty !== undefined ? Number(body.qty) : null;
  const category = body.category as string | undefined;
  const isCommander = body.isCommander as boolean | undefined;

  const nextQty =
    qty !== null && !Number.isNaN(qty)
      ? qty
      : delta !== null && !Number.isNaN(delta)
        ? existing.qty + delta
        : existing.qty;

  if (nextQty <= 0) {
    await prisma.deckCard.delete({
      where: { deckId_cardUuid: { deckId, cardUuid } },
    });
    return NextResponse.json({ removed: true });
  }

  const updated = await prisma.deckCard.update({
    where: { deckId_cardUuid: { deckId, cardUuid } },
    data: {
      qty: nextQty,
      category: category ?? existing.category,
      isCommander: isCommander ?? existing.isCommander,
    },
  });

  return NextResponse.json({ card: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const { searchParams } = new URL(request.url);
  const cardUuid = searchParams.get("cardUuid") ?? undefined;

  if (!cardUuid) {
    return NextResponse.json({ error: "Missing cardUuid" }, { status: 400 });
  }

  await prisma.deckCard.delete({
    where: { deckId_cardUuid: { deckId, cardUuid } },
  });

  return NextResponse.json({ removed: true });
}
