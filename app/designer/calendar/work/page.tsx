"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { persistDesignerCalendar } from "@/lib/designer-calendar-persist";
import { DesignerWorkCalendar } from "@/components/domain/designer-work-calendar";
import { normalizeWorkContentInputs } from "@/lib/work-calendar-content";
import { CalendarDays } from "lucide-react";

export default function DesignerWorkCalendarPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer, loading } = useDesigner(identityId);
  const push = useSessionStore((s) => s.pushNotification);

  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getBaseCalendar = useDesignerCalendarStore((s) => s.getBaseCalendar);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);
  const getSettings = useDesignerCalendarStore((s) => s.getSettings);
  const addEvent = useDesignerCalendarStore((s) => s.addEvent);
  const addEvents = useDesignerCalendarStore((s) => s.addEvents);
  const removeEvent = useDesignerCalendarStore((s) => s.removeEvent);
  const updateEventWorkContents = useDesignerCalendarStore(
    (s) => s.updateEventWorkContents,
  );

  useEffect(() => {
    if (designer) hydrateFromDesigner(designer);
  }, [designer, hydrateFromDesigner]);

  const syncCalendar = async () => {
    try {
      await persistDesignerCalendar(designer!.id);
    } catch {
      push({ title: "工作日历同步失败", variant: "destructive" });
    }
  };

  if (loading || !designer) {
    return <div className="py-20 text-center text-ink-60">正在加载工作日历...</div>;
  }

  const baseCalendar = getBaseCalendar(designer.id);
  const events = getEvents(designer.id);
  const batchSettings = getSettings(designer.id);
  const workCount = events.length;
  const orderCount = events.filter((e) => e.source === "order").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            工作日历
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            按工时服务日期一览 · 与接单档期数据同步 · 半天粒度
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="emerald">空闲 · 可接单</Badge>
          <Badge variant="rose">已安排工作</Badge>
          <Badge variant="muted">不接单</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-ink-40">本月占用半天</div>
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

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-ink-60" />
          <h3 className="text-base font-semibold text-ink">按工时服务日历</h3>
        </div>
        <DesignerWorkCalendar
          baseCalendar={baseCalendar}
          events={events}
          batchSettings={batchSettings}
          onAddEvent={async (payload) => {
            addEvent(designer.id, { ...payload, source: "manual" });
            await syncCalendar();
            push({
              title: "日程已添加",
              description: `${payload.title} · 该半天已标记占用`,
              variant: "success",
            });
          }}
          onAddEvents={async (items) => {
            addEvents(
              designer.id,
              items.map((item) => ({ ...item, source: "manual" as const })),
            );
            await syncCalendar();
            push({
              title: "已批量标记占用",
              description: `共 ${items.length} 个半天 · ${items[0]?.title ?? ""}`,
              variant: "success",
            });
          }}
          onRemoveEvent={async (eventId) => {
            removeEvent(designer.id, eventId);
            await syncCalendar();
            push({ title: "自建日程已删除", variant: "default" });
          }}
          onUpdateWorkContents={async (eventId, lines) => {
            const ok = updateEventWorkContents(
              designer.id,
              eventId,
              normalizeWorkContentInputs(lines),
            );
            if (ok) {
              await syncCalendar();
              push({
                title: "工作内容已保存",
                description: "委托人及管理员可在订单详情中查看。",
                variant: "success",
              });
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
    </div>
  );
}
