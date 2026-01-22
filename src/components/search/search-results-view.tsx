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
import {
  DEFAULT_SORT_DIR,
  type SearchStateUpdate,
  type SortKey,
  getSearchState,
  setSearchState,
} from "@/lib/queryState";

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

function toggleList(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
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
  const searchState = React.useMemo(
    () =>
      getSearchState(searchParams, {
        defaultSortKey,
        setScope: resolvedSetScope,
      }),
    [defaultSortKey, resolvedSetScope, searchParams],
  );

  const [results, setResults] = React.useState<CardSummary[]>([]);
  const [sets, setSets] = React.useState<SetSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [meta, setMeta] = React.useState<SearchMeta | null>(null);

  const [nameInput, setNameInput] = React.useState(searchState.name);
  const [oracleInput, setOracleInput] = React.useState(searchState.oracleText);
  const [typeInput, setTypeInput] = React.useState(searchState.typeLine);
  const [manaCostInput, setManaCostInput] = React.useState(searchState.manaCost);
  const [artistInput, setArtistInput] = React.useState(searchState.artist);
  const [flavorInput, setFlavorInput] = React.useState(searchState.flavor);
  const [mvMinInput, setMvMinInput] = React.useState(searchState.mvMin);
  const [mvMaxInput, setMvMaxInput] = React.useState(searchState.mvMax);
  const [powerMinInput, setPowerMinInput] = React.useState(searchState.powerMin);
  const [powerMaxInput, setPowerMaxInput] = React.useState(searchState.powerMax);
  const [toughnessMinInput, setToughnessMinInput] = React.useState(
    searchState.toughnessMin,
  );
  const [toughnessMaxInput, setToughnessMaxInput] = React.useState(
    searchState.toughnessMax,
  );

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [setSearch, setSetSearch] = React.useState("");

  React.useEffect(() => {
    setNameInput(searchState.name);
    setOracleInput(searchState.oracleText);
    setTypeInput(searchState.typeLine);
    setManaCostInput(searchState.manaCost);
    setArtistInput(searchState.artist);
    setFlavorInput(searchState.flavor);
    setMvMinInput(searchState.mvMin);
    setMvMaxInput(searchState.mvMax);
    setPowerMinInput(searchState.powerMin);
    setPowerMaxInput(searchState.powerMax);
    setToughnessMinInput(searchState.toughnessMin);
    setToughnessMaxInput(searchState.toughnessMax);
  }, [searchState]);

  const debouncedName = useDebouncedValue(nameInput, 250);
  const debouncedOracle = useDebouncedValue(oracleInput, 250);
  const debouncedType = useDebouncedValue(typeInput, 250);
  const debouncedManaCost = useDebouncedValue(manaCostInput, 250);
  const debouncedArtist = useDebouncedValue(artistInput, 250);
  const debouncedFlavor = useDebouncedValue(flavorInput, 250);
  const debouncedMvMin = useDebouncedValue(mvMinInput, 250);
  const debouncedMvMax = useDebouncedValue(mvMaxInput, 250);
  const debouncedPowerMin = useDebouncedValue(powerMinInput, 250);
  const debouncedPowerMax = useDebouncedValue(powerMaxInput, 250);
  const debouncedToughnessMin = useDebouncedValue(toughnessMinInput, 250);
  const debouncedToughnessMax = useDebouncedValue(toughnessMaxInput, 250);

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
    const update: SearchStateUpdate = {};
    if (debouncedName !== searchState.name) update.name = debouncedName;
    if (debouncedOracle !== searchState.oracleText) {
      update.oracleText = debouncedOracle;
    }
    if (debouncedType !== searchState.typeLine) update.typeLine = debouncedType;
    if (debouncedManaCost !== searchState.manaCost) {
      update.manaCost = debouncedManaCost;
    }
    if (debouncedArtist !== searchState.artist) update.artist = debouncedArtist;
    if (debouncedFlavor !== searchState.flavor) update.flavor = debouncedFlavor;
    if (debouncedMvMin !== searchState.mvMin) update.mvMin = debouncedMvMin;
    if (debouncedMvMax !== searchState.mvMax) update.mvMax = debouncedMvMax;
    if (debouncedPowerMin !== searchState.powerMin) {
      update.powerMin = debouncedPowerMin;
    }
    if (debouncedPowerMax !== searchState.powerMax) {
      update.powerMax = debouncedPowerMax;
    }
    if (debouncedToughnessMin !== searchState.toughnessMin) {
      update.toughnessMin = debouncedToughnessMin;
    }
    if (debouncedToughnessMax !== searchState.toughnessMax) {
      update.toughnessMax = debouncedToughnessMax;
    }

    if (Object.keys(update).length === 0) return;
    setSearchState(router, pathname, searchParams, update, {
      defaultSortKey,
      setScope: resolvedSetScope,
    });
  }, [
    debouncedArtist,
    debouncedFlavor,
    debouncedManaCost,
    debouncedMvMax,
    debouncedMvMin,
    debouncedName,
    debouncedOracle,
    debouncedPowerMax,
    debouncedPowerMin,
    debouncedToughnessMax,
    debouncedToughnessMin,
    debouncedType,
    defaultSortKey,
    pathname,
    resolvedSetScope,
    router,
    searchParams,
    searchState.artist,
    searchState.flavor,
    searchState.manaCost,
    searchState.mvMax,
    searchState.mvMin,
    searchState.name,
    searchState.oracleText,
    searchState.powerMax,
    searchState.powerMin,
    searchState.toughnessMax,
    searchState.toughnessMin,
    searchState.typeLine,
  ]);

  React.useEffect(() => {
    async function loadResults() {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchState.name) params.set("name", searchState.name);
      if (searchState.oracleText) params.set("oracleText", searchState.oracleText);
      if (searchState.typeLine) params.set("typeLine", searchState.typeLine);
      if (searchState.manaCost) params.set("manaCost", searchState.manaCost);
      if (searchState.artist) params.set("artist", searchState.artist);
      if (searchState.flavor) params.set("flavor", searchState.flavor);
      if (searchState.colors.length)
        params.set("colors", searchState.colors.join(","));
      if (searchState.colorIdentity.length)
        params.set("colorIdentity", searchState.colorIdentity.join(","));
      if (searchState.rarities.length)
        params.set("rarities", searchState.rarities.join(","));
      if (searchState.cardTypes.length)
        params.set("types", searchState.cardTypes.join(","));
      if (searchState.setCodes.length)
        params.set("sets", searchState.setCodes.join(","));

      if (searchState.mvMin) params.set("mvMin", searchState.mvMin);
      if (searchState.mvMax) params.set("mvMax", searchState.mvMax);
      if (searchState.powerMin) params.set("powerMin", searchState.powerMin);
      if (searchState.powerMax) params.set("powerMax", searchState.powerMax);
      if (searchState.toughnessMin)
        params.set("toughnessMin", searchState.toughnessMin);
      if (searchState.toughnessMax)
        params.set("toughnessMax", searchState.toughnessMax);
      if (searchState.sortKey) params.set("sortKey", searchState.sortKey);
      if (searchState.sortDir) params.set("sortDir", searchState.sortDir);

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
    searchState,
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
    setNameInput("");
    setOracleInput("");
    setTypeInput("");
    setManaCostInput("");
    setArtistInput("");
    setFlavorInput("");
    setMvMinInput("");
    setMvMaxInput("");
    setPowerMinInput("");
    setPowerMaxInput("");
    setToughnessMinInput("");
    setToughnessMaxInput("");
    const update: SearchStateUpdate = {
      name: "",
      oracleText: "",
      typeLine: "",
      manaCost: "",
      artist: "",
      flavor: "",
      colors: [],
      colorIdentity: [],
      rarities: [],
      cardTypes: [],
      mvMin: "",
      mvMax: "",
      powerMin: "",
      powerMax: "",
      toughnessMin: "",
      toughnessMax: "",
      sortKey: defaultSortKey,
      sortDir: DEFAULT_SORT_DIR[defaultSortKey],
    };
    if (!resolvedSetScope) update.setCodes = [];

    setSearchState(router, pathname, searchParams, update, {
      defaultSortKey,
      setScope: resolvedSetScope,
    });
    setSetSearch("");
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
          {COLOR_OPTIONS.map((color) => {
            const selected = searchState.colors.includes(color.key);
            return (
              <button
                key={`colors-${color.key}`}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  selected &&
                    "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
                )}
                onClick={() => {
                  const nextColors = toggleList(searchState.colors, color.key);
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { colors: nextColors },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                <ManaSymbol symbol={color.key} label={color.name} />
                <span>{color.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Color Identity
        </Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => {
            const selected = searchState.colorIdentity.includes(color.key);
            return (
              <button
                key={`identity-${color.key}`}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  selected &&
                    "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
                )}
                onClick={() => {
                  const nextIdentity = toggleList(
                    searchState.colorIdentity,
                    color.key,
                  );
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { colorIdentity: nextIdentity },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                <ManaSymbol symbol={color.key} label={color.name} />
                <span>{color.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Rarity
        </Label>
        <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map((option) => {
            const selected = searchState.rarities.includes(option.value);
            return (
              <Chip
                key={`rarity-${option.value}`}
                selected={selected}
                onClick={() => {
                  const nextRarities = toggleList(
                    searchState.rarities,
                    option.value,
                  );
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { rarities: nextRarities },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                {option.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Mana Value
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={mvMinInput}
            onChange={(event) => setMvMinInput(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={mvMaxInput}
            onChange={(event) => setMvMaxInput(event.target.value)}
            placeholder="Max"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Card Types
        </Label>
        <div className="flex flex-wrap gap-2">
          {CARD_TYPES.map((type) => {
            const value = type.toLowerCase();
            const selected = searchState.cardTypes.includes(value);
            return (
              <Chip
                key={`type-${type}`}
                selected={selected}
                onClick={() => {
                  const nextTypes = toggleList(searchState.cardTypes, value);
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { cardTypes: nextTypes },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                {type}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Power
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            value={powerMinInput}
            onChange={(event) => setPowerMinInput(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={powerMaxInput}
            onChange={(event) => setPowerMaxInput(event.target.value)}
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
            value={toughnessMinInput}
            onChange={(event) => setToughnessMinInput(event.target.value)}
            placeholder="Min"
          />
          <Input
            type="number"
            value={toughnessMaxInput}
            onChange={(event) => setToughnessMaxInput(event.target.value)}
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
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Search by name"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label>Text</Label>
          <Input
            value={oracleInput}
            onChange={(event) => setOracleInput(event.target.value)}
            placeholder="Oracle text contains"
          />
        </div>
        <div className="space-y-2">
          <Label>Type Line</Label>
          <Input
            value={typeInput}
            onChange={(event) => setTypeInput(event.target.value)}
            placeholder="Creature"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Colors</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => {
            const selected = searchState.colors.includes(color.key);
            return (
              <button
                key={`advanced-color-${color.key}`}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  selected &&
                    "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
                )}
                onClick={() => {
                  const nextColors = toggleList(searchState.colors, color.key);
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { colors: nextColors },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                <ManaSymbol symbol={color.key} label={color.name} />
                <span>{color.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Commander / Color Identity</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => {
            const selected = searchState.colorIdentity.includes(color.key);
            return (
              <button
                key={`advanced-identity-${color.key}`}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  selected &&
                    "border-violet-400/40 bg-violet-500/20 text-white ring-1 ring-violet-400/40",
                )}
                onClick={() => {
                  const nextIdentity = toggleList(
                    searchState.colorIdentity,
                    color.key,
                  );
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { colorIdentity: nextIdentity },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                <ManaSymbol symbol={color.key} label={color.name} />
                <span>{color.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mana Cost</Label>
        <Input
          value={manaCostInput}
          onChange={(event) => setManaCostInput(event.target.value)}
          placeholder="{1}{W}{U}"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Mana Value Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={mvMinInput}
              onChange={(event) => setMvMinInput(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={mvMaxInput}
              onChange={(event) => setMvMaxInput(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Power Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={powerMinInput}
              onChange={(event) => setPowerMinInput(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={powerMaxInput}
              onChange={(event) => setPowerMaxInput(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Toughness Min / Max</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={toughnessMinInput}
              onChange={(event) => setToughnessMinInput(event.target.value)}
              placeholder="Min"
            />
            <Input
              type="number"
              value={toughnessMaxInput}
              onChange={(event) => setToughnessMaxInput(event.target.value)}
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
              const selected = searchState.setCodes.includes(set.code);
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
                      onCheckedChange={() => {
                        const nextSets = toggleList(
                          searchState.setCodes,
                          set.code,
                        );
                        setSearchState(
                          router,
                          pathname,
                          searchParams,
                          { setCodes: nextSets },
                          { defaultSortKey, setScope: resolvedSetScope },
                        );
                      }}
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
          {RARITY_OPTIONS.map((option) => {
            const selected = searchState.rarities.includes(option.value);
            return (
              <Chip
                key={`advanced-rarity-${option.value}`}
                selected={selected}
                onClick={() => {
                  const nextRarities = toggleList(
                    searchState.rarities,
                    option.value,
                  );
                  setSearchState(
                    router,
                    pathname,
                    searchParams,
                    { rarities: nextRarities },
                    { defaultSortKey, setScope: resolvedSetScope },
                  );
                }}
              >
                {option.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Artist Name</Label>
          <Input
            value={artistInput}
            onChange={(event) => setArtistInput(event.target.value)}
            placeholder="Rebecca Guay"
          />
        </div>
        <div className="space-y-2">
          <Label>Flavor Text</Label>
          <Input
            value={flavorInput}
            onChange={(event) => setFlavorInput(event.target.value)}
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
              value={searchState.sortKey}
              onValueChange={(value) => {
                const nextKey = value as SortKey;
                setSearchState(
                  router,
                  pathname,
                  searchParams,
                  {
                    sortKey: nextKey,
                    sortDir: DEFAULT_SORT_DIR[nextKey] ?? "asc",
                  },
                  { defaultSortKey, setScope: resolvedSetScope },
                );
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
              setSearchState(
                router,
                pathname,
                searchParams,
                {
                  sortDir: searchState.sortDir === "asc" ? "desc" : "asc",
                },
                { defaultSortKey, setScope: resolvedSetScope },
              )
            }
          >
            {searchState.sortDir === "asc" ? (
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
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
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
              {results.map((card, index) => (
                <CardTile
                  key={card.representativeUuid ?? `${card.canonicalKey}-${index}`}
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
