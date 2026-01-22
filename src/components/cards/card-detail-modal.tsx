"use client";

import * as React from "react";
import { BookOpen, LibraryBig, Sparkles } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionTitle } from "@/components/ui/section-title";
import { ManaCost } from "@/components/cards/mana-cost";
import { SetSymbol } from "@/components/cards/set-symbol";
import { cn } from "@/lib/utils";

type PrintingEntry = {
  uuid: string;
  setCode: string | null;
  setName: string | null;
  releaseDate: string | null;
  number: string | null;
  rarity: string | null;
  finishes: string[];
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
  imageUrl: string | null;
  card: {
    name: string;
    manaCost: string | null;
    typeLine: string | null;
    text: string | null;
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

function normalizeFinish(finishes: string[]) {
  return finishes.map((finish) => finish.toLowerCase());
}

function hasFoilOption(finishes: string[]) {
  const normalized = normalizeFinish(finishes);
  return normalized.some(
    (finish) =>
      finish.includes("foil") ||
      finish.includes("etched") ||
      finish.includes("gloss"),
  );
}

function hasPromoOption(finishes: string[]) {
  const normalized = normalizeFinish(finishes);
  return normalized.some((finish) => finish.includes("promo"));
}

function CardDetailModal({
  canonicalKey,
  open,
  onOpenChange,
  onTotalsChange,
}: CardDetailModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<ModalData | null>(null);

  React.useEffect(() => {
    if (!open || !canonicalKey) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/cards/canonical/${encodeURIComponent(canonicalKey)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setData(null);
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
    }

    load();
    return () => controller.abort();
  }, [canonicalKey, open]);

  React.useEffect(() => {
    if (!open) {
      setData(null);
    }
  }, [open]);

  async function adjustPrinting(
    printing: PrintingEntry,
    delta: number,
    finish: "nonfoil" | "foil" | "promo",
  ) {
    const payload =
      finish === "nonfoil"
        ? { cardUuid: printing.uuid, delta }
        : { cardUuid: printing.uuid, foilDelta: delta };
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        {loading && (
          <div className="text-sm text-white/70">Loading details...</div>
        )}
        {!loading && data && (
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <div className="space-y-4">
              <Panel className="overflow-hidden p-0">
                <div className="aspect-[5/7]">
                  {data.imageUrl ? (
                    <img
                      src={data.imageUrl}
                      alt={data.card.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800/80 via-indigo-900/70 to-purple-900/70 text-sm text-white/70">
                      {data.card.name}
                    </div>
                  )}
                </div>
              </Panel>
              <Panel className="space-y-2 p-3">
                <SectionTitle
                  title="Collection"
                  icon={<Sparkles className="size-4" />}
                />
                <div className="text-sm text-white/80">
                  Total: {data.collectionTotals.qty + data.collectionTotals.foilQty}{" "}
                  (foil {data.collectionTotals.foilQty})
                </div>
              </Panel>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                  {data.card.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                  <ManaCost cost={data.card.manaCost} size="md" />
                  {data.card.typeLine && <span>{data.card.typeLine}</span>}
                </div>
              </div>

              <Panel className="space-y-3 p-4">
                <SectionTitle
                  title="Oracle text"
                  icon={<BookOpen className="size-4" />}
                />
                <div className="whitespace-pre-line text-sm text-white/80">
                  {data.card.text ?? "No oracle text available."}
                </div>
              </Panel>

              <Panel className="space-y-3 p-4">
                <SectionTitle
                  title="Decks"
                  subtitle={
                    data.decks.length
                      ? `${data.decks.length} deck${data.decks.length > 1 ? "s" : ""}`
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
                              .map((category) => `${category.name}: ${category.count}`)
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

              <Panel className="space-y-3 p-4">
                <SectionTitle
                  title="Printings"
                  subtitle={`${data.printings.length} total`}
                  icon={<Sparkles className="size-4" />}
                />
                <ScrollArea className="h-64 pr-2">
                  <div className="space-y-2">
                    {data.printings.map((printing) => {
                      const showFoil = hasFoilOption(printing.finishes);
                      const showPromo = hasPromoOption(printing.finishes);
                      return (
                        <div
                          key={printing.uuid}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-200 ease-out hover:border-violet-400/40 hover:bg-white/10"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <SetSymbol
                                  setCode={printing.setCode}
                                  rarity={printing.rarity}
                                  className="text-[0.55rem]"
                                />
                                <span className="text-sm font-semibold text-white">
                                  {printing.setName ?? printing.setCode ?? "Unknown"}
                                </span>
                              </div>
                              <div className="text-xs text-white/60">
                                {printing.releaseDate ?? "n/a"}
                                {printing.number ? ` • #${printing.number}` : ""}
                              </div>
                              <div className="text-xs text-white/50">
                                Owned: {printing.qty}
                                {printing.foilQty > 0
                                  ? ` (foil ${printing.foilQty})`
                                  : ""}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition-all duration-200 ease-out hover:bg-white/20 hover:text-white hover:ring-2 hover:ring-violet-400/40 active:scale-95",
                                )}
                                onClick={() => adjustPrinting(printing, 1, "nonfoil")}
                              >
                                Add
                              </button>
                              {showFoil && (
                                <button
                                  type="button"
                                  className="rounded-full border border-violet-300/40 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-white/90 transition-all duration-200 ease-out hover:bg-violet-500/30 hover:ring-2 hover:ring-violet-400/40 active:scale-95"
                                  onClick={() => adjustPrinting(printing, 1, "foil")}
                                >
                                  Foil
                                </button>
                              )}
                              {showPromo && (
                                <button
                                  type="button"
                                  className="rounded-full border border-pink-300/40 bg-pink-500/20 px-3 py-1 text-xs font-semibold text-white/90 transition-all duration-200 ease-out hover:bg-pink-500/30 hover:ring-2 hover:ring-pink-400/40 active:scale-95"
                                  onClick={() => adjustPrinting(printing, 1, "promo")}
                                >
                                  Promo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Panel>
            </div>
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
