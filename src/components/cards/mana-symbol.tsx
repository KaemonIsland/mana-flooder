import * as React from "react";

import { cn } from "@/lib/utils";

type ManaSymbolProps = {
  symbol: string;
  size?: "sm" | "md";
  className?: string;
  label?: string;
};

const symbolColors: Record<string, string> = {
  W: "bg-[#f4f1d0] text-[#1c1b14]",
  U: "bg-[#4c8df6] text-white",
  B: "bg-[#3c244c] text-white",
  R: "bg-[#f05d5e] text-white",
  G: "bg-[#3ea76d] text-white",
  C: "bg-[#9ca3af] text-[#1f2937]",
  M: "bg-gradient-to-br from-violet-500/80 via-indigo-500/80 to-fuchsia-500/80 text-white",
};

function ManaSymbol({ symbol, size = "sm", className, label }: ManaSymbolProps) {
  const normalized = symbol.toUpperCase();
  const sizeClasses = size === "md" ? "h-6 w-6 text-xs" : "h-5 w-5 text-[0.6rem]";
  const colorClass = symbolColors[normalized] ?? "bg-white/10 text-white";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-white/20 font-semibold shadow-sm",
        sizeClasses,
        colorClass,
        className,
      )}
      title={label ?? normalized}
      aria-label={label ?? normalized}
    >
      {normalized}
    </span>
  );
}

export { ManaSymbol };
