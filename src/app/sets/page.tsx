"use client";

import * as React from "react";
import Link from "next/link";

import { SetSymbol } from "@/components/cards/set-symbol";
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

type SetSummary = {
  code: string;
  name: string;
  releaseDate: string | null;
  type: string | null;
  symbol: string | null;
};

export default function SetsPage() {
  const [sets, setSets] = React.useState<SetSummary[]>([]);
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  React.useEffect(() => {
    async function loadSets() {
      const response = await fetch("/api/sets");
      if (!response.ok) return;
      const data = (await response.json()) as { sets: SetSummary[] };
      setSets(data.sets ?? []);
    }

    loadSets();
  }, []);

  const types = React.useMemo(() => {
    const values = new Set<string>();
    sets.forEach((set) => {
      if (set.type) values.add(set.type);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [sets]);

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return sets.filter((set) => {
      if (typeFilter !== "all" && set.type !== typeFilter) return false;
      if (!term) return true;
      return (
        set.name.toLowerCase().includes(term) ||
        set.code.toLowerCase().includes(term)
      );
    });
  }, [sets, query, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sets</h1>
        <p className="text-sm text-white/60">
          Browse MTG sets by type, name, or set code.
        </p>
      </div>

      <Panel className="space-y-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <Label>Search sets</Label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or code"
            />
          </div>
          <div className="space-y-2">
            <Label>Set type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((set) => (
            <Link key={set.code} href={`/sets/${set.code}`}>
              <Panel className="h-full space-y-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-xl hover:ring-2 hover:ring-violet-400/20">
                <div className="flex items-center gap-2">
                  <SetSymbol
                    setCode={set.code}
                    rarity="rare"
                    className="text-[0.55rem]"
                  />
                  <div className="text-sm font-semibold text-white">
                    {set.name}
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  {set.code}
                  {set.type ? ` • ${set.type}` : ""}
                </div>
                <div className="text-xs text-white/50">
                  {set.releaseDate ?? "Release date unknown"}
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      ) : (
        <Panel className="p-6 text-sm text-white/60">
          No sets match those filters yet.
        </Panel>
      )}
    </div>
  );
}
