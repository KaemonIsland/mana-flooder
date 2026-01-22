import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSearchDb } from "@/lib/search/db";
import type { SearchFilters } from "@/lib/search/parser";
import { searchCards } from "@/lib/search/search";
import { resolveCardImage } from "@/lib/mtgjson/images";
import { getIdentifiersByUuids } from "@/lib/mtgjson/queries/identifiers";
import { getCardSearchDetailsByUuids, getPrintingsByUuids } from "@/lib/mtgjson/queries/cards";
import { getLatestPricesByUuids, getPriceSupport } from "@/lib/mtgjson/queries/prices";

type SortDir = "asc" | "desc";
type SortKey =
  | "name"
  | "releaseDate"
  | "setNumber"
  | "rarity"
  | "color"
  | "priceUsd"
  | "priceTix"
  | "priceEur"
  | "manaValue"
  | "power"
  | "toughness"
  | "artist"
  | "edhrec"
  | "setReview";

type DetailMap = Map<
  string,
  {
    artist: string | null;
    flavorText: string | null;
    power: string | null;
    toughness: string | null;
  }
>;

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  releaseDate: "desc",
  setNumber: "asc",
  rarity: "asc",
  color: "asc",
  priceUsd: "desc",
  priceTix: "desc",
  priceEur: "desc",
  manaValue: "asc",
  power: "desc",
  toughness: "desc",
  artist: "asc",
  edhrec: "asc",
  setReview: "desc",
};

const RARITY_ORDER = new Map([
  ["common", 1],
  ["uncommon", 2],
  ["rare", 3],
  ["mythic", 4],
]);

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseColorList(value: string | null) {
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
  return Array.from(colors);
}

function toTerms(value: string) {
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSortKey(raw: string | null): SortKey {
  const normalized = raw ?? "";
  const options: SortKey[] = [
    "name",
    "releaseDate",
    "setNumber",
    "rarity",
    "color",
    "priceUsd",
    "priceTix",
    "priceEur",
    "manaValue",
    "power",
    "toughness",
    "artist",
    "edhrec",
    "setReview",
  ];
  if (options.includes(normalized as SortKey)) {
    return normalized as SortKey;
  }
  return "name";
}

function parseSortDir(raw: string | null, sortKey: SortKey): SortDir {
  if (raw === "asc" || raw === "desc") return raw;
  return DEFAULT_SORT_DIR[sortKey] ?? "asc";
}

function parseSortOverrides(searchParams: URLSearchParams) {
  const legacy = searchParams.get("sort");
  if (!legacy) return null;

  switch (legacy) {
    case "newest":
      return { sortKey: "releaseDate" as SortKey, sortDir: "desc" as SortDir };
    case "oldest":
      return { sortKey: "releaseDate" as SortKey, sortDir: "asc" as SortDir };
    case "mana":
      return { sortKey: "manaValue" as SortKey, sortDir: "asc" as SortDir };
    case "name":
      return { sortKey: "name" as SortKey, sortDir: "asc" as SortDir };
    default:
      return null;
  }
}

function parseStatValue(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function matchesRange(value: number | null, min: number | null, max: number | null) {
  if (value === null) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function matchesText(value: string | null, filter: string) {
  if (!filter.trim()) return true;
  if (!value) return false;
  return value.toLowerCase().includes(filter.toLowerCase());
}

function parseCollectorNumber(value: string | null) {
  if (!value) return { number: null, suffix: "" };
  const match = value.match(/^(\d+)(.*)$/);
  if (match) {
    return { number: Number(match[1]), suffix: match[2] ?? "" };
  }
  return { number: null, suffix: value };
}

function colorSortKey(colors: string[]) {
  if (!colors.length) return [0, ""];
  const order = ["W", "U", "B", "R", "G"];
  const sorted = [...colors].map((c) => c.toUpperCase()).sort((a, b) => {
    return order.indexOf(a) - order.indexOf(b);
  });
  return [sorted.length, sorted.join("")] as [number, string];
}

function sortResults<T extends { name: string; manaValue: number | null; latestReleaseDate: string | null; displayReleaseDate?: string | null; displaySetCode?: string | null; latestSetCode: string | null; rarity: string | null; colors: string[]; representativeUuid: string; collectorNumber?: string | null }>(
  results: T[],
  sortKey: SortKey,
  sortDir: SortDir,
  detailMap: DetailMap,
  pricesByUuid: Map<string, { usd: number | null; eur: number | null; tix: number | null }>,
) {
  const sorted = [...results];
  const dir = sortDir === "desc" ? -1 : 1;

  const compareStrings = (a: string, b: string) => a.localeCompare(b);
  const compareNullableNumbers = (
    a: number | null,
    b: number | null,
    direction: SortDir,
  ) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * (direction === "desc" ? -1 : 1);
  };

  const compareNullableStrings = (
    a: string | null,
    b: string | null,
    direction: SortDir,
  ) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b) * (direction === "desc" ? -1 : 1);
  };

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "releaseDate": {
        const left = a.displayReleaseDate ?? a.latestReleaseDate ?? "";
        const right = b.displayReleaseDate ?? b.latestReleaseDate ?? "";
        if (left !== right) return left.localeCompare(right) * dir;
        return compareStrings(a.name, b.name);
      }
      case "setNumber": {
        const leftSet = (a.displaySetCode ?? a.latestSetCode ?? "").toUpperCase();
        const rightSet = (b.displaySetCode ?? b.latestSetCode ?? "").toUpperCase();
        if (leftSet !== rightSet) return leftSet.localeCompare(rightSet) * dir;
        const leftNumber = parseCollectorNumber(a.collectorNumber ?? null);
        const rightNumber = parseCollectorNumber(b.collectorNumber ?? null);
        const numberCompare = compareNullableNumbers(
          leftNumber.number,
          rightNumber.number,
          sortDir,
        );
        if (numberCompare !== 0) return numberCompare;
        const suffixCompare = compareNullableStrings(
          leftNumber.suffix,
          rightNumber.suffix,
          sortDir,
        );
        if (suffixCompare !== 0) return suffixCompare;
        return compareStrings(a.name, b.name);
      }
      case "rarity": {
        const left = RARITY_ORDER.get((a.rarity ?? "").toLowerCase()) ?? null;
        const right = RARITY_ORDER.get((b.rarity ?? "").toLowerCase()) ?? null;
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "color": {
        const [leftCount, leftKey] = colorSortKey(a.colors ?? []);
        const [rightCount, rightKey] = colorSortKey(b.colors ?? []);
        if (leftCount !== rightCount) return (leftCount - rightCount) * dir;
        if (leftKey !== rightKey) return leftKey.localeCompare(rightKey) * dir;
        return compareStrings(a.name, b.name);
      }
      case "priceUsd": {
        const left = pricesByUuid.get(a.representativeUuid)?.usd ?? null;
        const right = pricesByUuid.get(b.representativeUuid)?.usd ?? null;
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "priceTix": {
        const left = pricesByUuid.get(a.representativeUuid)?.tix ?? null;
        const right = pricesByUuid.get(b.representativeUuid)?.tix ?? null;
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "priceEur": {
        const left = pricesByUuid.get(a.representativeUuid)?.eur ?? null;
        const right = pricesByUuid.get(b.representativeUuid)?.eur ?? null;
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "manaValue": {
        const compare = compareNullableNumbers(a.manaValue, b.manaValue, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "power": {
        const left = parseStatValue(detailMap.get(a.representativeUuid)?.power ?? null);
        const right = parseStatValue(detailMap.get(b.representativeUuid)?.power ?? null);
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "toughness": {
        const left = parseStatValue(detailMap.get(a.representativeUuid)?.toughness ?? null);
        const right = parseStatValue(detailMap.get(b.representativeUuid)?.toughness ?? null);
        const compare = compareNullableNumbers(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "artist": {
        const left = detailMap.get(a.representativeUuid)?.artist ?? null;
        const right = detailMap.get(b.representativeUuid)?.artist ?? null;
        const compare = compareNullableStrings(left, right, sortDir);
        if (compare !== 0) return compare;
        return compareStrings(a.name, b.name);
      }
      case "edhrec":
      case "setReview":
      case "name":
      default: {
        return compareStrings(a.name, b.name) * dir;
      }
    }
  });

  return sorted;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameQuery = searchParams.get("name") ?? searchParams.get("q") ?? "";
  const oracleText = searchParams.get("oracleText") ?? searchParams.get("oracle") ?? "";
  const typeLine = searchParams.get("typeLine") ?? searchParams.get("type") ?? "";
  const manaCost = searchParams.get("manaCost") ?? "";
  const artist = searchParams.get("artist") ?? "";
  const flavor = searchParams.get("flavor") ?? "";

  const colors = parseColorList(searchParams.get("colors"));
  const colorIdentity = parseColorList(searchParams.get("colorIdentity") ?? searchParams.get("identity"));
  const rarities = parseList(searchParams.get("rarities") ?? searchParams.get("rarity")).map((value) =>
    value.toLowerCase(),
  );
  const cardTypes = parseList(searchParams.get("types")).map((value) => value.toLowerCase());

  const setParam = searchParams.get("sets") ?? searchParams.get("set");
  const setCodes = parseList(setParam).map((value) => value.toUpperCase());

  const mvMin = parseNumber(searchParams.get("mvMin"));
  const mvMax = parseNumber(searchParams.get("mvMax"));
  const powerMin = parseNumber(searchParams.get("powerMin"));
  const powerMax = parseNumber(searchParams.get("powerMax"));
  const toughnessMin = parseNumber(searchParams.get("toughnessMin"));
  const toughnessMax = parseNumber(searchParams.get("toughnessMax"));

  const sortOverrides = parseSortOverrides(searchParams);
  const sortKey = sortOverrides?.sortKey ?? parseSortKey(searchParams.get("sortKey"));
  const sortDir = sortOverrides?.sortDir ?? parseSortDir(searchParams.get("sortDir"), sortKey);

  const filters: SearchFilters = {
    nameTerms: toTerms(nameQuery),
    oracleTerms: toTerms(oracleText),
    typeTerms: toTerms(typeLine),
    textTerms: [],
  };

  if (manaCost.trim()) filters.manaCost = manaCost.trim();
  if (colors.length) filters.colors = colors;
  if (colorIdentity.length) filters.colorIdentity = colorIdentity;
  if (rarities.length) filters.rarities = rarities;
  if (cardTypes.length) filters.cardTypes = cardTypes;
  if (setCodes.length) filters.setCodes = setCodes;
  if (mvMin !== null || mvMax !== null) {
    filters.manaValue = {};
    if (mvMin !== null) filters.manaValue.min = mvMin;
    if (mvMax !== null) filters.manaValue.max = mvMax;
  }

  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  try {
    let results = searchCards(filters, { limit, offset });

    const searchDb = getSearchDb();
    const setScopedMap = new Map<
      string,
      { uuid: string; releaseDate: string | null; setCode: string | null }
    >();

    if (setCodes.length && results.length) {
      const params: Record<string, string> = {};
      const keyPlaceholders = results.map((result, index) => {
        const key = `key_${index}`;
        params[key] = result.canonicalKey;
        return `@${key}`;
      });
      const setPlaceholders = setCodes.map((code, index) => {
        const key = `set_${index}`;
        params[key] = code;
        return `@${key}`;
      });

      const rows = searchDb
        .prepare(
          `
            SELECT canonicalKey, uuid, releaseDate, setCode
            FROM card_search_printings
            WHERE canonicalKey IN (${keyPlaceholders.join(", ")})
              AND setCode IN (${setPlaceholders.join(", ")})
          `,
        )
        .all(params) as Array<{
        canonicalKey: string;
        uuid: string;
        releaseDate: string | null;
        setCode: string | null;
      }>;

      rows.forEach((row) => {
        const current = setScopedMap.get(row.canonicalKey);
        const currentRelease = current?.releaseDate ?? "";
        const nextRelease = row.releaseDate ?? "";
        if (!current || nextRelease > currentRelease) {
          setScopedMap.set(row.canonicalKey, {
            uuid: row.uuid,
            releaseDate: row.releaseDate ?? null,
            setCode: row.setCode ?? null,
          });
        }
      });

      results = results.map((result) => {
        const scoped = setScopedMap.get(result.canonicalKey);
        if (!scoped) return result;
        return {
          ...result,
          representativeUuid: scoped.uuid,
        };
      });
    }

    const representativeUuids = Array.from(
      new Set(results.map((result) => result.representativeUuid)),
    );

    const detailRows = getCardSearchDetailsByUuids(representativeUuids);
    const detailMap: DetailMap = new Map(
      detailRows.map((row) => [
        row.uuid,
        {
          artist: row.artist ?? null,
          flavorText: row.flavorText ?? null,
          power: row.power ?? null,
          toughness: row.toughness ?? null,
        },
      ]),
    );

    const needsDetailFilters =
      Boolean(artist.trim()) ||
      Boolean(flavor.trim()) ||
      powerMin !== null ||
      powerMax !== null ||
      toughnessMin !== null ||
      toughnessMax !== null;

    if (needsDetailFilters) {
      results = results.filter((result) => {
        const details = detailMap.get(result.representativeUuid);
        if (artist.trim() && !matchesText(details?.artist ?? null, artist)) {
          return false;
        }
        if (flavor.trim() && !matchesText(details?.flavorText ?? null, flavor)) {
          return false;
        }
        if (powerMin !== null || powerMax !== null) {
          const power = parseStatValue(details?.power ?? null);
          if (!matchesRange(power, powerMin, powerMax)) return false;
        }
        if (toughnessMin !== null || toughnessMax !== null) {
          const toughness = parseStatValue(details?.toughness ?? null);
          if (!matchesRange(toughness, toughnessMin, toughnessMax)) return false;
        }
        return true;
      });
    }

    const canonicalKeys = results.map((result) => result.canonicalKey);
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

    const identifiersMap = getIdentifiersByUuids(representativeUuids);
    const printingDetails = getPrintingsByUuids(representativeUuids);
    const printingMap = new Map(
      printingDetails.map((printing) => [printing.uuid, printing]),
    );

    const pricesByUuid =
      sortKey === "priceUsd" || sortKey === "priceEur" || sortKey === "priceTix"
        ? getLatestPricesByUuids(representativeUuids)
        : new Map();

    const enriched = results.map((result) => {
      const totals = totalsByCanonical.get(result.canonicalKey) ?? {
        qty: 0,
        foilQty: 0,
      };
      const printing = printingMap.get(result.representativeUuid);

      return {
        ...result,
        qty: totals.qty + totals.foilQty,
        foilQty: totals.foilQty,
        imageUrl: resolveCardImage(
          identifiersMap.get(result.representativeUuid) ?? null,
        ),
        displaySetCode: printing?.setCode ?? result.latestSetCode ?? null,
        displayReleaseDate: printing?.releaseDate ?? result.latestReleaseDate ?? null,
        collectorNumber: printing?.number ?? null,
        rarity: printing?.rarity ?? result.rarity ?? null,
      };
    });

    const sorted = sortResults(
      enriched,
      sortKey,
      sortDir,
      detailMap,
      new Map(
        Array.from(pricesByUuid.entries()).map(([uuid, price]) => [
          uuid,
          { usd: price.usd, eur: price.eur, tix: price.tix },
        ]),
      ),
    );

    return NextResponse.json({
      results: sorted,
      meta: {
        sortKey,
        sortDir,
        priceSupport: getPriceSupport(),
        edhrecAvailable: false,
        setReviewAvailable: false,
      },
    });
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
