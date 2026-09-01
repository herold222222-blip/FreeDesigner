"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarSlot, WorkCalendarEvent } from "@/lib/types";
import { WEEKDAY_LABELS, getMonthGrid } from "@/lib/designer-schedule";
import { collectOccupiedKeys } from "@/lib/designer-work-calendar";
import { classifyCnDay } from "@/lib/cn-workdays";
import { formatIsoDateLabel } from "@/lib/monthly-range-billing";

export interface DateRangeValue {
  from: string;
  to: string;
}

export function DesignerDateRangeCalendar({
  calendar,
  events,
  value,
  onChange,
  initialYear = 2026,
  initialMonth = 8,
  className,
}: {
  calendar: CalendarSlot[];
  events?: WorkCalendarEvent[];
  value: DateRangeValue;
  onChange?: (next: DateRangeValue) => void;
  initialYear?: number;
  initialMonth?: number;
  className?: string;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const occupiedDates = useMemo(() => {
    const keys = collectOccupiedKeys(events ?? []);
    const dates = new Set<string>();
    for (const key of keys) dates.add(key.slice(0, 10));
    return dates;
  }, [events]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const handleDayClick = (date: string) => {
    if (!value.from || (value.from && value.to)) {
      onChange?.({ from: date, to: "" });
      return;
    }
    if (date < value.from) onChange?.({ from: date, to: value.from });
    else onChange?.({ from: value.from, to: date });
  };

  const dayStatus = (date: string): "occupied" | "closed" | "free" => {
    if (occupiedDates.has(date)) return "occupied";
    const slot = calendar.find((s) => s.date === date);
    if (slot) return slot.available ? "free" : "closed";
    const kind = classifyCnDay(date);
    if (kind === "weekend" || kind === "holiday") return "closed";
    return "free";
  };

  const pickingEnd = Boolean(value.from && !value.to);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-semibold text-ink">
            {year} 年 {month} 月
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> 空闲
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> 已安排
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ink-20" /> 不接单
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ink" /> 已选区间
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-xs sm:gap-1.5">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-ink-40">
            {d}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.inMonth) {
            return <div key={`pad-${idx}`} className="min-h-[44px] sm:min-h-[52px]" />;
          }
          const status = dayStatus(cell.date);
          const isStart = value.from === cell.date;
          const isEnd = value.to === cell.date;
          const inRange =
            Boolean(value.from) &&
            Boolean(value.to) &&
            cell.date >= value.from &&
            cell.date <= value.to;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleDayClick(cell.date)}
              title={`${cell.date} · ${
                status === "occupied"
                  ? "已安排"
                  : status === "closed"
                    ? "不接单"
                    : "空闲"
              }`}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-xs font-medium transition-colors sm:min-h-[52px] sm:text-sm",
                status === "free" &&
                  !inRange &&
                  !isStart &&
                  "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100",
                status === "occupied" &&
                  !inRange &&
                  !isStart &&
                  "border-rose-100 bg-rose-50 text-rose-800",
                status === "closed" &&
                  !inRange &&
                  !isStart &&
                  "border-ink-20/40 bg-ink-20/20 text-ink-40",
                (inRange || isStart) && "border-ink bg-ink text-white",
                isStart && "ring-2 ring-brand/40",
                isEnd && isStart === false && "ring-2 ring-brand/40",
              )}
            >
              <span>{cell.day}</span>
              {isStart ? (
                <span className="mt-0.5 text-[9px] opacity-80">开始</span>
              ) : isEnd ? (
                <span className="mt-0.5 text-[9px] opacity-80">结束</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
              已选服务期
            </div>
            <div className="mt-1 text-sm font-medium text-ink">
              {value.from && value.to
                ? `${formatIsoDateLabel(value.from)} ～ ${formatIsoDateLabel(value.to)}`
                : value.from
                  ? `${formatIsoDateLabel(value.from)} 已选为开始日，请再点结束日期`
                  : "先点开始日期，再点结束日期"}
            </div>
          </div>
          {value.from ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange?.({ from: "", to: "" })}
            >
              清空
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-50">
          {pickingEnd
            ? "已选定开始日，请再点一个日期作为结束日。"
            : "日历标出设计师忙闲。服务期按连续日期计算：首尾不足整月按工作日折算（日费 = 月费 ÷ 21），中间整月按月费率。"}
        </p>
      </div>
    </div>
  );
}
