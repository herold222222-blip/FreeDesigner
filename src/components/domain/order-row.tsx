"use client";

import { useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/types";
import type { OrderPaymentOverdueInfo } from "@/lib/order-payment-overdue";
import {
  getPayablePendingStage,
  getPayableStageDeadline,
} from "@/lib/order-payment-overdue";
import {
  PaymentDeadlineBadge,
  PaymentDeadlineNote,
} from "@/components/domain/payment-deadline-note";
import { getPendingReviewStage } from "@/lib/client-order-focus";
import { DESIGNER_ORDER_STATUS_LABEL } from "@/lib/designer-order-status-filter";
import { resolveDisplayOrderStatus } from "@/lib/order-lifecycle";
import { getOrderPaymentProgress, needsClientReview, isAwaitingClientReviewOrder } from "@/lib/client-review";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import {
  MatchingOrderEditDialog,
  type MatchingOrderEditPayload,
} from "@/components/domain/matching-order-edit-dialog";
import {
  AwaitingClientPaymentBadge,
  OrderStatusBadge,
  SpecialtyBadge,
} from "./status-badges";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Coins,
  MapPin,
  Pencil,
  User2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  cancelOrderRequest,
  updateMatchingOrderRequest,
} from "@/lib/api-client";
import { invalidateApiPath, useDesigners, useClients } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { OrderDeleteButton } from "@/components/domain/order-delete-button";
import {
  clientCanEditEntrust,
  isAwaitingClientPaymentOrder,
} from "@/lib/order-supervision";

interface Props {
  order: Order;
  href: string;
  perspective: "client" | "designer" | "admin";
  tags?: string[];
  paymentOverdue?: OrderPaymentOverdueInfo | null;
  /** 待支付筛选下的高亮展示 */
  paymentHighlight?: boolean;
  /** 待成果确认筛选下的高亮展示 */
  reviewHighlight?: boolean;
  /** 待评价 / 待委托人评价筛选下的高亮展示 */
  clientReviewHighlight?: boolean;
}

const ADMIN_CANCELLABLE = new Set(["pending_quote", "matching"]);

export function OrderRow({
  order,
  href,
  perspective,
  tags,
  paymentOverdue,
  paymentHighlight = false,
  reviewHighlight = false,
  clientReviewHighlight = false,
}: Props) {
  const { data: designers } = useDesigners();
  const { data: clients } = useClients();
  const push = useSessionStore((s) => s.pushNotification);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const designer = designers.find((d) => d.id === order.designerId);
  const client = clients.find((c) => c.id === order.clientId);
  const counterparty =
    perspective === "designer"
      ? client
      : perspective === "admin"
        ? client
        : designer;
  const canEditEntrust =
    perspective === "client" && clientCanEditEntrust(order);
  const canAdminCancel =
    perspective === "admin" && ADMIN_CANCELLABLE.has(order.status);
  const needsQuoteConfirm =
    perspective === "client" && order.status === "pending_quote" && !!order.quote;

  const handleSaveMatching = async (payload: MatchingOrderEditPayload) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateMatchingOrderRequest(order.id, payload);
      push({ title: "委托信息已更新", variant: "success" });
      setEditOpen(false);
      invalidateApiPath("/api/orders");
      invalidateApiPath(`/api/orders/${order.id}`);
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAdminCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelOrderRequest(order.id, cancelReason.trim() || undefined);
      push({
        title: "订单已取消",
        description: "已通知委托人，订单已归入已取消列表。",
        variant: "success",
      });
      setCancelOpen(false);
      setCancelReason("");
      invalidateApiPath("/api/orders");
      invalidateApiPath(`/api/orders/${order.id}`);
    } catch (e) {
      push({
        title: "取消失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const progress = getOrderPaymentProgress(order);

  const payable =
    perspective === "client" && paymentHighlight
      ? getPayablePendingStage(order)
      : null;

  const paymentDeadline = isAwaitingClientPaymentOrder(order)
    ? getPayableStageDeadline(order)
    : null;

  const reviewStage =
    perspective === "client" && reviewHighlight
      ? getPendingReviewStage(order)
      : null;

  return (
    <Card
      className={cn(
        "p-5 transition-all hover:border-ink hover:shadow-md",
        needsQuoteConfirm &&
          "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 ring-1 ring-amber-200/60 hover:border-amber-400",
        paymentHighlight &&
          payable &&
          "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 ring-1 ring-amber-200/60 hover:border-amber-400",
        reviewHighlight &&
          reviewStage &&
          "border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50/80 ring-1 ring-blue-200/60 hover:border-blue-400",
        clientReviewHighlight &&
          "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50/80 ring-1 ring-amber-200/60 hover:border-amber-400",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SpecialtyBadge specialty={order.specialty} />
            <OrderStatusBadge
              order={order}
              status={resolveDisplayOrderStatus(order)}
              label={
                perspective === "designer"
                  ? DESIGNER_ORDER_STATUS_LABEL[resolveDisplayOrderStatus(order)]
                  : undefined
              }
            />
            {isAwaitingClientPaymentOrder(order) ? (
              <AwaitingClientPaymentBadge perspective={perspective} />
            ) : null}
            {perspective === "client" && needsClientReview(order) ? (
              <Badge variant="brand" className="text-[10px]">
                待评价
              </Badge>
            ) : null}
            {perspective === "admin" && isAwaitingClientReviewOrder(order) ? (
              <Badge variant="brand" className="text-[10px]">
                待委托人评价
              </Badge>
            ) : null}
            {reviewHighlight && reviewStage ? (
              <Badge variant="blue" className="text-[10px]">
                待成果确认
              </Badge>
            ) : null}
            {paymentDeadline ? (
              <PaymentDeadlineBadge deadline={paymentDeadline} />
            ) : paymentOverdue ? (
              <Badge variant="rose" className="text-[10px]">
                支付超时 · 已超过 {paymentOverdue.overdueLabel ?? `${paymentOverdue.overdueDays} 天`}
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
            {paymentDeadline ? (
              <span className={paymentDeadline.overdue ? "text-rose-600" : "text-amber-800"}>
                {paymentDeadline.stage.name} ·{" "}
                {paymentDeadline.overdue
                  ? `支付超时 · 已超过 ${paymentDeadline.overdueLabel}`
                  : `支付时限 ${formatDate(paymentDeadline.dueAt)}`}
              </span>
            ) : paymentOverdue ? (
              <span className="text-rose-600">
                {paymentOverdue.stage.name} · 应付{" "}
                {formatCurrency(paymentOverdue.stage.amount)} · 支付超时 · 已超过{" "}
                {paymentOverdue.overdueLabel ?? `${paymentOverdue.overdueDays} 天`}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-48 flex-col items-end gap-2">
          {needsQuoteConfirm ? (
            <div className="w-full rounded-xl border border-amber-200/80 bg-white/80 p-3 text-right">
              <div className="text-[10px] text-amber-800">待确认报价</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-brand">
                {formatCurrency(order.quote!.total)}
              </div>
              <Link
                href={href}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90"
              >
                确认报价 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : reviewHighlight && reviewStage ? (
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
              {paymentDeadline ? (
                <div className="mt-2 text-left">
                  <PaymentDeadlineNote deadline={paymentDeadline} />
                </div>
              ) : null}
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canEditEntrust ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2.5 text-xs"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> 修改
                  </Button>
                ) : null}
                {canAdminCancel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    disabled={cancelling}
                    onClick={() => setCancelOpen(true)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    取消订单
                  </Button>
                ) : null}
                <OrderDeleteButton
                  order={order}
                  perspective={perspective}
                />
                <Link
                  href={href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:gap-2 transition-all"
                >
                  查看详情 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
      {canEditEntrust ? (
        <MatchingOrderEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          order={order}
          onSave={handleSaveMatching}
          saving={saving}
        />
      ) : null}
      {canAdminCancel ? (
        <Dialog
          open={cancelOpen}
          onOpenChange={(open) => {
            if (cancelling) return;
            setCancelOpen(open);
            if (!open) setCancelReason("");
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <span className="pt-1">确认取消订单？</span>
              </DialogTitle>
              <DialogDescription className="pl-[2.625rem] text-sm leading-relaxed text-ink-60">
                即将取消「{order.title}」（{order.code}
                ）。取消后将通知委托人，订单归入已取消列表，此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 pl-[2.625rem]">
              <Label htmlFor={`cancel-reason-${order.id}`}>
                取消原因（选填）
              </Label>
              <Textarea
                id={`cancel-reason-${order.id}`}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="可填写原因，将一并通知委托人"
                rows={3}
                disabled={cancelling}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={() => setCancelOpen(false)}
              >
                返回
              </Button>
              <Button
                type="button"
                variant="brand"
                className="bg-rose-600 hover:bg-rose-700"
                disabled={cancelling}
                onClick={handleAdminCancel}
              >
                {cancelling ? "取消中..." : "确认取消"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
