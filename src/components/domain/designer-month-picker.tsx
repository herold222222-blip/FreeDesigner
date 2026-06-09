"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarSlot } from "@/lib/types";
import {
  type MonthKey,
  formatMonthKey,
  formatMonthLabel,
  formatSelectedMonthsSummary,
  getMonthAvailability,
  isMonthSelectable,
  isMonthSelected,
  toggleMonth,
} from "@/lib/designer-schedule";

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export interface DesignerMonthPickerProps {
  calendar: CalendarSlot[];
  value: MonthKey[];
  onChange?: (months: MonthKey[]) => void;
  readOnly?: boolean;
  initialYear?: number;
  className?: string;
}

export function DesignerMonthPicker({
  calendar,
  value,
  onChange,
  readOnly = false,
  initialYear = 2026,
  className,
}: DesignerMonthPickerProps) {
  const [year, setYear] = useState(initialYear);

  const monthStats = useMemo(
    () =>
      MONTH_LABELS.map((_, i) => {
        const month = i + 1;
        const key = formatMonthKey(year, month);
        const stats = getMonthAvailability(calendar, year, month);
        return { month, key, stats, selectable: isMonthSelectable(calendar, year, month) };
      }),
    [calendar, year],
  );

  const handleMonthClick = (key: MonthKey, selectable: boolean) => {
    if (readOnly || !selectable) return;
    onChange?.(toggleMonth(value, key));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setYear((y) => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setYear((y) => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <h3 className="text-base font-semibold text-ink">{year} 年</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> 可雇佣
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ink-20" /> 档期已满
          </span>
          {!readOnly && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ink" /> 已选
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {monthStats.map(({ month, key, stats, selectable }) => {
          const selected = isMonthSelected(value, key);
          const Tag = readOnly ? "div" : "button";
          return (
            <Tag
              key={key}
              type={readOnly ? undefined : "button"}
              disabled={readOnly ? undefined : !selectable}
              onClick={() => handleMonthClick(key, selectable)}
              className={cn(
                "flex flex-col items-center rounded-xl border p-4 text-center transition-colors",
                !selectable && "cursor-not-allowed border-ink-20/40 bg-ink-20/20 text-ink-40",
                selectable && !selected && "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100",
                selectable && !readOnly && !selected && "cursor-pointer",
                selected && "border-ink bg-ink text-white",
              )}
            >
              <div className="text-lg font-semibold">{MONTH_LABELS[month - 1]}</div>
              <div
                className={cn(
                  "mt-1 text-[10px]",
                  selected ? "text-white/70" : "text-ink-50",
                )}
              >
                {!selectable
                  ? "已满"
                  : stats.availableHalfDays === stats.totalHalfDays
                    ? "全月可约"
                    : `${stats.availableHalfDays} 半天可约`}
              </div>
            </Tag>
          );
        })}
      </div>

      {!readOnly && (
        <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                已选雇佣月份
              </div>
              <div className="mt-1 text-sm font-medium text-ink">
                {value.length > 0
                  ? formatSelectedMonthsSummary(value)
                  : "点击月份选择雇佣周期（至少 1 个月）"}
              </div>
              {value.length > 0 && (
                <div className="mt-1 text-xs text-ink-60">
                  共 {value.length} 个月 · 可连续或跳跃选择 · 首月预付，每月 25 号前支付下月
                </div>
              )}
            </div>
            {value.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.([])}>
                清空
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { formatMonthLabel, formatSelectedMonthsSummary };
