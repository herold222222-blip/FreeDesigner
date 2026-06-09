"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  PERIOD_LABELS,
  WEEKDAY_LABELS,
  formatHalfDaySlot,
  formatSelectedSlotsSummary,
  getMonthGrid,
  halfDaysToWorkDays,
  isSlotSelected,
  sortSlots,
  toggleHalfDaySlot,
} from "@/lib/designer-schedule";
import {
  WORK_PERIOD_META,
  collectOccupiedKeys,
  eventsForPeriod,
  getWorkPeriodStatus,
  isPeriodMarkable,
  type CalendarBatchSettings,
} from "@/lib/designer-work-calendar";
import { WorkCalendarContentEditor } from "@/components/domain/work-calendar-content-editor";
import type { CalendarSlot, DayPeriod, HalfDaySlot, WorkCalendarEvent } from "@/lib/types";

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2024 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export function DesignerWorkCalendar({
  baseCalendar,
  events,
  batchSettings,
  onAddEvent,
  onAddEvents,
  onRemoveEvent,
  onUpdateWorkContents,
  initialYear = 2026,
  initialMonth = 5,
}: {
  baseCalendar: CalendarSlot[];
  events: WorkCalendarEvent[];
  batchSettings: CalendarBatchSettings;
  onAddEvent: (payload: {
    date: string;
    period: DayPeriod;
    title: string;
    note?: string;
  }) => void;
  onAddEvents: (
    items: Array<{
      date: string;
      period: DayPeriod;
      title: string;
      note?: string;
    }>,
  ) => void;
  onRemoveEvent: (eventId: string) => void;
  onUpdateWorkContents: (eventId: string, lines: string[]) => boolean | Promise<boolean>;
  initialYear?: number;
  initialMonth?: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedSlots, setSelectedSlots] = useState<HalfDaySlot[]>([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{
    date: string;
    period: DayPeriod;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const occupiedKeys = useMemo(() => collectOccupiedKeys(events), [events]);
  const sortedSelection = useMemo(
    () => sortSlots(selectedSlots),
    [selectedSlots],
  );

  const activeEvents =
    activeSlot ?
      eventsForPeriod(events, activeSlot.date, activeSlot.period)
    : [];
  const primaryEvent = activeEvents[0];
  const primaryEventLive =
    primaryEvent ? events.find((e) => e.id === primaryEvent.id) : undefined;

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
    const status = getWorkPeriodStatus(
      baseCalendar,
      date,
      period,
      occupiedKeys,
      batchSettings,
    );
    if (status === "closed") return;

    if (status === "occupied") {
      setActiveSlot({ date, period });
      const existing = eventsForPeriod(events, date, period)[0];
      setTitle(existing?.title ?? "");
      setNote(existing?.note ?? "");
      setViewDialogOpen(true);
      return;
    }

    setSelectedSlots((prev) => toggleHalfDaySlot(prev, { date, period }));
  };

  const openBatchDialog = () => {
    if (sortedSelection.length === 0) return;
    setTitle("");
    setNote("");
    setBatchDialogOpen(true);
  };

  const handleBatchSave = () => {
    if (!title.trim() || sortedSelection.length === 0) return;
    onAddEvents(
      sortedSelection.map((slot) => ({
        date: slot.date,
        period: slot.period,
        title: title.trim(),
        note: note.trim() || undefined,
      })),
    );
    setSelectedSlots([]);
    setBatchDialogOpen(false);
    setTitle("");
    setNote("");
  };

  const handleSingleSave = () => {
    if (!activeSlot || !title.trim()) return;
    for (const e of activeEvents) {
      if (e.source === "manual") onRemoveEvent(e.id);
    }
    onAddEvent({
      date: activeSlot.date,
      period: activeSlot.period,
      title: title.trim(),
      note: note.trim() || undefined,
    });
    setViewDialogOpen(false);
    setActiveSlot(null);
    setTitle("");
    setNote("");
  };

  const handleRemoveManual = () => {
    for (const e of activeEvents) {
      if (e.source === "manual") onRemoveEvent(e.id);
    }
    setViewDialogOpen(false);
  };

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
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-ink-60"
            onClick={() => {
              setYear(initialYear);
              setMonth(initialMonth);
            }}
          >
            回到今天
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-60">
          {(Object.keys(WORK_PERIOD_META) as Array<keyof typeof WORK_PERIOD_META>).map(
            (key) => (
              <span key={key} className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    WORK_PERIOD_META[key].dotClass,
                  )}
                />
                {WORK_PERIOD_META[key].label}
              </span>
            ),
          )}
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ink" /> 已选
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
          return (
            <div
              key={cell.date}
              className="flex min-h-[52px] flex-col overflow-hidden rounded-lg border border-ink-20/60"
            >
              <div className="bg-ink-20/20 px-1 py-0.5 text-center text-[10px] font-medium text-ink-60">
                {cell.day}
              </div>
              <div className="flex flex-1 flex-col">
                {(["am", "pm"] as DayPeriod[]).map((period) => {
                  const status = getWorkPeriodStatus(
                    baseCalendar,
                    cell.date,
                    period,
                    occupiedKeys,
                    batchSettings,
                  );
                  const meta = WORK_PERIOD_META[status];
                  const periodEvents = eventsForPeriod(
                    events,
                    cell.date,
                    period,
                  );
                  const selected = isSlotSelected(
                    selectedSlots,
                    cell.date,
                    period,
                  );
                  const markable = isPeriodMarkable(
                    baseCalendar,
                    cell.date,
                    period,
                    occupiedKeys,
                    batchSettings,
                  );

                  return (
                    <button
                      key={period}
                      type="button"
                      disabled={status === "closed"}
                      onClick={() => handlePeriodClick(cell.date, period)}
                      title={`${cell.date} ${PERIOD_LABELS[period]} · ${meta.label}${
                        periodEvents[0]?.title ? ` · ${periodEvents[0].title}` : ""
                      }`}
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center px-0.5 text-[9px] font-medium transition-colors",
                        period === "am" && "border-b border-ink-20/40",
                        !selected && meta.cellClass,
                        selected && "bg-ink text-white",
                        status === "closed" && "cursor-not-allowed",
                        markable && !selected && "cursor-pointer",
                      )}
                    >
                      <span>{PERIOD_LABELS[period]}</span>
                      {periodEvents[0] && !selected ? (
                        <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] opacity-80">
                          {periodEvents[0].title}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
              待标记占用
            </div>
            <div className="mt-1 text-sm font-medium text-ink">
              {sortedSelection.length > 0 ?
                formatSelectedSlotsSummary(sortedSelection)
              : "点击绿色空闲半天可多选（支持连续或跳跃）"}
            </div>
            {sortedSelection.length > 0 ? (
              <div className="mt-1 text-xs text-ink-60">
                共 {sortedSelection.length} 个半天 · 折合{" "}
                {halfDaysToWorkDays(sortedSelection)} 工日
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedSelection.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSlots([])}
                >
                  清空选择
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={openBatchDialog}
                >
                  <Plus className="h-3.5 w-3.5" /> 标记为占用
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-50">
          绿色为可接单空闲；红色为已安排工作；灰色为不接单（如周末）。
          未录入的未来日期默认显示绿色。点击红色可查看详情；选中多个绿色半天后点「标记为占用」批量添加日程。
        </p>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeSlot ? formatHalfDaySlot(activeSlot) : "日程详情"}
            </DialogTitle>
            <DialogDescription>
              {activeEvents.some((e) => e.source === "order")
                ? "该时段已有项目工作安排，委托人无法预约。"
                : "查看或编辑该半天日程。"}
            </DialogDescription>
          </DialogHeader>

          {activeEvents.length > 0 ? (
            <ul className="space-y-2 rounded-xl border border-ink-20 bg-ink-20/10 p-3">
              {activeEvents.map((e) => (
                <li key={e.id} className="text-sm">
                  <div className="font-medium text-ink">{e.title}</div>
                  {e.orderCode ? (
                    <div className="text-xs text-ink-60">订单 {e.orderCode}</div>
                  ) : null}
                  {e.note ? (
                    <div className="text-xs text-ink-60">{e.note}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {primaryEventLive ? (
            <WorkCalendarContentEditor
              event={primaryEventLive}
              onSave={(lines) => onUpdateWorkContents(primaryEventLive.id, lines)}
            />
          ) : null}

          {!activeEvents.some((e) => e.source === "order") && !primaryEventLive ? (
            <div className="space-y-3">
              <div>
                <Label>日程标题</Label>
                <Input
                  className="mt-1.5"
                  placeholder="例如：现场踏勘、方案汇报"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>备注（选填）</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  placeholder="地点、参与人等"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            {activeEvents.some((e) => e.source === "manual") ? (
              <Button variant="outline" onClick={handleRemoveManual}>
                <Trash2 className="h-4 w-4" /> 删除自建日程
              </Button>
            ) : null}
            {!activeEvents.some((e) => e.source === "order") ? (
              <Button variant="brand" onClick={handleSingleSave} disabled={!title.trim()}>
                <Plus className="h-4 w-4" /> 保存日程
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量标记占用</DialogTitle>
            <DialogDescription>
              为已选的 {sortedSelection.length} 个半天添加同一日程，标记后委托人无法预约这些时段。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2 text-xs text-ink-60">
            {formatSelectedSlotsSummary(sortedSelection)}
          </div>
          <div className="space-y-3">
            <div>
              <Label>日程标题</Label>
              <Input
                className="mt-1.5"
                placeholder="例如：驻场深化、方案汇报"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>备注（选填）</Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="brand"
              onClick={handleBatchSave}
              disabled={!title.trim()}
            >
              确认标记 {sortedSelection.length} 个半天
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
