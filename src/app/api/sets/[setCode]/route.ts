import { NextResponse } from "next/server";
import { getSearchDb } from "@/lib/search/db";
import { getSetByCode } from "@/lib/mtgjson/queries/sets";

type RouteContext = {
  params: { setCode: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { setCode: rawCode } = await context.params;
  const setCode = decodeURIComponent(rawCode).toUpperCase();

  const set = getSetByCode(setCode);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  let cardCount: number | null = null;
  try {
    const db = getSearchDb();
    const row = db
      .prepare(
        `
          SELECT COUNT(DISTINCT canonicalKey) as count
          FROM card_search_printings
          WHERE setCode = ?
        `,
      )
      .get(setCode) as { count?: number } | undefined;
    cardCount = row?.count ?? 0;
  } catch {
    cardCount = null;
  }

  return NextResponse.json({ set, cardCount });
}
