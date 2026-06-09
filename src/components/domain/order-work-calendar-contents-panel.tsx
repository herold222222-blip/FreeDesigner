"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PERIOD_LABELS } from "@/lib/designer-schedule";
import { getOrderWorkCalendarEvents } from "@/lib/work-calendar-content";
import { useDesigner } from "@/lib/use-data";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import type { Order } from "@/lib/types";

export function OrderWorkCalendarContentsPanel({
  order,
  perspective,
}: {
  order: Order;
  perspective: "client" | "admin" | "designer";
}) {
  const designerId = order.designerId;
  const { data: designer } = useDesigner(designerId);
  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);

  useEffect(() => {
    if (designer) hydrateFromDesigner(designer);
  }, [designer, hydrateFromDesigner]);

  if (!designerId) return null;

  const events = getOrderWorkCalendarEvents(getEvents(designerId), order.code);
  if (events.length === 0 && order.billingMode !== "daily") return null;
  const withContents = events.filter((e) => (e.workContents?.length ?? 0) > 0);

  if (withContents.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ClipboardList className="h-4 w-4 text-ink-60" />
          工时工作内容
        </div>
        <p className="mt-2 text-sm text-ink-60">
          {perspective === "designer"
            ? "请在「工作日历」中为已安排时段填写工作内容，保存后委托人与管理员可查看。"
            : "设计师尚未提交本订单的工时工作内容。"}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-ink-60" />
          <h3 className="text-base font-semibold text-ink">工时工作内容</h3>
        </div>
        <Badge variant="muted">
          {perspective === "admin" ? "管理员可见" : "设计师提交"}
        </Badge>
      </div>
      <div className="space-y-3">
        {withContents.map((event) => (
          <div
            key={event.id}
            className="rounded-xl border border-ink-20 bg-ink-20/10 p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-ink">{event.title}</span>
              <Badge variant="outline" className="text-[10px]">
                {formatDate(event.date)} · {PERIOD_LABELS[event.period]}
              </Badge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {event.workContents!.map((item, i) => (
                <li
                  key={item.id}
                  className="flex gap-2 text-sm text-ink"
                >
                  <span className="text-ink-40">{i + 1}.</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            {event.workContentsSavedAt ? (
              <p className="mt-2 text-[11px] text-ink-40">
                提交于 {formatDateTime(event.workContentsSavedAt)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
