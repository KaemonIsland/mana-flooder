import * as React from "react";

import { cn } from "@/lib/utils";

function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "bg-panel border border-panel rounded-2xl shadow-lg backdrop-blur transition-all duration-200 ease-out",
        className,
      )}
      {...props}
    />
  );
}

export { Panel };
