"use client";

import Link from "next/link";
import type { Order } from "@/lib/types";
import type { OrderPaymentOverdueInfo } from "@/lib/order-payment-overdue";
import { getPayablePendingStage } from "@/lib/order-payment-overdue";
import { getPendingReviewStage } from "@/lib/client-order-focus";
import { DESIGNER_ORDER_STATUS_LABEL } from "@/lib/designer-order-status-filter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { OrderStatusBadge, SpecialtyBadge } from "./status-badges";
import { ArrowRight, Coins, MapPin, User2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDesigners, useClients } from "@/lib/use-data";

interface Props {
  order: Order;
  href: string;
  perspective: "client" | "designer";
  tags?: string[];
  paymentOverdue?: OrderPaymentOverdueInfo | null;
  /** 待支付筛选下的高亮展示 */
  paymentHighlight?: boolean;
  /** 待成果确认筛选下的高亮展示 */
  reviewHighlight?: boolean;
}

export function OrderRow({
  order,
  href,
  perspective,
  tags,
  paymentOverdue,
  paymentHighlight = false,
  reviewHighlight = false,
}: Props) {
  const { data: designers } = useDesigners();
  const { data: clients } = useClients();
  const designer = designers.find((d) => d.id === order.designerId);
  const client = clients.find((c) => c.id === order.clientId);
  const counterparty = perspective === "client" ? designer : client;

  const paid = order.stages.filter((s) => s.status !== "pending");
  const paidAmount = paid.reduce((sum, s) => sum + s.amount, 0);
  const progress = order.totalAmount
    ? Math.round((paidAmount / order.totalAmount) * 100)
    : 0;

  const payable =
    perspective === "client" && paymentHighlight
      ? getPayablePendingStage(order)
      : null;

  const reviewStage =
    perspective === "client" && reviewHighlight
      ? getPendingReviewStage(order)
      : null;

  return (
    <Card
      className={cn(
        "p-5 transition-all hover:border-ink hover:shadow-md",
        paymentHighlight &&
          payable &&
          "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 ring-1 ring-amber-200/60 hover:border-amber-400",
        reviewHighlight &&
          reviewStage &&
          "border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50/80 ring-1 ring-blue-200/60 hover:border-blue-400",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SpecialtyBadge specialty={order.specialty} />
            <OrderStatusBadge
              status={order.status}
              label={
                perspective === "designer"
                  ? DESIGNER_ORDER_STATUS_LABEL[order.status]
                  : undefined
              }
            />
            {paymentHighlight && payable ? (
              <Badge variant="amber" className="text-[10px]">
                待支付
              </Badge>
            ) : null}
            {reviewHighlight && reviewStage ? (
              <Badge variant="blue" className="text-[10px]">
                待成果确认
              </Badge>
            ) : null}
            {paymentOverdue ? (
              <Badge variant="rose" className="text-[10px]">
                超时未付 {paymentOverdue.overdueDays} 天
              </Badge>
            ) : null}
            {(tags ?? []).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
            <ProjectIdCopy code={order.code} compact />
          </div>
          <Link href={href} className="block">
            <h3 className="text-base font-semibold leading-snug text-ink hover:text-brand">
              {order.title}
            </h3>
          </Link>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-60">
            <span className="inline-flex items-center gap-1.5">
              <User2 className="h-3.5 w-3.5" />
              {counterparty?.name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" />
              {formatCurrency(order.totalAmount)} ·
              {order.billingMode === "area"
                ? "常规面积报价"
                : order.billingMode === "daily"
                  ? "按工时"
                  : "按月雇佣"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {order.serviceMode === "onsite" ? "线下上门" : "线上远程"}
            </span>
            <span>下单 {formatDate(order.createdAt)}</span>
            {paymentOverdue ? (
              <span className="text-rose-600">
                {paymentOverdue.stage.name} · 应付{" "}
                {formatCurrency(paymentOverdue.stage.amount)} · 已超时{" "}
                {paymentOverdue.overdueDays} 天
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-48 flex-col items-end gap-2">
          {reviewHighlight && reviewStage ? (
            <div className="w-full rounded-xl border border-blue-200/80 bg-white/80 p-3 text-right">
              <div className="text-[10px] text-blue-800">待确认阶段</div>
              <div className="mt-0.5 text-sm font-semibold text-blue-950">
                {reviewStage.name}
              </div>
              {(reviewStage.deliverables?.length ?? 0) > 0 ? (
                <div className="mt-1 text-xs text-ink-60">
                  已上传 {reviewStage.deliverables!.length} 份成果
                </div>
              ) : null}
              <Link
                href={href}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                确认成果 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : paymentHighlight && payable ? (
            <div className="w-full rounded-xl border border-amber-200/80 bg-white/80 p-3 text-right">
              <div className="text-[10px] text-amber-800">待付款项</div>
              <div className="mt-0.5 text-sm font-semibold text-amber-950">
                {payable.stage.name}
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-brand">
                {formatCurrency(payable.stage.amount)}
              </div>
              <Link
                href={href}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90"
              >
                立即支付 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <div className="w-full">
                <div className="mb-1 flex justify-between text-xs text-ink-60">
                  <span>付款进度</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-20/60">
                  <div
                    className="h-full rounded-full bg-ink"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:gap-2 transition-all"
              >
                查看详情 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
