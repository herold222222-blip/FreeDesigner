"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Designer, Order } from "@/lib/types";
import { confirmCsQuoteRequest } from "@/lib/api-client";
import { invalidateApiPath } from "@/lib/use-data";
import { listOrderTrackDesignerCounts } from "@/lib/client-quote-match";
import {
  isRegularAreaHardscape,
  withAreaHardscapeRemark,
} from "@/lib/regular-entrust-quote";
import { needsCsQuoteConfirm } from "@/lib/order-supervision";
import { useSessionStore } from "@/store/session-store";
import { CheckCircle2, Users } from "lucide-react";

export function AdminCsQuoteReviewPanel({
  order,
  designers,
  onUpdated,
}: {
  order: Order;
  designers: Designer[];
  onUpdated: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [busy, setBusy] = useState(false);
  const hasQuotes = Boolean(order.levelQuotes?.length || order.quote);
  const awaiting = needsCsQuoteConfirm(order);

  const tracks = useMemo(
    () => listOrderTrackDesignerCounts(designers, order),
    [designers, order],
  );

  if (order.status !== "pending_quote" || !hasQuotes) return null;

  const handleConfirm = async () => {
    if (busy || !awaiting) return;
    setBusy(true);
    try {
      await confirmCsQuoteRequest(order.id);
      invalidateApiPath("/api/orders");
      push({
        title: "已开放委托人选卡",
        description: "委托人将收到「报价已更新」通知，可查看报价卡并匹配设计师。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: "确认失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">客服确认</div>
          <p className="mt-1 text-xs text-ink-60">
            请核对项目信息与附件。确认后委托人方可选择等级报价卡并匹配设计师。
          </p>
        </div>
        {awaiting ? (
          <Badge variant="amber">待二次确认</Badge>
        ) : (
          <Badge variant="emerald">已开放选卡</Badge>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-40">
          各三级专业符合条件设计师
        </div>
        <div className="space-y-2">
          {tracks.map((track) => (
            <div
              key={track.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {withAreaHardscapeRemark(
                    track.l3Label || "项目服务",
                    isRegularAreaHardscape({
                      billingMode: order.billingMode,
                      l3: track.l3,
                    }),
                  )}
                </div>
                {track.l2Label ? (
                  <div className="mt-0.5 text-[11px] text-ink-40">
                    {track.l2Label}
                    {track.quantityHint ? ` · ${track.quantityHint}` : ""}
                  </div>
                ) : null}
              </div>
              <div
                className={`flex shrink-0 items-center gap-1.5 text-sm tabular-nums ${
                  track.eligibleCount > 0 ? "text-ink" : "text-ink-40"
                }`}
              >
                <Users className="h-3.5 w-3.5 text-ink-40" />
                <span className="font-semibold">{track.eligibleCount}</span>
                <span className="text-xs text-ink-40">人</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-40">
          统计口径：已开启接单、专业与项目类型匹配、覆盖该三级专业。不含等级报价卡筛选。
        </p>
      </div>

      {awaiting ? (
        <Button variant="brand" disabled={busy} onClick={handleConfirm}>
          <CheckCircle2 className="h-4 w-4" />
          {busy ? "确认中..." : "确认报价，开放委托人选卡"}
        </Button>
      ) : (
        <p className="text-xs text-ink-60">
          已于{" "}
          {order.csQuoteConfirmedAt
            ? new Date(order.csQuoteConfirmedAt).toLocaleString("zh-CN")
            : "—"}{" "}
          确认，委托人可选择报价卡并匹配设计师。
        </p>
      )}
    </Card>
  );
}
