import * as React from "react";

import { cn } from "@/lib/utils";

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

function Chip({
  className,
  selected = false,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
        selected &&
          "bg-violet-500/20 text-white ring-1 ring-violet-400/50 hover:bg-violet-500/30",
        className,
      )}
      {...props}
    />
  );
}

export { Chip };
