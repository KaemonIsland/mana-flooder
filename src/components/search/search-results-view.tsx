"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { CardSummary, CardTile } from "@/components/cards/card-tile";
import { ManaSymbol } from "@/components/cards/mana-symbol";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { COLOR_OPTIONS } from "@/lib/mtgjson/colors";

type SetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
  symbol: string | null;
};

type SearchMeta = {
  sortKey: string;
  sortDir: string;
  priceSupport: { usd: boolean; eur: boolean; tix: boolean };
  edhrecAvailable: boolean;
  setReviewAvailable: boolean;
};

type SearchResultsViewProps = {
  title: string;
  description?: string;
  setScope?: string;
  defaultSortKey?: SortKey;
};

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

type SortDir = "asc" | "desc";

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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "releaseDate", label: "Release Date" },
  { key: "setNumber", label: "Set/Number" },
  { key: "rarity", label: "Rarity" },
  { key: "color", label: "Color" },
  { key: "priceUsd", label: "Price: USD" },
  { key: "priceTix", label: "Price: TIX" },
  { key: "priceEur", label: "Price: EUR" },
  { key: "manaValue", label: "Mana Value" },
  { key: "power", label: "Power" },
  { key: "toughness", label: "Toughness" },
  { key: "artist", label: "Artist Name" },
  { key: "edhrec", label: "EDHREC Rank" },
  { key: "setReview", label: "Set Review" },
];

const CARD_TYPES = [
  "Creature",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Planeswalker",
  "Land",
  "Battle",
  "Tribal",
];

const RARITY_OPTIONS = [
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "mythic", label: "Mythic" },
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSortKey(raw: string | null): SortKey {
  const normalized = raw ?? "";
  const keys = SORT_OPTIONS.map((option) => option.key);
  if (keys.includes(normalized as SortKey)) {
    return normalized as SortKey;
  }
  return "name";
}

function parseSortDir(raw: string | null, sortKey: SortKey): SortDir {
  if (raw === "asc" || raw === "desc") return raw;
  return DEFAULT_SORT_DIR[sortKey] ?? "asc";
}

function toggleSelection(
  value: string,
  setState: (next: string[]) => void,
  state: string[],
) {
  if (state.includes(value)) {
    setState(state.filter((item) => item !== value));
  } else {
    setState([...state, value]);
  }
}

function SearchResultsView({
  title,
  description,
  setScope,
  defaultSortKey = "name",
}: SearchResultsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedSetScope = setScope?.toUpperCase() ?? null;

  const [results, setResults] = React.useState<CardSummary[]>([]);
  const [sets, setSets] = React.useState<SetSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [meta, setMeta] = React.useState<SearchMeta | null>(null);

  const [query, setQuery] = React.useState(
    searchParams.get("name") ?? searchParams.get("q") ?? "",
  );
  const [oracleText, setOracleText] = React.useState(
    searchParams.get("oracleText") ?? searchParams.get("oracle") ?? "",
  );
  const [typeLine, setTypeLine] = React.useState(
    searchParams.get("typeLine") ?? searchParams.get("type") ?? "",
  );
  const [manaCost, setManaCost] = React.useState(
    searchParams.get("manaCost") ?? "",
  );
  const [artist, setArtist] = React.useState(searchParams.get("artist") ?? "");
  const [flavor, setFlavor] = React.useState(searchParams.get("flavor") ?? "");

  const [colors, setColors] = React.useState<string[]>(
    parseList(searchParams.get("colors")).map((value) => value.toUpperCase()),
  );
  const [colorIdentity, setColorIdentity] = React.useState<string[]>(
    parseList(searchParams.get("colorIdentity") ?? searchParams.get("identity")).map(
      (value) => value.toUpperCase(),
    ),
  );
  const [rarities, setRarities] = React.useState<string[]>(
    parseList(searchParams.get("rarities") ?? searchParams.get("rarity")).map(
      (value) => value.toLowerCase(),
    ),
  );
  const [cardTypes, setCardTypes] = React.useState<string[]>(
    parseList(searchParams.get("types")).map((value) => value.toLowerCase()),
  );
  const [setCodes, setSetCodes] = React.useState<string[]>(
    resolvedSetScope
      ? [resolvedSetScope]
      : parseList(searchParams.get("sets") ?? searchParams.get("set")).map((value) =>
          value.toUpperCase(),
        ),
  );

  const [mvMin, setMvMin] = React.useState(searchParams.get("mvMin") ?? "");
  const [mvMax, setMvMax] = React.useState(searchParams.get("mvMax") ?? "");
  const [powerMin, setPowerMin] = React.useState(
    searchParams.get("powerMin") ?? "",
  );
  const [powerMax, setPowerMax] = React.useState(
    searchParams.get("powerMax") ?? "",
  );
  const [toughnessMin, setToughnessMin] = React.useState(
    searchParams.get("toughnessMin") ?? "",
  );
  const [toughnessMax, setToughnessMax] = React.useState(
    searchParams.get("toughnessMax") ?? "",
  );

  const [sortKey, setSortKey] = React.useState<SortKey>(() =>
    parseSortKey(searchParams.get("sortKey") ?? defaultSortKey),
  );
  const [sortDir, setSortDir] = React.useState<SortDir>(() =>
    parseSortDir(searchParams.get("sortDir"), sortKey),
  );

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [setSearch, setSetSearch] = React.useState("");

  const debouncedQuery = useDebouncedValue(query, 300);
  const debouncedOracle = useDebouncedValue(oracleText, 300);
  const debouncedType = useDebouncedValue(typeLine, 300);
  const debouncedManaCost = useDebouncedValue(manaCost, 300);
  const debouncedArtist = useDebouncedValue(artist, 300);
  const debouncedFlavor = useDebouncedValue(flavor, 300);

  React.useEffect(() => {
    if (resolvedSetScope) return;
    async function loadSets() {
      const response = await fetch("/api/sets");
      if (!response.ok) return;
      const data = (await response.json()) as { sets: SetSummary[] };
      setSets(data.sets ?? []);
    }

    loadSets();
  }, [resolvedSetScope]);

  React.useEffect(() => {
    const nextQuery = searchParams.get("name") ?? searchParams.get("q") ?? "";
    const nextOracle = searchParams.get("oracleText") ?? searchParams.get("oracle") ?? "";
    const nextType = searchParams.get("typeLine") ?? searchParams.get("type") ?? "";
    const nextManaCost = searchParams.get("manaCost") ?? "";
    const nextArtist = searchParams.get("artist") ?? "";
    const nextFlavor = searchParams.get("flavor") ?? "";
    const nextColors = parseList(searchParams.get("colors")).map((value) =>
      value.toUpperCase(),
    );
    const nextIdentity = parseList(
      searchParams.get("colorIdentity") ?? searchParams.get("identity"),
    ).map((value) => value.toUpperCase());
    const nextRarities = parseList(
      searchParams.get("rarities") ?? searchParams.get("rarity"),
    ).map((value) => value.toLowerCase());
    const nextTypes = parseList(searchParams.get("types")).map((value) =>
      value.toLowerCase(),
    );
    const nextSets = parseList(searchParams.get("sets") ?? searchParams.get("set")).map(
      (value) => value.toUpperCase(),
    );
    const nextMvMin = searchParams.get("mvMin") ?? "";
    const nextMvMax = searchParams.get("mvMax") ?? "";
    const nextPowerMin = searchParams.get("powerMin") ?? "";
    const nextPowerMax = searchParams.get("powerMax") ?? "";
    const nextToughnessMin = searchParams.get("toughnessMin") ?? "";
    const nextToughnessMax = searchParams.get("toughnessMax") ?? "";
    const nextSortKey = parseSortKey(searchParams.get("sortKey") ?? defaultSortKey);
    const nextSortDir = parseSortDir(searchParams.get("sortDir"), nextSortKey);

    if (nextQuery !== query) setQuery(nextQuery);
    if (nextOracle !== oracleText) setOracleText(nextOracle);
    if (nextType !== typeLine) setTypeLine(nextType);
    if (nextManaCost !== manaCost) setManaCost(nextManaCost);
    if (nextArtist !== artist) setArtist(nextArtist);
    if (nextFlavor !== flavor) setFlavor(nextFlavor);
    if (nextColors.join(",") !== colors.join(",")) setColors(nextColors);
    if (nextIdentity.join(",") !== colorIdentity.join(",")) {
      setColorIdentity(nextIdentity);
    }
    if (nextRarities.join(",") !== rarities.join(",")) setRarities(nextRarities);
    if (nextTypes.join(",") !== cardTypes.join(",")) setCardTypes(nextTypes);
    if (resolvedSetScope) {
      if (setCodes.join(",") !== [resolvedSetScope].join(",")) {
        setSetCodes([resolvedSetScope]);
      }
    } else if (nextSets.join(",") !== setCodes.join(",")) {
      setSetCodes(nextSets);
    }
    if (nextMvMin !== mvMin) setMvMin(nextMvMin);
    if (nextMvMax !== mvMax) setMvMax(nextMvMax);
    if (nextPowerMin !== powerMin) setPowerMin(nextPowerMin);
    if (nextPowerMax !== powerMax) setPowerMax(nextPowerMax);
    if (nextToughnessMin !== toughnessMin) setToughnessMin(nextToughnessMin);
    if (nextToughnessMax !== toughnessMax) setToughnessMax(nextToughnessMax);
    if (nextSortKey !== sortKey) setSortKey(nextSortKey);
    if (nextSortDir !== sortDir) setSortDir(nextSortDir);
  }, [
    searchParams,
    defaultSortKey,
    resolvedSetScope,
    query,
    oracleText,
    typeLine,
    manaCost,
    artist,
    flavor,
    colors,
    colorIdentity,
    rarities,
    cardTypes,
    setCodes,
    mvMin,
    mvMax,
    powerMin,
    powerMax,
    toughnessMin,
    toughnessMax,
  ]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("name", debouncedQuery);
    if (debouncedOracle) params.set("oracleText", debouncedOracle);
    if (debouncedType) params.set("typeLine", debouncedType);
    if (debouncedManaCost) params.set("manaCost", debouncedManaCost);
    if (debouncedArtist) params.set("artist", debouncedArtist);
    if (debouncedFlavor) params.set("flavor", debouncedFlavor);
    if (colors.length) params.set("colors", colors.join(","));
    if (colorIdentity.length) params.set("colorIdentity", colorIdentity.join(","));
    if (rarities.length) params.set("rarities", rarities.join(","));
    if (cardTypes.length) params.set("types", cardTypes.join(","));
    if (!resolvedSetScope && setCodes.length) params.set("sets", setCodes.join(","));
    if (mvMin) params.set("mvMin", mvMin);
    if (mvMax) params.set("mvMax", mvMax);
    if (powerMin) params.set("powerMin", powerMin);
    if (powerMax) params.set("powerMax", powerMax);
    if (toughnessMin) params.set("toughnessMin", toughnessMin);
    if (toughnessMax) params.set("toughnessMax", toughnessMax);

    if (sortKey !== defaultSortKey) params.set("sortKey", sortKey);
    if (sortDir !== DEFAULT_SORT_DIR[sortKey]) params.set("sortDir", sortDir);

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
  }, [
    debouncedQuery,
    debouncedOracle,
    debouncedType,
    debouncedManaCost,
    debouncedArtist,
    debouncedFlavor,
    colors,
    colorIdentity,
    rarities,
    cardTypes,
    setCodes,
    mvMin,
    mvMax,
    powerMin,
    powerMax,
    toughnessMin,
    toughnessMax,
    sortKey,
    sortDir,
    defaultSortKey,
    resolvedSetScope,
    pathname,
    router,
    searchParams,
  ]);

  React.useEffect(() => {
    async function loadResults() {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("name", debouncedQuery);
      if (debouncedOracle) params.set("oracleText", debouncedOracle);
      if (debouncedType) params.set("typeLine", debouncedType);
      if (debouncedManaCost) params.set("manaCost", debouncedManaCost);
      if (debouncedArtist) params.set("artist", debouncedArtist);
      if (debouncedFlavor) params.set("flavor", debouncedFlavor);
      if (colors.length) params.set("colors", colors.join(","));
      if (colorIdentity.length) params.set("colorIdentity", colorIdentity.join(","));
      if (rarities.length) params.set("rarities", rarities.join(","));
      if (cardTypes.length) params.set("types", cardTypes.join(","));

      const effectiveSets = resolvedSetScope ? [resolvedSetScope] : setCodes;
      if (effectiveSets.length) params.set("sets", effectiveSets.join(","));

      if (mvMin) params.set("mvMin", mvMin);
      if (mvMax) params.set("mvMax", mvMax);
      if (powerMin) params.set("powerMin", powerMin);
      if (powerMax) params.set("powerMax", powerMax);
      if (toughnessMin) params.set("toughnessMin", toughnessMin);
      if (toughnessMax) params.set("toughnessMax", toughnessMax);
      if (sortKey) params.set("sortKey", sortKey);
      if (sortDir) params.set("sortDir", sortDir);

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const data = (await response.json()) as {
        results: CardSummary[];
        meta?: SearchMeta;
      };
      setResults(data.results ?? []);
      setMeta(data.meta ?? null);
      setLoading(false);
    }

    loadResults();
  }, [
    debouncedQuery,
    debouncedOracle,
    debouncedType,
    debouncedManaCost,
    debouncedArtist,
    debouncedFlavor,
    colors,
    colorIdentity,
    rarities,
    cardTypes,
    setCodes,
    mvMin,
    mvMax,
    powerMin,
    powerMax,
    toughnessMin,
    toughnessMax,
    sortKey,
    sortDir,
    resolvedSetScope,
  ]);

  const [modalKey, setModalKey] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  async function adjustOwned(card: CardSummary, delta: number) {
    const response = await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid: card.representativeUuid, delta }),
    });
    if (!response.ok) return;

    setResults((prev) =>
      prev.map((entry) => {
        if (entry.canonicalKey !== card.canonicalKey) return entry;
        const nextQty = Math.max(entry.foilQty, entry.qty + delta);
        return { ...entry, qty: nextQty };
      }),
    );
  }

  function handleTotalsChange(
    canonicalKey: string,
    totals: { qty: number; foilQty: number },
  ) {
    setResults((prev) =>
      prev.map((entry) =>
        entry.canonicalKey === canonicalKey
          ? {
              ...entry,
              qty: totals.qty + totals.foilQty,
              foilQty: totals.foilQty,
            }
          : entry,
      ),
    );
  }

  function clearFilters() {
    setQuery("");
    setOracleText("");
    setTypeLine("");
    setManaCost("");
    setArtist("");
    setFlavor("");
    setColors([]);
    setColorIdentity([]);
    setRarities([]);
    setCardTypes([]);
    setMvMin("");
    setMvMax("");
    setPowerMin("");
    setPowerMax("");
    setToughnessMin("");
    setToughnessMax("");
    setSortKey(defaultSortKey);
    setSortDir(DEFAULT_SORT_DIR[defaultSortKey]);
    setSetSearch("");
    if (!resolvedSetScope) setSetCodes([]);
  }

  const filteredSets = React.useMemo(() => {
    if (!sets.length) return [];
    if (!setSearch.trim()) return sets;
    const term = setSearch.trim().toLowerCase();
    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(term) ||
        set.code.toLowerCase().includes(term),
    );
  }, [sets, setSearch]);

  const priceSupport = meta?.priceSupport ?? { usd: false, eur: false, tix: false };
  const sortAvailability: Record<SortKey, boolean> = {
    name: true,
    releaseDate: true,
    setNumber: true,
    rarity: true,
    color: true,
    priceUsd: priceSupport.usd,
    priceTix: priceSupport.tix,
    priceEur: priceSupport.eur,
    manaValue: true,
    power: true,
    toughness: true,
    artist: true,
    edhrec: meta?.edhrecAvailable ?? false,
    setReview: meta?.setReviewAvailable ?? false,
  };

  const filtersContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Filters
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          onClick={clearFilters}
        >
          Clear
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Results
        </Label>
        <div className="text-sm font-semibold text-white">{results.length}</div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Colors
        </Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={`colors-${color.key}`}
              type="button"
              aria-pressed={colors.includes(color.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                colors.includes(color.key) &&
                  "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
              )}
              onClick={() => toggleSelection(color.key, setColors, colors)}
            >
              <ManaSymbol symbol={color.key} label={color.name} />
              <span>{color.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Color Identity
        </Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={`identity-${color.key}`}
              type="button"
              aria-pressed={colorIdentity.includes(color.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                colorIdentity.includes(color.key) &&
                  "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
              )}
              onClick={() =>
                toggleSelection(color.key, setColorIdentity, colorIdentity)
              }
            >
              <ManaSymbol symbol={color.key} label={color.name} />
              <span>{color.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Rarity
        </Label>
        <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map((option) => (
            <Chip
              key={`rarity-${option.value}`}
              selected={rarities.includes(option.value)}
              onClick={() =>
                toggleSelection(option.value, setRarities, rarities)
              }
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Mana Value
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={mvMin}
            onChange={(event) => setMvMin(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={mvMax}
            onChange={(event) => setMvMax(event.target.value)}
            placeholder="Max"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Card Types
        </Label>
        <div className="flex flex-wrap gap-2">
          {CARD_TYPES.map((type) => (
            <Chip
              key={`type-${type}`}
              selected={cardTypes.includes(type.toLowerCase())}
              onClick={() =>
                toggleSelection(type.toLowerCase(), setCardTypes, cardTypes)
              }
            >
              {type}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Power
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={powerMin}
            onChange={(event) => setPowerMin(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={powerMax}
            onChange={(event) => setPowerMax(event.target.value)}
            placeholder="Max"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Toughness
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={toughnessMin}
            onChange={(event) => setToughnessMin(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={toughnessMax}
            onChange={(event) => setToughnessMax(event.target.value)}
            placeholder="Max"
          />
        </div>
      </div>
    </div>
  );

  const advancedPanel = (
    <Panel className="space-y-6 border border-white/10 bg-gradient-to-br from-slate-900/80 via-indigo-950/60 to-purple-950/70 p-4 shadow-xl ring-1 ring-white/5 backdrop-blur-xl">
      <div className="space-y-2">
        <Label>Card Name</Label>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label>Text</Label>
          <Input
            value={oracleText}
            onChange={(event) => setOracleText(event.target.value)}
            placeholder="Oracle text contains"
          />
        </div>
        <div className="space-y-2">
          <Label>Type Line</Label>
          <Input
            value={typeLine}
            onChange={(event) => setTypeLine(event.target.value)}
            placeholder="Creature"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Colors</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={`advanced-color-${color.key}`}
              type="button"
              aria-pressed={colors.includes(color.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                colors.includes(color.key) &&
                  "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
              )}
              onClick={() => toggleSelection(color.key, setColors, colors)}
            >
              <ManaSymbol symbol={color.key} label={color.name} />
              <span>{color.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Commander / Color Identity</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={`advanced-identity-${color.key}`}
              type="button"
              aria-pressed={colorIdentity.includes(color.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                colorIdentity.includes(color.key) &&
                  "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
              )}
              onClick={() =>
                toggleSelection(color.key, setColorIdentity, colorIdentity)
              }
            >
              <ManaSymbol symbol={color.key} label={color.name} />
              <span>{color.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mana Cost</Label>
        <Input
          value={manaCost}
          onChange={(event) => setManaCost(event.target.value)}
          placeholder="{1}{W}{U}"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Mana Value Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={mvMin}
              onChange={(event) => setMvMin(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={mvMax}
              onChange={(event) => setMvMax(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Power Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={powerMin}
              onChange={(event) => setPowerMin(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={powerMax}
              onChange={(event) => setPowerMax(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Toughness Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={toughnessMin}
              onChange={(event) => setToughnessMin(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={toughnessMax}
              onChange={(event) => setToughnessMax(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
      </div>

      {!resolvedSetScope && (
        <div className="space-y-2">
          <Label>Sets</Label>
          <Input
            value={setSearch}
            onChange={(event) => setSetSearch(event.target.value)}
            placeholder="Search sets by name or code"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2">
            {filteredSets.map((set) => {
              const selected = setCodes.includes(set.code);
              return (
                <label
                  key={set.code}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs text-white/70 transition-all hover:bg-white/10 hover:text-white",
                    selected && "bg-violet-500/20 text-white",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() =>
                        toggleSelection(set.code, setSetCodes, setCodes)
                      }
                    />
                    <span className="font-medium text-white">
                      {set.code}
                    </span>
                    <span className="text-white/60">{set.name}</span>
                  </div>
                  <span className="text-[0.6rem] text-white/50">
                    {set.type ?? "n/a"}
                  </span>
                </label>
              );
            })}
            {!filteredSets.length && (
              <div className="px-2 py-3 text-xs text-white/50">
                No sets found.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Rarity</Label>
        <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map((option) => (
            <Chip
              key={`advanced-rarity-${option.value}`}
              selected={rarities.includes(option.value)}
              onClick={() =>
                toggleSelection(option.value, setRarities, rarities)
              }
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Artist Name</Label>
          <Input
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder="Rebecca Guay"
          />
        </div>
        <div className="space-y-2">
          <Label>Flavor Text</Label>
          <Input
            value={flavor}
            onChange={(event) => setFlavor(event.target.value)}
            placeholder="Flavor text contains"
          />
        </div>
      </div>
    </Panel>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-white/60">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select
              value={sortKey}
              onValueChange={(value) => {
                const nextKey = value as SortKey;
                setSortKey(nextKey);
                setSortDir(DEFAULT_SORT_DIR[nextKey] ?? "asc");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => {
                  const available = sortAvailability[option.key];
                  return (
                    <SelectItem
                      key={option.key}
                      value={option.key}
                      disabled={!available}
                      title={
                        !available ? "Not available in MTGJSON/index" : undefined
                      }
                      className="data-[disabled]:pointer-events-auto"
                    >
                      {option.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() =>
              setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
            }
          >
            {sortDir === "asc" ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-6">
              <SheetHeader className="p-0">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">{filtersContent}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards by name"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-label={advancedOpen ? "Hide advanced search" : "Show advanced search"}
              title={advancedOpen ? "Hide advanced search" : "Advanced search"}
            >
              {advancedOpen ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
          {advancedOpen && advancedPanel}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          {loading ? (
            <p className="text-sm text-white/60">Searching...</p>
          ) : (
            <p className="text-sm text-white/60">
              Showing {results.length} cards
            </p>
          )}

          {results.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((card) => (
                <CardTile
                  key={card.canonicalKey}
                  card={card}
                  onOpen={(key) => {
                    setModalKey(key);
                    setModalOpen(true);
                  }}
                  onAdjustOwned={adjustOwned}
                />
              ))}
            </div>
          ) : (
            <Panel className="p-6 text-sm text-white/60">
              No cards match these filters yet.
            </Panel>
          )}
        </div>

        <aside className="hidden w-72 lg:block">
          <Panel className="p-4">{filtersContent}</Panel>
        </aside>
      </div>

      <CardDetailModal
        canonicalKey={modalKey}
        open={modalOpen}
        onOpenChange={(openState) => {
          setModalOpen(openState);
          if (!openState) setModalKey(null);
        }}
        onTotalsChange={handleTotalsChange}
      />
    </div>
  );
}

export { SearchResultsView };
