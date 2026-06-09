"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { ORDER_STATUS_META } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QrCode } from "lucide-react";

export default function DesignerScanOrdersPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: orders, loading } = useOrders();
  const scanOrders = orders.filter(
    (o) => o.orderSource === "scan" && o.designerId === identityId,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            扫码下单
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            委托人扫码提交的需求，确认档期与付款阶段后进入签约流程。
          </p>
        </div>
        {identityId ? (
          <Button asChild variant="outline">
            <Link href={`/designers/${identityId}`}>
              <QrCode className="h-4 w-4" /> 个人主页 · 扫我下单
            </Link>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="py-16 text-center text-ink-60">加载中...</div>
      ) : scanOrders.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-60">
          暂无扫码订单。将个人主页二维码分享给委托人即可接单。
        </Card>
      ) : (
        <div className="space-y-3">
          {scanOrders.map((o) => {
            const meta = ORDER_STATUS_META[o.status];
            return (
              <Card key={o.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{o.title}</span>
                    <Badge variant="outline">{meta.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-ink-60">
                    {o.code} · {formatCurrency(o.totalAmount)} ·{" "}
                    {formatDate(o.createdAt)}
                  </div>
                </div>
                <Button asChild size="sm" variant="brand">
                  <Link href={`/designer/orders/${o.id}`}>查看详情</Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
