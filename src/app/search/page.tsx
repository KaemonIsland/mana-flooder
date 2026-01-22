"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { CardSummary, CardTile } from "@/components/cards/card-tile";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { COLOR_OPTIONS } from "@/lib/mtgjson/colors";

type SetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
};

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
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

function parseRange(minRaw: string | null, maxRaw: string | null) {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  return [
    Number.isFinite(min) ? min : 0,
    Number.isFinite(max) ? max : 12,
  ] as [number, number];
}

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [results, setResults] = useState<CardSummary[]>([]);
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [oracleText, setOracleText] = useState(searchParams.get("oracle") ?? "");
  const [typeText, setTypeText] = useState(searchParams.get("type") ?? "");
  const [colors, setColors] = useState<string[]>(
    parseList(searchParams.get("colors")),
  );
  const [colorIdentity, setColorIdentity] = useState<string[]>(
    parseList(searchParams.get("identity")),
  );
  const [rarity, setRarity] = useState(searchParams.get("rarity") ?? "");
  const [setCode, setSetCode] = useState(searchParams.get("set") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "newest");
  const [manaRange, setManaRange] = useState<[number, number]>(
    parseRange(searchParams.get("mvMin"), searchParams.get("mvMax")),
  );

  const debouncedQuery = useDebouncedValue(query, 300);
  const debouncedOracle = useDebouncedValue(oracleText, 300);
  const debouncedType = useDebouncedValue(typeText, 300);
  const hasSetDefaulted = useRef(false);

  useEffect(() => {
    async function loadSets() {
      const response = await fetch("/api/sets");
      if (!response.ok) return;
      const data = (await response.json()) as { sets: SetSummary[] };
      setSets(data.sets ?? []);
    }

    loadSets();
  }, []);

  useEffect(() => {
    if (hasSetDefaulted.current) return;
    if (sets.length) {
      if (!setCode) {
        setSetCode(sets[0].code);
      }
      hasSetDefaulted.current = true;
    }
  }, [setCode, sets]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") ?? "";
    const nextOracle = searchParams.get("oracle") ?? "";
    const nextType = searchParams.get("type") ?? "";
    const nextColors = parseList(searchParams.get("colors"));
    const nextIdentity = parseList(searchParams.get("identity"));
    const nextRarity = searchParams.get("rarity") ?? "";
    const nextSet = searchParams.get("set") ?? "";
    const nextSort = searchParams.get("sort") ?? "newest";
    const nextRange = parseRange(
      searchParams.get("mvMin"),
      searchParams.get("mvMax"),
    );

    if (nextQuery !== query) setQuery(nextQuery);
    if (nextOracle !== oracleText) setOracleText(nextOracle);
    if (nextType !== typeText) setTypeText(nextType);
    if (nextRarity !== rarity) setRarity(nextRarity);
    if (nextSet !== setCode) setSetCode(nextSet);
    if (nextSort !== sort) setSort(nextSort);
    if (nextRange[0] !== manaRange[0] || nextRange[1] !== manaRange[1]) {
      setManaRange(nextRange);
    }
    if (nextColors.join(",") !== colors.join(",")) setColors(nextColors);
    if (nextIdentity.join(",") !== colorIdentity.join(",")) {
      setColorIdentity(nextIdentity);
    }
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (debouncedOracle) params.set("oracle", debouncedOracle);
    if (debouncedType) params.set("type", debouncedType);
    if (colors.length) params.set("colors", colors.join(","));
    if (colorIdentity.length) params.set("identity", colorIdentity.join(","));
    if (rarity) params.set("rarity", rarity);
    if (setCode) params.set("set", setCode);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (manaRange[0] !== 0) params.set("mvMin", String(manaRange[0]));
    if (manaRange[1] !== 12) params.set("mvMax", String(manaRange[1]));

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
    colors,
    colorIdentity,
    rarity,
    setCode,
    sort,
    manaRange,
    pathname,
    router,
  ]);

  const computedQuery = useMemo(() => {
    const parts = [debouncedQuery];
    if (debouncedOracle) parts.push(`o:"${debouncedOracle}"`);
    if (debouncedType) parts.push(`t:"${debouncedType}"`);
    return parts.filter(Boolean).join(" ").trim();
  }, [debouncedQuery, debouncedOracle, debouncedType]);

  useEffect(() => {
    async function loadResults() {
      setLoading(true);
      const params = new URLSearchParams();
      if (computedQuery) params.set("q", computedQuery);
      if (colors.length) params.set("colors", colors.join(","));
      if (colorIdentity.length) params.set("colorIdentity", colorIdentity.join(","));
      if (rarity) params.set("rarity", rarity);
      if (setCode) params.set("set", setCode);
      if (manaRange[0] !== 0) params.set("mvMin", String(manaRange[0]));
      if (manaRange[1] !== 12) params.set("mvMax", String(manaRange[1]));
      params.set("sort", sort);

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { results: CardSummary[] };
      setResults(data.results ?? []);
      setLoading(false);
    }

    loadResults();
  }, [
    computedQuery,
    colors,
    colorIdentity,
    rarity,
    setCode,
    manaRange,
    sort,
  ]);

  const visibleCards = useMemo(
    () => results,
    [results],
  );

  const [modalKey, setModalKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  function clearFilters() {
    setQuery("");
    setOracleText("");
    setTypeText("");
    setColors([]);
    setColorIdentity([]);
    setRarity("");
    setSetCode(sets[0]?.code ?? "");
    setSort("newest");
    setManaRange([0, 12]);
  }

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
          Colors
        </Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <Chip
              key={`colors-${color.key}`}
              selected={colors.includes(color.key)}
              onClick={() => toggleSelection(color.key, setColors, colors)}
            >
              {color.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Color identity
        </Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <Chip
              key={`identity-${color.key}`}
              selected={colorIdentity.includes(color.key)}
              onClick={() =>
                toggleSelection(color.key, setColorIdentity, colorIdentity)
              }
            >
              {color.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Mana value
        </Label>
        <Slider
          value={manaRange}
          min={0}
          max={12}
          step={1}
          className="pt-2"
          onValueChange={(value) =>
            setManaRange([value[0], value[1]] as [number, number])
          }
        />
        <div className="text-xs text-white/60">
          {manaRange[0]} - {manaRange[1]}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Rarity
        </Label>
        <Select
          value={rarity || "all"}
          onValueChange={(value) => setRarity(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Any rarity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="common">Common</SelectItem>
            <SelectItem value="uncommon">Uncommon</SelectItem>
            <SelectItem value="rare">Rare</SelectItem>
            <SelectItem value="mythic">Mythic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-white/60">
          Set
        </Label>
        <Select
          value={setCode || "all"}
          onValueChange={(value) => setSetCode(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Newest set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sets</SelectItem>
            {sets.map((set) => (
              <SelectItem key={set.code} value={set.code}>
                {set.code} - {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
          <p className="text-sm text-white/60">
            Advanced search across the newest sets by default.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest set</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="oldest">Oldest set</SelectItem>
                <SelectItem value="mana">Mana value</SelectItem>
                <SelectItem value="owned">Owned count</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              >
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

      <Panel className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-2">
            <Label>Search name</Label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards"
            />
          </div>
          <div className="space-y-2">
            <Label>Oracle text</Label>
            <Input
              value={oracleText}
              onChange={(event) => setOracleText(event.target.value)}
              placeholder="Draw a card"
            />
          </div>
          <div className="space-y-2">
            <Label>Type line</Label>
            <Input
              value={typeText}
              onChange={(event) => setTypeText(event.target.value)}
              placeholder="Creature"
            />
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          {loading ? (
            <p className="text-sm text-white/60">Searching...</p>
          ) : (
            <p className="text-sm text-white/60">
              Showing {visibleCards.length} cards
            </p>
          )}

          {visibleCards.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCards.map((card) => (
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
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setModalKey(null);
        }}
        onTotalsChange={handleTotalsChange}
      />
    </div>
  );
}
