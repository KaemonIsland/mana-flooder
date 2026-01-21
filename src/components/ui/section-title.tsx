import * as React from "react";

import { cn } from "@/lib/utils";

type SectionTitleProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

function SectionTitle({
  className,
  title,
  subtitle,
  icon,
  ...props
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
        {icon && (
          <span className="text-violet-300" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{title}</span>
      </div>
      {subtitle && <span className="text-xs text-white/50">{subtitle}</span>}
    </div>
  );
}

export { SectionTitle };
