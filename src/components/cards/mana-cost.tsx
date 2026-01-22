import * as React from "react";

import { cn } from "@/lib/utils";

const baseSymbol =
  "inline-flex items-center justify-center rounded-full border border-white/20 px-1.5 font-semibold shadow-sm";

const symbolColors: Record<string, string> = {
  W: "bg-[#f4f1d0] text-[#1c1b14]",
  U: "bg-[#4c8df6] text-white",
  B: "bg-[#3c244c] text-white",
  R: "bg-[#f05d5e] text-white",
  G: "bg-[#3ea76d] text-white",
  C: "bg-[#9ca3af] text-[#1f2937]",
};

function resolveSymbolClasses(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (symbolColors[normalized]) return symbolColors[normalized];
  if (normalized.includes("/")) {
    return "bg-gradient-to-br from-blue-500/80 via-purple-500/80 to-pink-500/80 text-white";
  }
  if (normalized.includes("P")) {
    return "bg-gradient-to-br from-fuchsia-500/80 to-indigo-500/80 text-white";
  }
  if (/^\d+$/.test(normalized) || normalized === "X") {
    return "bg-slate-700/80 text-white";
  }
  return "bg-white/10 text-white";
}

type ManaCostProps = {
  cost?: string | null;
  size?: "sm" | "md";
  className?: string;
};

function ManaCost({ cost, size = "sm", className }: ManaCostProps) {
  if (!cost) return null;
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];
  if (!symbols.length) {
    return (
      <span className={cn("text-xs text-white/70", className)}>{cost}</span>
    );
  }
  const sizeClasses = size === "md" ? "h-6 w-6 text-xs" : "h-5 w-5 text-[0.65rem]";

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      aria-label={`Mana cost ${cost}`}
    >
      {symbols.map((symbol, index) => {
        const label = symbol.replace(/[{}]/g, "");
        return (
          <span
            key={`${label}-${index}`}
            className={cn(baseSymbol, sizeClasses, resolveSymbolClasses(label))}
            title={label}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

export { ManaCost };
