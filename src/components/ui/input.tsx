import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-warm-muted focus-visible:ring-2 focus-visible:ring-accent-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
