import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: { deckId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();

  if (!name) {
    return NextResponse.json({ error: "Category name required" }, { status: 400 });
  }

  const count = await prisma.deckCategory.count({ where: { deckId } });
  const category = await prisma.deckCategory.create({
    data: {
      deckId,
      name,
      sortOrder: count,
    },
  });

  return NextResponse.json({ category });
}

export async function DELETE(request: Request, context: RouteContext) {
  const deckId = context.params.deckId;
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  if (!categoryId) {
    return NextResponse.json({ error: "Missing categoryId" }, { status: 400 });
  }

  const existing = await prisma.deckCategory.findUnique({
    where: { id: categoryId },
  });

  if (!existing || existing.deckId !== deckId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await prisma.deckCategory.delete({
    where: { id: categoryId },
  });

  return NextResponse.json({ removed: true });
}
