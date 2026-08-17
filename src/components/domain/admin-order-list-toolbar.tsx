"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ADMIN_ORDER_SPECIALTY_FILTERS,
  ADMIN_ORDER_STATUS_FILTERS,
  ADMIN_ORDER_TYPE_FILTERS,
  type AdminOrderSpecialtyFilter,
  type AdminOrderStatusFilter,
  type AdminOrderTypeFilter,
} from "@/lib/admin-order-filters";
import type { Specialty } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  query: string;
  typeFilter: AdminOrderTypeFilter;
  statusFilter: AdminOrderStatusFilter;
  specialtyFilter: AdminOrderSpecialtyFilter;
  typeCounts: Record<AdminOrderTypeFilter, number>;
  statusCounts: Record<AdminOrderStatusFilter, number>;
  specialtyCounts: Record<Exclude<AdminOrderSpecialtyFilter, "all">, number>;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: AdminOrderTypeFilter) => void;
  onStatusFilterChange: (value: AdminOrderStatusFilter) => void;
  onSpecialtyFilterChange: (value: AdminOrderSpecialtyFilter) => void;
  resultCount: number;
};

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "ml-1 tabular-nums",
          active ? "text-white/80" : "text-ink-40",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function AdminOrderListToolbar({
  query,
  typeFilter,
  statusFilter,
  onQueryChange,
  onTypeFilterChange,
  onStatusFilterChange,
  specialtyFilter,
  specialtyCounts,
  onSpecialtyFilterChange,
  typeCounts,
  statusCounts,
  resultCount,
}: Props) {
  const toggleSpecialty = (value: Specialty) => {
    onSpecialtyFilterChange(specialtyFilter === value ? "all" : value);
  };
  return (
    <Card className="sticky top-0 z-20 space-y-2.5 border-ink-20 bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索姓名、编号、合同名称、项目名称、手机号码"
          className="h-11 pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 text-xs text-ink-40">类型</span>
        {ADMIN_ORDER_TYPE_FILTERS.map((item) => (
          <FilterPill
            key={item.value}
            label={item.label}
            count={typeCounts[item.value] ?? 0}
            active={typeFilter === item.value}
            onClick={() => onTypeFilterChange(item.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 text-xs text-ink-40">状态</span>
        {ADMIN_ORDER_STATUS_FILTERS.map((item) => (
          <FilterPill
            key={item.value}
            label={item.label}
            count={statusCounts[item.value] ?? 0}
            active={statusFilter === item.value}
            onClick={() => onStatusFilterChange(item.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 text-xs text-ink-40">专业</span>
        {ADMIN_ORDER_SPECIALTY_FILTERS.map((item) => (
          <FilterPill
            key={item.value}
            label={item.label}
            count={specialtyCounts[item.value] ?? 0}
            active={specialtyFilter === item.value}
            onClick={() => toggleSpecialty(item.value)}
          />
        ))}
      </div>

      <p className="text-xs text-ink-40">
        共 {resultCount} 条订单
        {query.trim() ? ` · 关键词「${query.trim()}」` : null}
      </p>
    </Card>
  );
}
