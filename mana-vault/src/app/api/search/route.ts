import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  filters.isLegendary = parseBoolean(searchParams.get("isLegendary"));
  filters.isBasic = parseBoolean(searchParams.get("isBasic"));
  filters.isCommander = parseBoolean(searchParams.get("isCommander"));
  filters.legalCommander = parseBoolean(searchParams.get("legalCommander"));

  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  try {
    const results = searchCards(filters, { limit, offset });
    const cardUuids = results.map((result) => result.cardUuid);

    const collection = cardUuids.length
      ? await prisma.collectionCard.findMany({
          where: { cardUuid: { in: cardUuids } },
        })
      : [];

    const collectionMap = new Map(
      collection.map((card) => [card.cardUuid, card]),
    );

    const enriched = results.map((result) => {
      const owned = collectionMap.get(result.cardUuid);
      return {
        ...result,
        qty: owned?.qty ?? 0,
        foilQty: owned?.foilQty ?? 0,
      };
    });

    return NextResponse.json({ results: enriched });
  } catch (error) {
    return NextResponse.json(
      { error: "Search index unavailable", details: String(error) },
      { status: 503 },
    );
  }
}
