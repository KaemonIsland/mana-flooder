import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cardUuidsParam = searchParams.get("cardUuids");
  const cardUuids = cardUuidsParam
    ? cardUuidsParam.split(",").map((uuid) => uuid.trim())
    : [];

  const collection = await prisma.collectionCard.findMany({
    where: cardUuids.length ? { cardUuid: { in: cardUuids } } : undefined,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ collection });
}

export async function POST(request: Request) {
  const body = await request.json();
  const cardUuid = body.cardUuid as string | undefined;
  const delta = Number(body.delta ?? 0);
  const foilDelta = Number(body.foilDelta ?? 0);

  if (!cardUuid) {
    return NextResponse.json({ error: "Missing cardUuid" }, { status: 400 });
  }

  const existing = await prisma.collectionCard.findUnique({
    where: { cardUuid },
  });

  const newQty = Math.max(0, (existing?.qty ?? 0) + delta);
  const newFoilQty = Math.max(0, (existing?.foilQty ?? 0) + foilDelta);

  const updated = await prisma.collectionCard.upsert({
    where: { cardUuid },
    update: { qty: newQty, foilQty: newFoilQty },
    create: { cardUuid, qty: newQty, foilQty: newFoilQty },
  });

  return NextResponse.json({ card: updated });
}
