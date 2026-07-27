"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DesignerWorkCalendar } from "@/components/domain/designer-work-calendar";
import { persistDesignerCalendar } from "@/lib/designer-calendar-persist";
import { normalizeWorkContentInputs } from "@/lib/work-calendar-content";
import { getOnlineMeetingTimeLabel } from "@/lib/designer-service-settings";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { useSessionStore } from "@/store/session-store";
import { invalidateApiPath } from "@/lib/use-data";
import type { Designer } from "@/lib/types";
import { Save } from "lucide-react";

export function DesignerScheduleWorkspace({
  designer,
  onPersisted,
}: {
  designer: Designer;
  onPersisted?: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);

  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getBaseCalendar = useDesignerCalendarStore((s) => s.getBaseCalendar);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);
  const getSettings = useDesignerCalendarStore((s) => s.getSettings);
  const setSettings = useDesignerCalendarStore((s) => s.setSettings);
  const saveBatchSettings = useDesignerCalendarStore((s) => s.saveBatchSettings);
  const addEvent = useDesignerCalendarStore((s) => s.addEvent);
  const addEvents = useDesignerCalendarStore((s) => s.addEvents);
  const removeEvent = useDesignerCalendarStore((s) => s.removeEvent);
  const updateEventWorkContents = useDesignerCalendarStore(
    (s) => s.updateEventWorkContents,
  );

  useEffect(() => {
    hydrateFromDesigner(designer);
  }, [designer, hydrateFromDesigner]);

  const syncCalendar = async () => {
    await persistDesignerCalendar(designer.id);
    invalidateApiPath(`/api/designers/${designer.id}`);
    onPersisted?.();
  };

  const baseCalendar = getBaseCalendar(designer.id);
  const events = getEvents(designer.id);
  const settings = getSettings(designer.id);
  const workCount = events.length;
  const orderCount = events.filter((e) => e.source === "order").length;

  const handleAllDayChange = (open: boolean) => {
    setSettings(designer.id, {
      allDay: open,
      ...(open ? { closeWeekend: false, closeHoliday: false } : {}),
    });
  };

  const handleCloseWeekendChange = (closed: boolean) => {
    setSettings(designer.id, {
      closeWeekend: closed,
      ...(closed ? { allDay: false } : {}),
    });
  };

  const handleCloseHolidayChange = (closed: boolean) => {
    setSettings(designer.id, {
      closeHoliday: closed,
      ...(closed ? { allDay: false } : {}),
    });
  };

  const handleSaveBatch = async () => {
    saveBatchSettings(designer.id);
    try {
      await syncCalendar();
      push({
        title: "档期设置已保存",
        description: "批量规则已同步至服务器。",
        variant: "success",
      });
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    }
  };

  return (
    <div id="schedule" className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">接单档期</h2>
        <p className="mt-1 text-sm text-ink-60">
          查看与调整工作安排 · 定向下单与线下上门均需在空闲档期内选择 · 最少半天 · 线上会议时间{" "}
          {designer.onlineMeetingTime
            ? getOnlineMeetingTimeLabel(designer.onlineMeetingTime)
            : designer.meetingFlexibility || "未设置"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="emerald">空闲 · 可接单</Badge>
        <Badge variant="rose">已安排工作</Badge>
        <Badge variant="muted">不接单</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-ink-40">占用半天</div>
          <div className="mt-1 text-2xl font-bold text-ink">{workCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-40">项目安排</div>
          <div className="mt-1 text-2xl font-bold text-rose-700">{orderCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-40">自建日程</div>
          <div className="mt-1 text-2xl font-bold text-ink">
            {workCount - orderCount}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card className="p-5">
          <p className="mb-4 text-xs text-ink-60">
            按工时查看空闲 / 占用状态，可添加或删除自建日程；批量规则保存在右侧。
          </p>
          <DesignerWorkCalendar
            baseCalendar={baseCalendar}
            events={events}
            batchSettings={settings}
            onAddEvent={async (payload) => {
              addEvent(designer.id, { ...payload, source: "manual" });
              try {
                await syncCalendar();
                push({
                  title: "日程已添加",
                  description: `${payload.title} · 该半天已标记占用`,
                  variant: "success",
                });
              } catch {
                push({ title: "工作日历同步失败", variant: "destructive" });
              }
            }}
            onAddEvents={async (items) => {
              addEvents(
                designer.id,
                items.map((item) => ({ ...item, source: "manual" as const })),
              );
              try {
                await syncCalendar();
                push({
                  title: "已批量标记占用",
                  description: `共 ${items.length} 个半天 · ${items[0]?.title ?? ""}`,
                  variant: "success",
                });
              } catch {
                push({ title: "工作日历同步失败", variant: "destructive" });
              }
            }}
            onRemoveEvent={async (eventId) => {
              removeEvent(designer.id, eventId);
              try {
                await syncCalendar();
                push({ title: "自建日程已删除", variant: "default" });
              } catch {
                push({ title: "工作日历同步失败", variant: "destructive" });
              }
            }}
            onUpdateWorkContents={async (eventId, lines) => {
              const ok = updateEventWorkContents(
                designer.id,
                eventId,
                normalizeWorkContentInputs(lines),
              );
              if (ok) {
                try {
                  await syncCalendar();
                  push({
                    title: "工作内容已保存",
                    description: "委托人及管理员可在订单详情中查看。",
                    variant: "success",
                  });
                } catch {
                  push({ title: "工作日历同步失败", variant: "destructive" });
                }
              } else {
                push({
                  title: "已超过 24 小时修改期限",
                  variant: "destructive",
                });
              }
              return ok;
            }}
          />
        </Card>

        <Card className="h-fit space-y-4 p-5">
          <h3 className="text-sm font-semibold text-ink">批量设置</h3>
          <ToggleRow
            label="关闭周末"
            checked={settings.closeWeekend}
            disabled={settings.allDay}
            onChange={handleCloseWeekendChange}
          />
          <ToggleRow
            label="关闭法定节假日"
            checked={settings.closeHoliday}
            disabled={settings.allDay}
            onChange={handleCloseHolidayChange}
          />
          <ToggleRow
            label="全年全时段开放接单"
            checked={settings.allDay}
            onChange={handleAllDayChange}
          />
          {settings.allDay ? (
            <p className="text-xs text-ink-40">
              已开启全年全时段接单，周末与法定节假日档期将自动开放。
            </p>
          ) : null}
          <Button variant="brand" className="w-full" onClick={handleSaveBatch}>
            <Save className="h-4 w-4" /> 保存批量设置
          </Button>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm${disabled ? " opacity-50" : ""}`}
    >
      <span className="text-ink">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
