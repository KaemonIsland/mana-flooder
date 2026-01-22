export type SortKey =
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

export type SortDir = "asc" | "desc";

export type SearchState = {
  name: string;
  oracleText: string;
  typeLine: string;
  manaCost: string;
  artist: string;
  flavor: string;
  colors: string[];
  colorIdentity: string[];
  rarities: string[];
  cardTypes: string[];
  setCodes: string[];
  mvMin: string;
  mvMax: string;
  powerMin: string;
  powerMax: string;
  toughnessMin: string;
  toughnessMax: string;
  sortKey: SortKey;
  sortDir: SortDir;
};

export type SearchStateUpdate = Partial<{
  name: string | null;
  oracleText: string | null;
  typeLine: string | null;
  manaCost: string | null;
  artist: string | null;
  flavor: string | null;
  colors: string[] | null;
  colorIdentity: string[] | null;
  rarities: string[] | null;
  cardTypes: string[] | null;
  setCodes: string[] | null;
  mvMin: string | null;
  mvMax: string | null;
  powerMin: string | null;
  powerMax: string | null;
  toughnessMin: string | null;
  toughnessMax: string | null;
  sortKey: SortKey | null;
  sortDir: SortDir | null;
}>;

type SearchParamsLike = {
  get: (key: string) => string | null;
  toString: () => string;
};

type RouterLike = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

type SearchStateOptions = {
  defaultSortKey?: SortKey;
  setScope?: string | null;
};

const SORT_KEYS: SortKey[] = [
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

export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
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

function normalizeList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseList(
  value: string | null,
  transform: (entry: string) => string,
) {
  if (!value) return [];
  const parsed = value
    .split(",")
    .map((entry) => transform(entry.trim()))
    .filter(Boolean);
  return normalizeList(parsed);
}

function parseSortKey(value: string | null, fallback: SortKey): SortKey {
  const normalized = value ?? "";
  if (SORT_KEYS.includes(normalized as SortKey)) {
    return normalized as SortKey;
  }
  return fallback;
}

function parseSortDir(value: string | null, sortKey: SortKey): SortDir {
  if (value === "asc" || value === "desc") return value;
  return DEFAULT_SORT_DIR[sortKey] ?? "asc";
}

function sortedQueryString(params: URLSearchParams) {
  const entries = Array.from(params.entries()).sort(([aKey, aVal], [bKey, bVal]) => {
    const keyCompare = aKey.localeCompare(bKey);
    if (keyCompare !== 0) return keyCompare;
    return aVal.localeCompare(bVal);
  });

  const normalized = new URLSearchParams();
  entries.forEach(([key, value]) => {
    normalized.set(key, value);
  });
  return normalized.toString();
}

export function getSearchState(
  searchParams: SearchParamsLike,
  options: SearchStateOptions = {},
): SearchState {
  const defaultSortKey = options.defaultSortKey ?? "name";
  const setScope = options.setScope?.toUpperCase() ?? null;

  const sortKey = parseSortKey(searchParams.get("sortKey"), defaultSortKey);
  const sortDir = parseSortDir(searchParams.get("sortDir"), sortKey);

  return {
    name: searchParams.get("name") ?? searchParams.get("q") ?? "",
    oracleText: searchParams.get("oracleText") ?? searchParams.get("oracle") ?? "",
    typeLine: searchParams.get("typeLine") ?? searchParams.get("type") ?? "",
    manaCost: searchParams.get("manaCost") ?? "",
    artist: searchParams.get("artist") ?? "",
    flavor: searchParams.get("flavor") ?? "",
    colors: parseList(searchParams.get("colors"), (entry) => entry.toUpperCase()),
    colorIdentity: parseList(
      searchParams.get("colorIdentity") ?? searchParams.get("identity"),
      (entry) => entry.toUpperCase(),
    ),
    rarities: parseList(
      searchParams.get("rarities") ?? searchParams.get("rarity"),
      (entry) => entry.toLowerCase(),
    ),
    cardTypes: parseList(searchParams.get("types"), (entry) => entry.toLowerCase()),
    setCodes: setScope
      ? [setScope]
      : parseList(
          searchParams.get("sets") ?? searchParams.get("set"),
          (entry) => entry.toUpperCase(),
        ),
    mvMin: searchParams.get("mvMin") ?? "",
    mvMax: searchParams.get("mvMax") ?? "",
    powerMin: searchParams.get("powerMin") ?? "",
    powerMax: searchParams.get("powerMax") ?? "",
    toughnessMin: searchParams.get("toughnessMin") ?? "",
    toughnessMax: searchParams.get("toughnessMax") ?? "",
    sortKey,
    sortDir,
  };
}

export function setSearchState(
  router: RouterLike,
  pathname: string,
  searchParams: SearchParamsLike,
  update: SearchStateUpdate,
  options: SearchStateOptions = {},
) {
  const params = new URLSearchParams(searchParams.toString());
  const setScope = options.setScope?.toUpperCase() ?? null;

  const applyValue = (key: string, value: string | string[] | null | undefined) => {
    if (value === undefined) return;
    if (value === null) {
      params.delete(key);
      return;
    }
    if (Array.isArray(value)) {
      const normalized = normalizeList(value).sort((a, b) => a.localeCompare(b));
      if (!normalized.length) {
        params.delete(key);
      } else {
        params.set(key, normalized.join(","));
      }
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      params.delete(key);
    } else {
      params.set(key, trimmed);
    }
  };

  applyValue("name", update.name ?? undefined);
  if (update.name !== undefined) params.delete("q");
  applyValue("oracleText", update.oracleText ?? undefined);
  if (update.oracleText !== undefined) params.delete("oracle");
  applyValue("typeLine", update.typeLine ?? undefined);
  if (update.typeLine !== undefined) params.delete("type");
  applyValue("manaCost", update.manaCost ?? undefined);
  applyValue("artist", update.artist ?? undefined);
  applyValue("flavor", update.flavor ?? undefined);
  applyValue("colors", update.colors ?? undefined);
  applyValue("colorIdentity", update.colorIdentity ?? undefined);
  if (update.colorIdentity !== undefined) params.delete("identity");
  applyValue("rarities", update.rarities ?? undefined);
  if (update.rarities !== undefined) params.delete("rarity");
  applyValue("types", update.cardTypes ?? undefined);
  if (!setScope) {
    applyValue("sets", update.setCodes ?? undefined);
    if (update.setCodes !== undefined) params.delete("set");
  }
  applyValue("mvMin", update.mvMin ?? undefined);
  applyValue("mvMax", update.mvMax ?? undefined);
  applyValue("powerMin", update.powerMin ?? undefined);
  applyValue("powerMax", update.powerMax ?? undefined);
  applyValue("toughnessMin", update.toughnessMin ?? undefined);
  applyValue("toughnessMax", update.toughnessMax ?? undefined);
  applyValue("sortKey", update.sortKey ?? undefined);
  applyValue("sortDir", update.sortDir ?? undefined);

  const nextQuery = sortedQueryString(params);
  const currentQuery = sortedQueryString(new URLSearchParams(searchParams.toString()));

  if (nextQuery === currentQuery) return;

  router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
    scroll: false,
  });
}
