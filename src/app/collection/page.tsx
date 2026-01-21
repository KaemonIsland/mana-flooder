"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandInput } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type SearchResult = {
  canonicalKey: string;
  representativeUuid: string;
  name: string;
  manaCost: string | null;
  manaValue: number | null;
  typeLine: string | null;
  rarity: string | null;
  colors: string[];
  colorIdentity: string[];
  latestSetCode: string | null;
  latestReleaseDate: string | null;
  qty: number;
  foilQty: number;
};

type SetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
};

const colorOptions = [
  { key: "W", label: "W" },
  { key: "U", label: "U" },
  { key: "B", label: "B" },
  { key: "R", label: "R" },
  { key: "G", label: "G" },
  { key: "C", label: "C" },
  { key: "M", label: "Multi" },
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

function ColorPips({ identity }: { identity: string[] }) {
  if (!identity.length) {
    return <Badge variant="secondary">C</Badge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {identity.map((color) => (
        <Badge key={color} variant="secondary">
          {color}
        </Badge>
      ))}
    </div>
  );
}

export default function CollectionPage() {
  const [query, setQuery] = useState("");
  const [oracleText, setOracleText] = useState("");
  const [typeText, setTypeText] = useState("");
  const [quickSearch, setQuickSearch] = useState(true);
  const [manaRange, setManaRange] = useState<[number, number]>([0, 10]);
  const [rarity, setRarity] = useState("");
  const [setCode, setSetCode] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [colorIdentity, setColorIdentity] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 400);
  const debouncedOracle = useDebouncedValue(oracleText, 400);
  const debouncedType = useDebouncedValue(typeText, 400);

  const computedQuery = useMemo(() => {
    const parts = [debouncedQuery];
    if (debouncedOracle) parts.push(`o:"${debouncedOracle}"`);
    if (debouncedType) parts.push(`t:"${debouncedType}"`);
    return parts.filter(Boolean).join(" ").trim();
  }, [debouncedQuery, debouncedOracle, debouncedType]);

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
    async function loadResults() {
      setLoading(true);
      const params = new URLSearchParams();
      if (computedQuery) params.set("q", computedQuery);
      if (colors.length) params.set("colors", colors.join(","));
      if (colorIdentity.length)
        params.set("colorIdentity", colorIdentity.join(","));
      if (rarity) params.set("rarity", rarity);
      if (setCode) params.set("set", setCode);
      if (!quickSearch) {
        params.set("mvMin", String(manaRange[0]));
        params.set("mvMax", String(manaRange[1]));
      }
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const data = await response.json();
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
    quickSearch,
  ]);

  async function updateCollection(cardUuid: string, delta: number) {
    const response = await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid, delta }),
    });

    if (!response.ok) return;
    const data = await response.json();
    const updatedQty = data.card?.qty ?? 0;

    setResults((prev) =>
      prev.map((card) =>
        card.representativeUuid === cardUuid
          ? { ...card, qty: updatedQty + card.foilQty }
          : card,
      ),
    );
  }

  function toggleSelection(value: string, setState: (next: string[]) => void, state: string[]) {
    if (state.includes(value)) {
      setState(state.filter((item) => item !== value));
    } else {
      setState([...state, value]);
    }
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[320px] flex-1">
              <Command className="rounded-lg border">
                <CommandInput
                  placeholder="Search cards (name, text, etc.)"
                  value={query}
                  onValueChange={setQuery}
                />
              </Command>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!quickSearch}
                onCheckedChange={(value) => setQuickSearch(!value)}
              />
              <span className="text-sm text-muted-foreground">
                {quickSearch ? "Quick Search" : "Advanced Search"}
              </span>
            </div>
            <div className="w-52">
              <Select
                value={setCode || "all"}
                onValueChange={(value) =>
                  setSetCode(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sets</SelectItem>
                  {sets.map((set) => (
                    <SelectItem key={set.code} value={set.code}>
                      {set.code} — {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!quickSearch && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Oracle text contains</Label>
                <Input
                  value={oracleText}
                  onChange={(event) => setOracleText(event.target.value)}
                  placeholder="Draw a card"
                />
              </div>
              <div className="space-y-2">
                <Label>Type contains</Label>
                <Input
                  value={typeText}
                  onChange={(event) => setTypeText(event.target.value)}
                  placeholder="Creature"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading cards...</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Showing {results.length} cards
            </p>
          )}

          <div className="grid gap-3">
            {results.map((card) => (
              <Link
                key={card.canonicalKey}
                href={`/cards/${encodeURIComponent(card.canonicalKey)}`}
                className="block"
              >
                <Card className="cursor-pointer p-4 hover:border-primary/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{card.name}</h3>
                        <span className="text-sm text-muted-foreground">
                          {card.manaCost}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {card.typeLine} • {card.latestSetCode ?? "n/a"} •{" "}
                        {card.rarity ?? "n/a"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ColorPips identity={card.colorIdentity} />
                      <Badge variant="secondary">Owned: {card.qty}</Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={(event) => {
                            event.preventDefault();
                            updateCollection(card.representativeUuid, -1);
                          }}
                        >
                          -
                        </Button>
                        <Button
                          size="icon"
                          onClick={(event) => {
                            event.preventDefault();
                            updateCollection(card.representativeUuid, 1);
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <aside className="w-80 space-y-6 border-l pl-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Filters
          </h3>

          <div className="space-y-2">
            <Label>Colors</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <Button
                  key={color.key}
                  variant={colors.includes(color.key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSelection(color.key, setColors, colors)}
                >
                  {color.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color identity</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <Button
                  key={color.key}
                  variant={
                    colorIdentity.includes(color.key) ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    toggleSelection(color.key, setColorIdentity, colorIdentity)
                  }
                >
                  {color.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mana value</Label>
            <Slider
              value={manaRange}
              min={0}
              max={12}
              step={1}
              onValueChange={(value) =>
                setManaRange([value[0], value[1]] as [number, number])
              }
            />
            <div className="text-xs text-muted-foreground">
              {manaRange[0]} - {manaRange[1]}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rarity</Label>
            <Select
              value={rarity || "all"}
              onValueChange={(value) =>
                setRarity(value === "all" ? "" : value)
              }
            >
              <SelectTrigger>
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
        </div>
      </aside>
    </div>
  );
}
