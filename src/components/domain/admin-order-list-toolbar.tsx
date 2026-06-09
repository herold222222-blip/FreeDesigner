"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ADMIN_ORDER_SPECIALTY_FILTERS,
  ADMIN_ORDER_STATUS_FILTERS,
  type AdminOrderSpecialtyFilter,
  type AdminOrderStatusFilter,
} from "@/lib/admin-order-filters";
import type { Specialty } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  query: string;
  statusFilter: AdminOrderStatusFilter;
  specialtyFilter: AdminOrderSpecialtyFilter;
  statusCounts: Record<AdminOrderStatusFilter, number>;
  specialtyCounts: Record<Exclude<AdminOrderSpecialtyFilter, "all">, number>;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: AdminOrderStatusFilter) => void;
  onSpecialtyFilterChange: (value: AdminOrderSpecialtyFilter) => void;
  resultCount: number;
};

export function AdminOrderListToolbar({
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
  specialtyFilter,
  specialtyCounts,
  onSpecialtyFilterChange,
  statusCounts,
  resultCount,
}: Props) {
  const toggleSpecialty = (value: Specialty) => {
    onSpecialtyFilterChange(specialtyFilter === value ? "all" : value);
  };
  return (
    <Card className="sticky top-0 z-20 space-y-3 border-ink-20 bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索姓名、编号、合同名称、项目名称、手机号码"
          className="h-11 pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ADMIN_ORDER_STATUS_FILTERS.map((item) => {
          const active = statusFilter === item.value;
          const isOverdue = item.value === "payment_overdue";
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onStatusFilterChange(item.value)}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? isOverdue
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-ink bg-ink text-white"
                  : isOverdue
                    ? "border-rose-200 text-rose-700 hover:border-rose-400"
                    : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "text-white/80" : "text-ink-40",
                )}
              >
                {statusCounts[item.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {ADMIN_ORDER_SPECIALTY_FILTERS.map((item) => {
          const active = specialtyFilter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => toggleSpecialty(item.value)}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "text-white/80" : "text-ink-40",
                )}
              >
                {specialtyCounts[item.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-40">
        共 {resultCount} 条订单
        {query.trim() ? ` · 关键词「${query.trim()}」` : null}
      </p>
    </Card>
  );
}
