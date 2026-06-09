"use client";

import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatSelectedSlotsSummary,
  formatSelectedMonthsSummary,
} from "@/lib/designer-schedule";
import { formatCurrency } from "@/lib/utils";
import type { ScheduleRequest } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import {
  acceptOrderRequest,
  rejectOrderScheduleRequest,
} from "@/lib/api-client";

export function ScheduleRequestPanel({
  requests,
  perspective,
  onUpdated,
}: {
  requests: ScheduleRequest[];
  perspective: "designer" | "client";
  onUpdated?: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const visible = requests.filter(
    (r) =>
      r.status === "pending" ||
      r.status === "accepted" ||
      (perspective === "client" && r.status === "rejected"),
  );

  if (visible.length === 0) return null;

  const run = async (
    fn: () => Promise<unknown>,
    okTitle: string,
    okDesc?: string,
  ) => {
    try {
      await fn();
      push({ title: okTitle, description: okDesc, variant: "success" });
      onUpdated?.();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {visible.map((req) => (
        <Card
          key={req.id}
          className={
            req.status === "pending"
              ? "border-blue-200 bg-blue-50/50 p-5"
              : req.status === "accepted"
                ? "border-emerald-200 bg-emerald-50/50 p-5"
                : "border-rose-200 bg-rose-50/50 p-5"
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{req.title}</span>
                <Badge
                  variant={
                    req.status === "pending"
                      ? "blue"
                      : req.status === "accepted"
                        ? "emerald"
                        : "rose"
                  }
                >
                  {req.status === "pending"
                    ? "待确认档期"
                    : req.status === "accepted"
                      ? "已确认"
                      : "已拒绝"}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-ink-60">
                订单 {req.orderId} ·{" "}
                {req.serviceMode === "online" ? "纯线上" : "线下上门"} ·{" "}
                {formatCurrency(req.totalAmount)}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/80 bg-white/70 p-3 text-sm">
            <div className="text-xs text-ink-40">申请档期</div>
            <div className="mt-1 font-medium text-ink">
              {req.billingMode === "monthly" && req.selectedMonths?.length
                ? formatSelectedMonthsSummary(req.selectedMonths)
                : formatSelectedSlotsSummary(req.slots)}
            </div>
            {req.address ? (
              <div className="mt-2 text-xs text-ink-60">上门地址：{req.address}</div>
            ) : null}
            {req.status === "rejected" && req.rejectReason ? (
              <div className="mt-2 text-xs text-rose-700">
                拒绝原因：{req.rejectReason}
              </div>
            ) : null}
          </div>

          {req.status === "pending" && perspective === "designer" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="brand"
                onClick={() =>
                  run(
                    () => acceptOrderRequest(req.orderId),
                    "档期已确认",
                    `订单将进入合同签署流程。`,
                  )
                }
              >
                <Check className="h-3.5 w-3.5" /> 确认档期
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run(
                    () =>
                      rejectOrderScheduleRequest(
                        req.orderId,
                        "档期冲突，请重新选择",
                      ),
                    "已拒绝档期申请",
                    "委托人将收到通知。",
                  )
                }
              >
                <X className="h-3.5 w-3.5" /> 拒绝
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
