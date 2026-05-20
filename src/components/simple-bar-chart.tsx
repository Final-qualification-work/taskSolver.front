"use client";

import { cn } from "@/lib/utils";

export type BarChartItem = {
  label: string;
  value: number;
  hint?: string;
  colorClass?: string;
};

type SimpleBarChartProps = {
  items: BarChartItem[];
  maxValue?: number;
  valueSuffix?: string;
  className?: string;
};

export function SimpleBarChart({
  items,
  maxValue,
  valueSuffix = "",
  className,
}: SimpleBarChartProps) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item) => {
        const pct = max > 0 ? Math.min(100, (item.value / max) * 100) : 0;
        return (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-warm-muted">
                {item.value}
                {valueSuffix}
                {item.hint ? ` · ${item.hint}` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div
                className={cn("h-full rounded-full transition-all", item.colorClass ?? "bg-accent-primary/70")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
