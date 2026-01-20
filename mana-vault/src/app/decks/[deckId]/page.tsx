"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DeckCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

type DeckCard = {
  id: string;
  cardUuid: string;
  qty: number;
  category: string;
  isCommander: boolean;
  ownedQty: number;
  details: CardDetails | null;
};

type CardDetails = {
  cardUuid: string;
  name: string;
  manaValue: number | null;
  typeLine: string | null;
  colorIdentity: string;
  isBasic: boolean;
  isCommander: boolean;
  legalCommander: string | null;
  isBannedCommander: boolean;
};

type DeckData = {
  deck: {
    id: string;
    name: string;
    allowMissing: boolean;
    notes: string | null;
    categories: DeckCategory[];
  };
  cards: DeckCard[];
  stats: DeckStats;
  validation: DeckValidation;
};

type DeckStats = {
  totalCards: number;
  totalNonLands: number;
  manaCurve: Array<{ manaValue: number; count: number }>;
  colorDistribution: Array<{ color: string; count: number }>;
  typeBreakdown: Array<{ type: string; count: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
  avgManaValue: number | null;
  avgManaValueNonLands: number | null;
};

type DeckValidation = {
  status: "ok" | "warning" | "error";
  issues: Array<{ type: string; message: string; cardUuid?: string }>;
  commanderColorIdentity: string;
};

type SearchResult = {
  cardUuid: string;
  name: string;
  setCode: string;
  manaCost: string | null;
  typeLine: string | null;
  rarity: string | null;
  colorIdentity: string;
  isBannedCommander: boolean;
  legalCommander: string | null;
  qty: number;
};

function DraggableCard({
  card,
  onIncrement,
  onDecrement,
  onToggleCommander,
  issues,
}: {
  card: DeckCard;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggleCommander: () => void;
  issues: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.cardUuid,
      data: { category: card.category },
    });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab text-xs text-muted-foreground"
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <div>
          <div className="font-medium">{card.details?.name ?? "Unknown"}</div>
          <div className="text-xs text-muted-foreground">
            {card.details?.typeLine ?? "Unknown type"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {issues.map((issue) => (
          <Badge key={issue} variant="destructive">
            {issue}
          </Badge>
        ))}
        {card.isCommander && <Badge variant="outline">Commander</Badge>}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={onDecrement}>
            -
          </Button>
          <Badge variant="secondary">{card.qty}</Badge>
          <Button size="icon" onClick={onIncrement}>
            +
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={onToggleCommander}>
          {card.isCommander ? "Unset" : "Set"} commander
        </Button>
      </div>
    </div>
  );
}

function CategoryDropzone({
  category,
  cards,
  onIncrement,
  onDecrement,
  onToggleCommander,
  issueMap,
}: {
  category: DeckCategory;
  cards: DeckCard[];
  onIncrement: (cardUuid: string) => void;
  onDecrement: (cardUuid: string) => void;
  onToggleCommander: (cardUuid: string) => void;
  issueMap: Map<string, string[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.name });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-xl border bg-card p-3 text-card-foreground shadow-sm ${
        isOver ? "border-primary" : ""
      }`}
    >
      <div className="text-sm font-semibold">{category.name}</div>
      <div className="space-y-2">
        {cards.map((card) => (
          <DraggableCard
            key={card.cardUuid}
            card={card}
            onIncrement={() => onIncrement(card.cardUuid)}
            onDecrement={() => onDecrement(card.cardUuid)}
            onToggleCommander={() => onToggleCommander(card.cardUuid)}
            issues={issueMap.get(card.cardUuid) ?? []}
          />
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground">Drop cards here.</p>
        )}
      </div>
    </div>
  );
}

function bucketType(typeLine: string | null) {
  if (!typeLine) return "Other";
  const buckets = [
    "Creature",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Land",
    "Battle",
  ];
  return buckets.find((bucket) => typeLine.includes(bucket)) ?? "Other";
}

function groupCardsBy(
  cards: DeckCard[],
  keyFn: (card: DeckCard) => string,
) {
  const map = new Map<string, DeckCard[]>();
  cards.forEach((card) => {
    const key = keyFn(card);
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(card);
  });
  return map;
}

function GroupedCardList({ groups }: { groups: Array<[string, DeckCard[]]> }) {
  return (
    <div className="space-y-3">
      {groups.map(([group, cards]) => (
        <Card key={group} className="p-3">
          <div className="text-sm font-semibold">{group}</div>
          <div className="mt-2 space-y-2">
            {cards.map((card) => (
              <div
                key={card.cardUuid}
                className="flex items-center justify-between text-sm"
              >
                <span>{card.details?.name ?? "Unknown"}</span>
                <Badge variant="secondary">{card.qty}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function DeckEditorPage() {
  const params = useParams();
  const deckId = params.deckId as string;
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [view, setView] = useState("category");
  const [newCategoryName, setNewCategoryName] = useState("");

  async function loadDeck() {
    const response = await fetch(`/api/decks/${deckId}`);
    if (!response.ok) return;
    const data = (await response.json()) as DeckData;
    setDeckData(data);
    if (data.deck.categories.length) {
      const hasSelected = data.deck.categories.some(
        (category) => category.name === selectedCategory,
      );
      if (!hasSelected) {
        setSelectedCategory(data.deck.categories[0].name);
      }
    }
  }

  useEffect(() => {
    loadDeck();
  }, [deckId]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!searchQuery) {
        setSearchResults([]);
        return;
      }
      const params = new URLSearchParams();
      params.set("q", searchQuery);
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setSearchResults(data.results ?? []);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  async function updateDeck(payload: Record<string, unknown>) {
    await fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadDeck();
  }

  async function addCardToDeck(cardUuid: string) {
    if (!selectedCategory) return;
    setLoading(true);
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid, category: selectedCategory }),
    });
    await loadDeck();
    setLoading(false);
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    await fetch(`/api/decks/${deckId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    setNewCategoryName("");
    await loadDeck();
  }

  async function removeCategory(categoryId: string) {
    await fetch(
      `/api/decks/${deckId}/categories?categoryId=${encodeURIComponent(
        categoryId,
      )}`,
      { method: "DELETE" },
    );
    await loadDeck();
  }

  async function updateDeckCard(cardUuid: string, delta: number) {
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid, delta }),
    });
    await loadDeck();
  }

  async function updateCardCategory(cardUuid: string, category: string) {
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid, category }),
    });
    await loadDeck();
  }

  async function toggleCommander(cardUuid: string, isCommander: boolean) {
    await fetch(`/api/decks/${deckId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardUuid, isCommander }),
    });
    await loadDeck();
  }

  function handleToggleCommander(cardUuid: string) {
    const card = deckData?.cards.find((entry) => entry.cardUuid === cardUuid);
    if (!card) return;
    void toggleCommander(cardUuid, !card.isCommander);
  }

  function handleDragEnd(event: DragEndEvent) {
    const cardUuid = event.active.id as string;
    const targetCategory = event.over?.id as string | undefined;
    if (!targetCategory || !deckData) return;
    const card = deckData.cards.find((entry) => entry.cardUuid === cardUuid);
    if (!card || card.category === targetCategory) return;
    void updateCardCategory(cardUuid, targetCategory);
  }

  const cardsByCategory = useMemo(() => {
    if (!deckData) return new Map<string, DeckCard[]>();
    const map = new Map<string, DeckCard[]>();
    deckData.deck.categories.forEach((category) => {
      map.set(category.name, []);
    });
    deckData.cards.forEach((card) => {
      if (!map.has(card.category)) map.set(card.category, []);
      map.get(card.category)?.push(card);
    });
    return map;
  }, [deckData]);

  const groupedByMana = useMemo(() => {
    if (!deckData) return [] as Array<[string, DeckCard[]]>;
    const map = groupCardsBy(deckData.cards, (card) => {
      const manaValue = card.details?.manaValue;
      if (manaValue === null || manaValue === undefined) return "Unknown";
      return `MV ${Math.round(manaValue)}`;
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deckData]);

  const groupedByType = useMemo(() => {
    if (!deckData) return [] as Array<[string, DeckCard[]]>;
    const map = groupCardsBy(deckData.cards, (card) =>
      bucketType(card.details?.typeLine ?? null),
    );
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deckData]);

  const groupedByColor = useMemo(() => {
    if (!deckData) return [] as Array<[string, DeckCard[]]>;
    const map = groupCardsBy(deckData.cards, (card) => {
      const identity = card.details?.colorIdentity;
      return identity ? `ID ${identity}` : "ID C";
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deckData]);

  const issueMap = useMemo(() => {
    const map = new Map<string, string[]>();
    deckData?.validation.issues.forEach((issue) => {
      if (!issue.cardUuid) return;
      const existing = map.get(issue.cardUuid) ?? [];
      existing.push(issue.type);
      map.set(issue.cardUuid, existing);
    });
    return map;
  }, [deckData]);

  const addableSearchResults = useMemo(() => {
    if (!deckData) return searchResults;
    const deckQtyMap = new Map(
      deckData.cards.map((card) => [card.cardUuid, card.qty]),
    );
    return searchResults.map((result) => {
      const used = deckQtyMap.get(result.cardUuid) ?? 0;
      return { ...result, available: result.qty - used };
    });
  }, [searchResults, deckData]);

  if (!deckData) {
    return <p className="text-sm text-muted-foreground">Loading deck...</p>;
  }

  const validation = deckData.validation;
  const statusVariant =
    validation.status === "ok"
      ? "default"
      : validation.status === "warning"
        ? "secondary"
        : "destructive";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value={deckData.deck.name}
            onChange={(event) =>
              setDeckData({
                ...deckData,
                deck: { ...deckData.deck, name: event.target.value },
              })
            }
            onBlur={(event) => updateDeck({ name: event.target.value })}
            className="max-w-xl text-lg font-semibold"
          />
          <Badge variant={statusVariant}>
            {validation.status === "ok"
              ? "Valid"
              : validation.status === "warning"
                ? "Warnings"
                : "Issues"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Commander identity: {validation.commanderColorIdentity || "?"}</span>
          <span>Total cards: {deckData.stats.totalCards}</span>
        </div>
        {validation.issues.length > 0 && (
          <div className="space-y-1 text-sm text-destructive">
            {validation.issues.map((issue, index) => (
              <div key={`${issue.type}-${index}`}>{issue.message}</div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="category">By Category</TabsTrigger>
              <TabsTrigger value="mana">By Mana Value</TabsTrigger>
              <TabsTrigger value="type">By Type</TabsTrigger>
              <TabsTrigger value="color">By Color</TabsTrigger>
            </TabsList>

            <TabsContent value="category" className="space-y-4">
              <DndContext onDragEnd={handleDragEnd}>
                <div className="grid gap-4 lg:grid-cols-2">
                  {deckData.deck.categories.map((category) => (
                    <CategoryDropzone
                      key={category.id}
                      category={category}
                      cards={cardsByCategory.get(category.name) ?? []}
                      onIncrement={(cardUuid) => updateDeckCard(cardUuid, 1)}
                      onDecrement={(cardUuid) => updateDeckCard(cardUuid, -1)}
                      onToggleCommander={handleToggleCommander}
                      issueMap={issueMap}
                    />
                  ))}
                </div>
              </DndContext>
            </TabsContent>

            <TabsContent value="mana">
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Mana curve
                    </h3>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deckData.stats.manaCurve}>
                          <XAxis dataKey="manaValue" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
                <GroupedCardList groups={groupedByMana} />
              </div>
            </TabsContent>

            <TabsContent value="type">
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Type breakdown
                    </h3>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deckData.stats.typeBreakdown}>
                          <XAxis dataKey="type" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
                <GroupedCardList groups={groupedByType} />
              </div>
            </TabsContent>

            <TabsContent value="color">
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Color identity distribution
                    </h3>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deckData.stats.colorDistribution}
                            dataKey="count"
                            nameKey="color"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="hsl(var(--chart-3))"
                            label
                          />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
                <GroupedCardList groups={groupedByColor} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Deck stats
            </h3>
            <div className="text-sm">
              Average MV:{" "}
              {deckData.stats.avgManaValue?.toFixed(2) ?? "n/a"}
            </div>
            <div className="text-sm">
              Average MV (non-lands):{" "}
              {deckData.stats.avgManaValueNonLands?.toFixed(2) ?? "n/a"}
            </div>
            <div className="space-y-1 text-sm">
              {deckData.stats.categoryCounts.map((entry) => (
                <div key={entry.category} className="flex justify-between">
                  <span>{entry.category}</span>
                  <span>{entry.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Categories
            </h3>
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Add category"
              />
              <Button size="sm" onClick={addCategory}>
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {deckData.deck.categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{category.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={(cardsByCategory.get(category.name)?.length ?? 0) > 0}
                    onClick={() => removeCategory(category.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Search from collection
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Allow missing
                <Switch
                  checked={deckData.deck.allowMissing}
                  onCheckedChange={(value) => updateDeck({ allowMissing: value })}
                />
              </div>
            </div>
            <Input
              placeholder="Search cards"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {deckData.deck.categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {addableSearchResults.map((card) => {
                const canAdd =
                  deckData.deck.allowMissing || card.available > 0;
                return (
                  <div
                    key={card.cardUuid}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium">{card.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {card.typeLine} • {card.setCode}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={canAdd ? "default" : "outline"}
                      disabled={!canAdd || loading}
                      onClick={() => addCardToDeck(card.cardUuid)}
                    >
                      Add
                    </Button>
                  </div>
                );
              })}
              {searchQuery && addableSearchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No results.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
