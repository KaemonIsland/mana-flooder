import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSearchDb } from "@/lib/search/db";
import { parseSearchQuery } from "@/lib/search/parser";
import { searchCards } from "@/lib/search/search";

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseColorParam(
  value: string | null,
  options: { colorless?: boolean; multicolor?: boolean } = {},
) {
  const colors = new Set<string>();
  if (value) {
    value
      .split(",")
      .join("")
      .toUpperCase()
      .split("")
      .forEach((char) => {
        if (["W", "U", "B", "R", "G", "C", "M"].includes(char)) {
          colors.add(char);
        }
      });
  }
  if (options.colorless) colors.add("C");
  if (options.multicolor) colors.add("M");
  return Array.from(colors);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const filters = parseSearchQuery(query);

  const colors = parseColorParam(searchParams.get("colors"), {
    colorless: parseBoolean(searchParams.get("colorless")),
    multicolor: parseBoolean(searchParams.get("multicolor")),
  });
  if (colors.length) filters.colors = colors;

  const colorIdentity = parseColorParam(searchParams.get("colorIdentity"), {
    colorless: parseBoolean(searchParams.get("identityColorless")),
    multicolor: parseBoolean(searchParams.get("identityMulticolor")),
  });
  if (colorIdentity.length) filters.colorIdentity = colorIdentity;

  const rarity = parseList(searchParams.get("rarity"));
  if (rarity.length) filters.rarities = rarity.map((value) => value.toLowerCase());

  const setCodes = parseList(searchParams.get("set")).map((value) =>
    value.toUpperCase(),
  );
  if (setCodes.length) filters.setCodes = setCodes;

  const mvMin = searchParams.get("mvMin");
  const mvMax = searchParams.get("mvMax");
  const mvEq = searchParams.get("mvEq");

  if (mvMin || mvMax || mvEq) {
    filters.manaValue = filters.manaValue ?? {};
    if (mvEq) filters.manaValue.eq = Number(mvEq);
    if (mvMin) filters.manaValue.min = Number(mvMin);
    if (mvMax) filters.manaValue.max = Number(mvMax);
  }

  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  try {
    const results = searchCards(filters, { limit, offset });
    const canonicalKeys = results.map((result) => result.canonicalKey);

    const searchDb = getSearchDb();
    const printingsMap = new Map<string, string[]>();

    if (canonicalKeys.length) {
      const params: Record<string, string> = {};
      const placeholders = canonicalKeys.map((key, index) => {
        const param = `key_${index}`;
        params[param] = key;
        return `@${param}`;
      });

      const rows = searchDb
        .prepare(
          `
            SELECT canonicalKey, uuid
            FROM card_search_printings
            WHERE canonicalKey IN (${placeholders.join(", ")})
          `,
        )
        .all(params) as Array<{ canonicalKey: string; uuid: string }>;

      rows.forEach((row) => {
        if (!printingsMap.has(row.canonicalKey)) {
          printingsMap.set(row.canonicalKey, []);
        }
        printingsMap.get(row.canonicalKey)?.push(row.uuid);
      });
    }

    const allUuids = Array.from(printingsMap.values()).flat();
    const collection = allUuids.length
      ? await prisma.collectionCard.findMany({
          where: { cardUuid: { in: allUuids } },
        })
      : [];

    const collectionByUuid = new Map(
      collection.map((card) => [card.cardUuid, card]),
    );

    const totalsByCanonical = new Map<
      string,
      { qty: number; foilQty: number }
    >();

    printingsMap.forEach((uuids, canonicalKey) => {
      const totals = { qty: 0, foilQty: 0 };
      uuids.forEach((uuid) => {
        const owned = collectionByUuid.get(uuid);
        totals.qty += owned?.qty ?? 0;
        totals.foilQty += owned?.foilQty ?? 0;
      });
      totalsByCanonical.set(canonicalKey, totals);
    });

    const enriched = results.map((result) => {
      const totals = totalsByCanonical.get(result.canonicalKey) ?? {
        qty: 0,
        foilQty: 0,
      };
      return {
        ...result,
        qty: totals.qty + totals.foilQty,
        foilQty: totals.foilQty,
      };
    });

    return NextResponse.json({ results: enriched });
  } catch (error) {
    console.error("SEARCH ROUTE FAILED:", error); // <-- keep stack
    return NextResponse.json(
      {
        error: "Search failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
  
}
