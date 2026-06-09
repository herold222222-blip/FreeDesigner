"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminClientTypeFilter = "all" | "individual" | "enterprise";

const FILTERS: { value: AdminClientTypeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "individual", label: "个人委托人" },
  { value: "enterprise", label: "公司委托人" },
];

export function AdminClientFiltersBar({
  value,
  onChange,
  counts,
}: {
  value: AdminClientTypeFilter;
  onChange: (next: AdminClientTypeFilter) => void;
  counts: Record<AdminClientTypeFilter, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-20 bg-white p-3">
      <span className="text-xs uppercase tracking-wider text-ink-40">类型</span>
      {FILTERS.map((item) => (
        <Button
          key={item.value}
          type="button"
          size="sm"
          variant={value === item.value ? "default" : "outline"}
          className={cn(
            "h-8 rounded-full px-4",
            value === item.value && "bg-ink text-white hover:bg-ink/90",
          )}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          <span className="ml-1.5 text-[11px] opacity-70">
            {counts[item.value]}
          </span>
        </Button>
      ))}
    </div>
  );
}
