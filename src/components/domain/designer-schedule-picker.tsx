"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CalendarSlot,
  DayPeriod,
  HalfDaySlot,
  WorkCalendarEvent,
} from "@/lib/types";
import {
  PERIOD_LABELS,
  WEEKDAY_LABELS,
  formatSelectedSlotsSummary,
  getDaySlotStatus,
  getMonthGrid,
  getAvailableDaySlots,
  halfDaysToWorkDays,
  isFullDaySelected,
  isPeriodAvailable,
  isSlotSelected,
  slotKey,
  sortSlots,
  toggleHalfDaySlot,
  toggleFullDay,
} from "@/lib/designer-schedule";
import { collectOccupiedKeys } from "@/lib/designer-work-calendar";

export interface DesignerSchedulePickerProps {
  calendar: CalendarSlot[];
  value: HalfDaySlot[];
  onChange?: (slots: HalfDaySlot[]) => void;
  /** 工作日历占用：红色「已安排」，与灰色「不接单」区分 */
  events?: WorkCalendarEvent[];
  /** 编辑可预约档期（与 onChange 二选一） */
  onToggleAvailability?: (date: string, period: DayPeriod) => void;
  readOnly?: boolean;
  initialYear?: number;
  initialMonth?: number;
  className?: string;
}

export function DesignerSchedulePicker({
  calendar,
  value,
  onChange,
  events,
  onToggleAvailability,
  readOnly = false,
  initialYear = 2026,
  initialMonth = 5,
  className,
}: DesignerSchedulePickerProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const sortedValue = useMemo(() => sortSlots(value), [value]);
  const workDays = halfDaysToWorkDays(sortedValue);
  const occupiedKeys = useMemo(
    () => collectOccupiedKeys(events ?? []),
    [events],
  );
  const showWorkBusy = events !== undefined;

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

  const handlePeriodClick = (date: string, period: DayPeriod) => {
    if (readOnly) return;
    if (onToggleAvailability) {
      onToggleAvailability(date, period);
      return;
    }
    if (!isPeriodAvailable(calendar, date, period)) return;
    onChange?.(toggleHalfDaySlot(value, { date, period }));
  };

  const handleFullDayClick = (date: string) => {
    if (readOnly) return;
    onChange?.(toggleFullDay(value, calendar, date));
  };

  const clearSelection = () => onChange?.([]);

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
            </>
          )}
          <h3 className="text-base font-semibold text-ink">
            {year} 年 {month} 月
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> 空闲
          </span>
          {showWorkBusy ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> 已安排
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-ink-20" /> 不接单
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ink-20" /> 已占用
            </span>
          )}
          {!readOnly && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ink" /> 已选
            </span>
          )}
          {!readOnly && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-emerald-500 bg-emerald-100" />{" "}
              点选全天
            </span>
          )}
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
          const status = getDaySlotStatus(calendar, cell.date);
          const availableDay = getAvailableDaySlots(calendar, cell.date);
          const fullDaySelected = isFullDaySelected(value, calendar, cell.date);
          return (
            <div
              key={cell.date}
              className="flex min-h-[44px] flex-col overflow-hidden rounded-lg border border-ink-20/60 sm:min-h-[52px]"
            >
              <DayHeader
                day={cell.day}
                date={cell.date}
                readOnly={readOnly}
                hasAvailable={availableDay.length > 0}
                fullDaySelected={fullDaySelected}
                onFullDayClick={() => handleFullDayClick(cell.date)}
              />
              <div className="flex flex-1 flex-col">
                {(["am", "pm"] as DayPeriod[]).map((period) => {
                  const occupied = Boolean(
                    occupiedKeys?.has(slotKey({ date: cell.date, period })),
                  );
                  const cellStatus: PeriodVisualStatus = occupied
                    ? "occupied"
                    : status[period];
                  return (
                    <PeriodCell
                      key={period}
                      date={cell.date}
                      period={period}
                      status={cellStatus}
                      selected={isSlotSelected(value, cell.date, period)}
                      readOnly={readOnly}
                      editAvailability={!!onToggleAvailability}
                      onClick={() => handlePeriodClick(cell.date, period)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                已选档期
              </div>
              <div className="mt-1 text-sm font-medium text-ink">
                {sortedValue.length > 0
                  ? formatSelectedSlotsSummary(sortedValue)
                  : "点击空闲日期的上午/下午选择（可单选或多选，最少半天）"}
              </div>
              {sortedValue.length > 0 && (
                <div className="mt-1 text-xs text-ink-60">
                  共 {sortedValue.length} 个半天 · 折合 {workDays} 工日 · 可连续或跳跃选择
                </div>
              )}
            </div>
            {sortedValue.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                清空
              </Button>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-50">
            {showWorkBusy
              ? "绿色为空闲可点选，红色为设计师已安排工作，灰色为不接单。"
              : "点击空闲时段即可选中，再次点击取消。"}
            日期旁圆点可一键选/取消该日全部空闲时段。支持连续或跳跃多选，最少 0.5 天。
          </p>
        </div>
      )}
    </div>
  );
}

function DayHeader({
  day,
  date,
  readOnly,
  hasAvailable,
  fullDaySelected,
  onFullDayClick,
}: {
  day: number;
  date: string;
  readOnly: boolean;
  hasAvailable: boolean;
  fullDaySelected: boolean;
  onFullDayClick: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 bg-ink-20/20 px-1 py-0.5">
      <span className="text-[10px] font-medium text-ink-60">{day}</span>
      {!readOnly && hasAvailable && (
        <button
          type="button"
          onClick={onFullDayClick}
          title={`${date} · 选/取消全天`}
          aria-label={`${date} 选全天`}
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border transition-colors",
            fullDaySelected
              ? "border-ink bg-ink"
              : "border-emerald-500 bg-emerald-100 hover:bg-emerald-200",
          )}
        />
      )}
    </div>
  );
}

type PeriodVisualStatus = "available" | "busy" | "occupied";

function PeriodCell({
  period,
  status,
  selected,
  readOnly,
  editAvailability,
  onClick,
  date,
}: {
  date: string;
  period: DayPeriod;
  status: PeriodVisualStatus;
  selected: boolean;
  readOnly: boolean;
  editAvailability?: boolean;
  onClick: () => void;
}) {
  const blocked = status !== "available";
  const occupied = status === "occupied";
  const Tag = readOnly ? "div" : "button";
  const titleHint =
    occupied ? " · 已安排工作" : status === "busy" ? " · 不接单" : " · 空闲";

  return (
    <Tag
      type={readOnly ? undefined : "button"}
      onClick={readOnly ? undefined : onClick}
      disabled={readOnly ? undefined : blocked && !editAvailability}
      title={`${date} ${PERIOD_LABELS[period]}${titleHint}`}
      className={cn(
        "flex flex-1 items-center justify-center text-[9px] font-medium transition-colors",
        period === "am" && "border-b border-ink-20/40",
        occupied &&
          "cursor-not-allowed bg-rose-50 text-rose-800 line-through",
        status === "busy" &&
          "cursor-not-allowed bg-ink-20/30 text-ink-40 line-through",
        !blocked && !selected && "bg-emerald-50/80 text-emerald-800",
        !blocked && !readOnly && !selected && "hover:bg-emerald-100",
        selected && "bg-ink text-white",
        readOnly && !blocked && !selected && "bg-emerald-50/60 text-emerald-700",
      )}
    >
      {PERIOD_LABELS[period]}
    </Tag>
  );
}
