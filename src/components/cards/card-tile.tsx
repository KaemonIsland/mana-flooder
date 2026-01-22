import * as React from "react";

import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { ManaCost } from "@/components/cards/mana-cost";
import { SetSymbol } from "@/components/cards/set-symbol";
import { cn } from "@/lib/utils";

export type CardSummary = {
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
  displaySetCode?: string | null;
  displayReleaseDate?: string | null;
  collectorNumber?: string | null;
  qty: number;
  foilQty: number;
  imageUrl: string | null;
  text?: string | null;
};

type CardTileProps = {
  card: CardSummary;
  onOpen: (canonicalKey: string) => void;
  onAdjustOwned: (card: CardSummary, delta: number) => void;
  className?: string;
};

function CardTile({ card, onOpen, onAdjustOwned, className }: CardTileProps) {
  const handleOpen = () => onOpen(card.canonicalKey);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      aria-label={`View details for ${card.name}`}
      className={cn(
        "group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
        className,
      )}
    >
      <Panel className="overflow-hidden p-0 shadow-lg transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:ring-2 hover:ring-violet-400/40">
        <div className="relative aspect-[5/7] overflow-hidden">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800/80 via-indigo-900/70 to-purple-900/70 text-sm text-white/70">
              {card.name}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
            <SetSymbol
              setCode={card.displaySetCode ?? card.latestSetCode}
              rarity={card.rarity}
            />
            <ManaCost cost={card.manaCost} />
          </div>
          <div className="absolute bottom-3 left-3 right-3 space-y-1">
            <div className="text-sm font-semibold tracking-tight text-white">
              {card.name}
            </div>
            {card.typeLine && (
              <div className="text-xs text-white/70">{card.typeLine}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-white/5 px-3 py-2">
          <div className="space-y-0.5">
            <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/50">
              Owned
            </div>
            <div className="text-sm font-semibold text-white">
              {card.qty}
              {card.foilQty > 0 && (
                <span className="ml-1 text-xs text-violet-200">
                  (+{card.foilQty} foil)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              aria-label={`Remove ${card.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onAdjustOwned(card, -1);
              }}
            >
              -
            </IconButton>
            <IconButton
              aria-label={`Add ${card.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onAdjustOwned(card, 1);
              }}
            >
              +
            </IconButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export { CardTile };
