"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WEEKDAY_LABELS,
  formatMonthLabel,
  getMonthGrid,
} from "@/lib/designer-schedule";
import { classifyCnDay } from "@/lib/cn-workdays";
import {
  countMonthlyServiceWorkdays,
  isDateInMonthlyHireSpan,
  isDateInMonthlyServicePeriod,
  resolveMonthlyPaymentMarks,
  resolveMonthlyServicePeriod,
  type MonthlyPaymentMark,
} from "@/lib/monthly-billing";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function marksOnDate(marks: MonthlyPaymentMark[], date: string) {
  return marks.filter((mark) => mark.date === date);
}

export function OrderMonthlyServiceCalendar({
  order,
  className,
}: {
  order: Order;
  className?: string;
}) {
  const commerce = usePlatformPricingStore((s) => s.config.commerce);
  const period = useMemo(() => resolveMonthlyServicePeriod(order), [order]);
  const paymentMarks = useMemo(
    () => resolveMonthlyPaymentMarks(order, commerce),
    [order, commerce],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    if (period) {
      years.add(Number(period.from.slice(0, 4)));
      years.add(Number(period.to.slice(0, 4)));
    }
    for (const mark of paymentMarks) {
      years.add(Number(mark.date.slice(0, 4)));
    }
    const min = Math.min(...years) - 1;
    const max = Math.max(...years) + 1;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [period, paymentMarks]);

  const initial = useMemo(() => {
    const seed = period?.from ?? paymentMarks[0]?.date;
    if (seed) {
      return {
        year: Number(seed.slice(0, 4)),
        month: Number(seed.slice(5, 7)),
      };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [period, paymentMarks]);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const shiftMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  if (!period && paymentMarks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-20 bg-ink-20/10 px-4 py-8 text-center text-sm text-ink-60">
        尚未填写开始服务时间或雇佣月份，无法在日历中展示预期服务期与支付节点。
      </p>
    );
  }

  const periodLabel = period
    ? period.months.length <= 4
      ? period.months.map(formatMonthLabel).join("、")
      : `${formatMonthLabel(period.months[0]!)} – ${formatMonthLabel(period.months[period.months.length - 1]!)}`
    : null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-[5.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="h-8 w-[4.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
            工作日服务
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ink-20" />
            周末 / 节假日不服务
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 items-center justify-center rounded bg-amber-500 px-1 text-[9px] font-semibold text-white">
              支付下月
            </span>
            每月 {commerce.monthlyPrepayDay} 日 {String(commerce.billingCutoffHour).padStart(2, "0")}:00 前，遇休息日提前
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-ink-40">
            {label}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.inMonth) {
            return <div key={`pad-${idx}`} className="min-h-[64px]" />;
          }

          const inSpan = period
            ? isDateInMonthlyHireSpan(cell.date, period)
            : false;
          const expected = period
            ? isDateInMonthlyServicePeriod(cell.date, period)
            : false;
          const dayKind = classifyCnDay(cell.date);
          const restInSpan = inSpan && !expected;
          const dayMarks = marksOnDate(paymentMarks, cell.date);
          const hasPay = dayMarks.length > 0;
          const allPaid = hasPay && dayMarks.every((mark) => mark.paid);
          const restLabel =
            dayKind === "holiday" ? "节" : dayKind === "weekend" ? "休" : null;
          const title = [
            cell.date,
            expected
              ? dayKind === "makeup"
                ? "调休上班 · 计入服务"
                : "工作日服务"
              : restInSpan
                ? dayKind === "holiday"
                  ? "法定节假日，不计入按月服务"
                  : "周末，不计入按月服务"
                : null,
            ...dayMarks.map(
              (mark) =>
                `${mark.label}${mark.nominalDate ? " · 遇休息日提前" : ""}${mark.paid ? " · 已付" : ""}`,
            ),
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={cell.date}
              title={title}
              className={cn(
                "flex min-h-[64px] flex-col overflow-hidden rounded-lg border px-1 py-1",
                expected
                  ? "border-rose-400 bg-rose-50"
                  : restInSpan
                    ? "border-ink-20/40 bg-ink-20/30"
                    : "border-ink-20/50 bg-white",
                hasPay && "ring-2 ring-amber-400 ring-offset-1",
              )}
            >
              <div
                className={cn(
                  "text-[10px] font-medium",
                  expected ? "text-rose-800" : restInSpan ? "text-ink-40" : "text-ink-60",
                )}
              >
                {cell.day}
              </div>
              {expected ? (
                <div className="mt-0.5 text-[9px] font-medium leading-tight text-rose-700">
                  {dayKind === "makeup" ? "调休" : "服务"}
                </div>
              ) : restInSpan && restLabel ? (
                <div className="mt-0.5 text-[9px] font-medium leading-tight text-ink-40">
                  {restLabel}
                </div>
              ) : null}
              {dayMarks.map((mark) => (
                <div
                  key={`${mark.date}-${mark.kind}-${mark.forMonth ?? mark.label}`}
                  className={cn(
                    "mt-0.5 truncate rounded px-0.5 py-px text-[9px] font-semibold leading-tight text-white",
                    allPaid ? "bg-emerald-600" : "bg-amber-500",
                  )}
                >
                  {mark.kind === "prepay" ? "预付" : "支付下月"}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-ink-20 bg-ink-20/10 px-4 py-3 text-xs leading-relaxed text-ink-70">
        {periodLabel ? (
          <p>
            <span className="font-medium text-ink">委托人预期服务期</span>
            {" · "}
            {periodLabel}
            {period ? `（${formatDate(period.from)} 至 ${formatDate(period.to)}）` : ""}
            {period
              ? ` · ${countMonthlyServiceWorkdays(period)} 个工作日`
              : ""}
            <span className="mt-1 block text-ink-50">
              不含周末与法定节假日；调休上班日照常计入服务。
            </span>
          </p>
        ) : null}
        {paymentMarks.length > 0 ? (
          <ul className={cn("space-y-1", periodLabel ? "mt-2" : undefined)}>
            {paymentMarks.map((mark) => (
              <li
                key={`${mark.date}-${mark.kind}-${mark.forMonth ?? mark.label}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-semibold text-white",
                    mark.paid ? "bg-emerald-600" : "bg-amber-500",
                  )}
                >
                  {mark.kind === "prepay" ? "预付" : "支付下月"}
                </span>
                <span className="font-medium text-ink">
                  {formatDate(mark.date)}
                </span>
                <span>
                  {mark.kind === "prepay"
                    ? `${mark.label}（开始服务日前 3 天${mark.nominalDate ? "，遇休息日再提前" : ""}）`
                    : mark.kind === "monthly"
                      ? `${mark.label}（当日 17:00 前）`
                      : mark.label}
                  {mark.kind !== "prepay" && mark.nominalDate
                    ? ` · 由 ${Number(mark.nominalDate.slice(8, 10))} 日提前`
                    : ""}
                </span>
                {mark.paid ? (
                  <span className="text-emerald-700">已支付</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
