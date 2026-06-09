"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_LABELS,
  WEEKDAY_LABELS,
  formatHalfDaySlot,
  getMonthGrid,
} from "@/lib/designer-schedule";
import type { WorkCalendarEvent } from "@/lib/types";
import {
  WORK_LOG_STATUS_META,
  getWorkLogStatus,
} from "@/lib/work-log-status";
import { initialCalendarMonth } from "@/lib/time-billing";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2024 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function LogStatusIcon({ status }: { status: ReturnType<typeof getWorkLogStatus> }) {
  const meta = WORK_LOG_STATUS_META[status];
  if (status === "filled") {
    return <Check className={cn("h-3.5 w-3.5", meta.iconClass)} strokeWidth={3} />;
  }
  if (status === "overdue") {
    return <X className={cn("h-3.5 w-3.5", meta.iconClass)} strokeWidth={3} />;
  }
  return <span className="h-2 w-2 rounded-full bg-ink-30" />;
}

export function OrderProjectWorkCalendar({
  events,
}: {
  events: WorkCalendarEvent[];
}) {
  const initial = useMemo(() => initialCalendarMonth(events), [events]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [activeEvent, setActiveEvent] = useState<WorkCalendarEvent | null>(null);

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const eventBySlot = useMemo(() => {
    const map = new Map<string, WorkCalendarEvent>();
    for (const e of events) {
      map.set(`${e.date}:${e.period}`, e);
    }
    return map;
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

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-20 bg-ink-20/10 px-4 py-8 text-center text-sm text-ink-60">
        暂无与本项目相关的工作日程，设计师确认档期后将显示在日历中。
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
              {YEAR_OPTIONS.map((y) => (
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
            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
            已填日志
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-30" />
            待填写
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-rose-600" strokeWidth={3} />
            逾期未填
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-ink-40">
            {d}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.inMonth) {
            return <div key={`pad-${idx}`} className="min-h-[52px]" />;
          }

          const amEvent = eventBySlot.get(`${cell.date}:am`);
          const pmEvent = eventBySlot.get(`${cell.date}:pm`);
          const hasProjectSlot = !!(amEvent || pmEvent);

          return (
            <div
              key={cell.date}
              className={cn(
                "flex min-h-[52px] flex-col overflow-hidden rounded-lg border",
                hasProjectSlot ? "border-brand/30 bg-brand/5" : "border-ink-20/40",
              )}
            >
              <div className="bg-ink-20/20 px-1 py-0.5 text-center text-[10px] font-medium text-ink-60">
                {cell.day}
              </div>
              <div className="flex flex-1 flex-col">
                {(["am", "pm"] as const).map((period) => {
                  const event =
                    period === "am" ? amEvent : pmEvent;
                  if (!event) {
                    return (
                      <div
                        key={period}
                        className={cn(
                          "flex flex-1 items-center justify-center text-[9px] text-ink-30",
                          period === "am" && "border-b border-ink-20/30",
                        )}
                      >
                        {PERIOD_LABELS[period]}
                      </div>
                    );
                  }

                  const logStatus = getWorkLogStatus(event);

                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setActiveEvent(event)}
                      title={`${formatHalfDaySlot({ date: event.date, period: event.period })} · ${WORK_LOG_STATUS_META[logStatus].label}`}
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-medium transition-colors hover:bg-white/60",
                        period === "am" && "border-b border-ink-20/40",
                        logStatus === "overdue" && "bg-rose-50/80",
                        logStatus === "filled" && "bg-emerald-50/60",
                      )}
                    >
                      <span className="text-ink-60">{PERIOD_LABELS[period]}</span>
                      <LogStatusIcon status={logStatus} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!activeEvent} onOpenChange={(v) => !v && setActiveEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeEvent
                ? formatHalfDaySlot({
                    date: activeEvent.date,
                    period: activeEvent.period,
                  })
                : "工作日志"}
            </DialogTitle>
            <DialogDescription>{activeEvent?.title}</DialogDescription>
          </DialogHeader>
          {activeEvent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <LogStatusIcon status={getWorkLogStatus(activeEvent)} />
                <span className="text-ink-60">
                  {WORK_LOG_STATUS_META[getWorkLogStatus(activeEvent)].label}
                </span>
              </div>
              {(activeEvent.workContents?.length ?? 0) > 0 ? (
                <ul className="space-y-2 rounded-xl border border-ink-20 bg-ink-20/10 p-3 text-sm text-ink">
                  {activeEvent.workContents!.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="text-ink-40">·</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-60">设计师尚未填写本时段工作日志。</p>
              )}
              {activeEvent.workContentsSavedAt ? (
                <p className="text-xs text-ink-40">
                  提交于 {formatDateTime(activeEvent.workContentsSavedAt)}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
