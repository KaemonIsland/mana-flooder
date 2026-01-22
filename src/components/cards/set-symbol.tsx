import * as React from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type SetSymbolProps = {
  setCode?: string | null;
  rarity?: string | null;
  className?: string;
};

const rarityClasses: Record<string, string> = {
  common: "text-slate-300",
  uncommon: "text-emerald-300",
  rare: "text-amber-300",
  mythic: "text-orange-300",
};

function SetSymbol({ setCode, rarity, className }: SetSymbolProps) {
  const code = (setCode ?? "??").toUpperCase();
  const colorClass = rarity ? rarityClasses[rarity.toLowerCase()] : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/70",
        colorClass,
        className,
      )}
      title={`Set ${code}`}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      <span>{code}</span>
    </span>
  );
}

export { SetSymbol };
