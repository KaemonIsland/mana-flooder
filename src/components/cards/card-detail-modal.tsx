"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, LibraryBig, Sparkles, Tag } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";
import { SectionTitle } from "@/components/ui/section-title";
import { ManaCost } from "@/components/cards/mana-cost";
import { SetSymbol } from "@/components/cards/set-symbol";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type PrintingEntry = {
  uuid: string;
  setCode: string | null;
  setName: string | null;
  releaseDate: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  finishes: string[];
  hasFoil: boolean;
  hasNonfoil: boolean;
  qty: number;
  foilQty: number;
  imageUrl: string | null;
};

type DeckSummary = {
  id: string;
  name: string;
  totalQty: number;
  categories: Array<{ name: string; count: number }>;
};

type ModalData = {
  canonicalKey: string;
  representativeUuid: string;
  activePrinting: {
    uuid: string;
    name: string;
    imageUrl: string | null;
    manaCost: string | null;
    typeLine: string | null;
    oracleText: string | null;
    artist: string | null;
    flavor: string | null;
  };
  prices: {
    usd: number | null;
    eur: number | null;
    tix: number | null;
    date: string | null;
  };
  collectionTotals: { qty: number; foilQty: number };
  decks: DeckSummary[];
  printings: PrintingEntry[];
};

type CardDetailModalProps = {
  canonicalKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTotalsChange?: (
    canonicalKey: string,
    totals: { qty: number; foilQty: number },
  ) => void;
};

function formatPrice(value: number | null, currency: "USD" | "EUR" | "TIX") {
  if (value === null || Number.isNaN(value)) return "—";
  if (currency === "TIX") return `${value.toFixed(2)} tix`;
  const symbol = currency === "EUR" ? "€" : "$";
  return `${symbol}${value.toFixed(2)}`;
}

function CardDetailModal({
  canonicalKey,
  open,
  onOpenChange,
  onTotalsChange,
}: CardDetailModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<ModalData | null>(null);
  const [foilMode, setFoilMode] = React.useState(false);

  const loadData = React.useCallback(
    async (printingUuid?: string) => {
      if (!canonicalKey) return;
      const controller = new AbortController();
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (printingUuid) params.set("printingUuid", printingUuid);
        const response = await fetch(
          `/api/cards/${encodeURIComponent(canonicalKey)}/summary${
            params.toString() ? `?${params}` : ""
          }`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ModalData;
        setData(payload);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setData(null);
        }
      } finally {
        setLoading(false);
      }
      return () => controller.abort();
    },
    [canonicalKey],
  );

  React.useEffect(() => {
    if (!open || !canonicalKey) return;
    loadData();
  }, [canonicalKey, loadData, open]);

  React.useEffect(() => {
    if (!open) {
      setData(null);
      setFoilMode(false);
    }
  }, [open]);

  async function adjustActivePrinting(delta: number) {
    if (!data) return;
    const payload = foilMode
      ? { cardUuid: data.activePrinting.uuid, foilDelta: delta }
      : { cardUuid: data.activePrinting.uuid, delta };

    const response = await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return;
    const updated = (await response.json()) as {
      card?: { cardUuid: string; qty: number; foilQty: number };
    };

    if (!updated.card) return;

    setData((current) => {
      if (!current) return current;
      const updatedPrintings = current.printings.map((entry) =>
        entry.uuid === updated.card?.cardUuid
          ? {
              ...entry,
              qty: updated.card?.qty ?? entry.qty,
              foilQty: updated.card?.foilQty ?? entry.foilQty,
            }
          : entry,
      );
      const totals = updatedPrintings.reduce(
        (acc, entry) => ({
          qty: acc.qty + entry.qty,
          foilQty: acc.foilQty + entry.foilQty,
        }),
        { qty: 0, foilQty: 0 },
      );

      onTotalsChange?.(current.canonicalKey, totals);

      return {
        ...current,
        printings: updatedPrintings,
        collectionTotals: totals,
      };
    });
  }

  const activePrinting = data?.activePrinting;
  const hasPrices =
    (data?.prices.usd ?? null) !== null ||
    (data?.prices.eur ?? null) !== null ||
    (data?.prices.tix ?? null) !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        {loading && !data && (
          <div className="text-sm text-white/70">Loading details...</div>
        )}
        {!loading && data && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="space-y-4">
                <Panel className="overflow-hidden p-0">
                  <div className="aspect-[5/7]">
                    {activePrinting?.imageUrl ? (
                      <img
                        src={activePrinting.imageUrl}
                        alt={activePrinting.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800/80 via-indigo-900/70 to-purple-900/70 text-sm text-white/70">
                        {activePrinting?.name ?? "Card"}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel className="space-y-3 p-3">
                  <SectionTitle
                    title="Collection"
                    icon={<Sparkles className="size-4" />}
                  />
                  <div className="flex items-center justify-between text-sm text-white/80">
                    <span>Nonfoil</span>
                    <span>{data.collectionTotals.qty}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/80">
                    <span>Foil</span>
                    <span>{data.collectionTotals.foilQty}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm text-white/80">
                    <span>Total</span>
                    <span>
                      {data.collectionTotals.qty + data.collectionTotals.foilQty}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <IconButton
                      aria-label="Decrease quantity"
                      onClick={() => adjustActivePrinting(-1)}
                    >
                      -
                    </IconButton>
                    <IconButton
                      aria-label="Increase quantity"
                      onClick={() => adjustActivePrinting(1)}
                    >
                      +
                    </IconButton>
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <Checkbox
                        checked={foilMode}
                        onCheckedChange={(value) => setFoilMode(Boolean(value))}
                      />
                      Foil
                    </label>
                  </div>
                </Panel>

                <Panel className="space-y-3 p-3">
                  <SectionTitle
                    title="Prices"
                    subtitle="TCGplayer"
                    icon={<Tag className="size-4" />}
                  />
                  {hasPrices ? (
                    <div className="grid grid-cols-3 gap-2 text-xs text-white/70">
                      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                        <div className="text-[0.6rem] uppercase tracking-[0.2em] text-white/50">
                          USD
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {formatPrice(data.prices.usd, "USD")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                        <div className="text-[0.6rem] uppercase tracking-[0.2em] text-white/50">
                          EUR
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {formatPrice(data.prices.eur, "EUR")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center">
                        <div className="text-[0.6rem] uppercase tracking-[0.2em] text-white/50">
                          TIX
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {formatPrice(data.prices.tix, "TIX")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/60">
                      Price unavailable.
                    </div>
                  )}
                </Panel>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                    {activePrinting?.name}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                    <ManaCost cost={activePrinting?.manaCost} size="md" />
                    {activePrinting?.typeLine && (
                      <span>{activePrinting.typeLine}</span>
                    )}
                  </div>
                  {activePrinting?.artist && (
                    <div className="text-xs text-white/60">
                      Illustrated by {activePrinting.artist}
                    </div>
                  )}
                </div>

                <Panel className="space-y-3 p-4">
                  <SectionTitle
                    title="Oracle text"
                    icon={<BookOpen className="size-4" />}
                  />
                  <div className="whitespace-pre-line text-sm text-white/80">
                    {activePrinting?.oracleText ?? "No oracle text available."}
                  </div>
                  {activePrinting?.flavor && (
                    <div className="whitespace-pre-line text-xs text-white/60">
                      “{activePrinting.flavor}”
                    </div>
                  )}
                </Panel>

                <Panel className="space-y-3 p-4">
                  <SectionTitle
                    title="Decks"
                    subtitle={
                      data.decks.length
                        ? `${data.decks.length} deck${
                            data.decks.length > 1 ? "s" : ""
                          }`
                        : undefined
                    }
                    icon={<LibraryBig className="size-4" />}
                  />
                  {data.decks.length ? (
                    <div className="space-y-3 text-sm text-white/80">
                      {data.decks.map((deck) => (
                        <div key={deck.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">
                              {deck.name}
                            </span>
                            <span className="text-xs text-white/50">
                              {deck.totalQty} copies
                            </span>
                          </div>
                          {deck.categories.length > 0 && (
                            <div className="text-xs text-white/50">
                              {deck.categories
                                .map(
                                  (category) =>
                                    `${category.name}: ${category.count}`,
                                )
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-white/60">
                      Not used in any decks.
                    </div>
                  )}
                </Panel>
              </div>
            </div>

            <Panel className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle
                  title="Printings"
                  subtitle={`${data.printings.length} total`}
                  icon={<Sparkles className="size-4" />}
                />
                <Link
                  href={`/cards/${encodeURIComponent(data.canonicalKey)}`}
                  className="text-xs text-violet-200 hover:text-violet-100 hover:underline"
                >
                  View full details
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {data.printings.map((printing) => {
                  const isActive = printing.uuid === data.activePrinting.uuid;
                  return (
                    <button
                      key={printing.uuid}
                      type="button"
                      className={cn(
                        "group relative flex w-28 shrink-0 flex-col gap-2 text-left",
                        "rounded-xl border border-white/10 bg-white/5 p-2 transition-all duration-200 ease-out hover:border-violet-400/40 hover:bg-white/10",
                        isActive &&
                          "border-violet-400/60 bg-violet-500/20 ring-2 ring-violet-400/40",
                      )}
                      onClick={() => {
                        if (isActive) return;
                        loadData(printing.uuid);
                      }}
                    >
                      <div className="relative aspect-[5/7] overflow-hidden rounded-lg">
                        {printing.imageUrl ? (
                          <img
                            src={printing.imageUrl}
                            alt={printing.setCode ?? printing.uuid}
                            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800/80 via-indigo-900/70 to-purple-900/70 text-[0.55rem] text-white/70">
                            {printing.setCode ?? "?"}
                          </div>
                        )}
                        <div className="absolute left-1 top-1">
                          <SetSymbol
                            setCode={printing.setCode}
                            rarity={printing.rarity}
                            className="text-[0.5rem]"
                          />
                        </div>
                      </div>
                      <div className="space-y-0.5 text-[0.65rem] text-white/70">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">
                            {printing.setCode ?? "n/a"}
                          </span>
                          {printing.collectorNumber && (
                            <span>#{printing.collectorNumber}</span>
                          )}
                        </div>
                        <div className="text-[0.6rem] text-white/50">
                          {printing.releaseDate ?? "n/a"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        )}
        {!loading && !data && (
          <div className="text-sm text-white/70">
            Unable to load card details.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CardDetailModal };
