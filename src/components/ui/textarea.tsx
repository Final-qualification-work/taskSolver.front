import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm outline-none placeholder:text-warm-muted focus-visible:ring-2 focus-visible:ring-accent-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
