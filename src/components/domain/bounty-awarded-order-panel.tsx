"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Designer, Order } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageTimeline } from "@/components/domain/stage-timeline";
import { StagePaymentDialog } from "@/components/domain/stage-payment-dialog";
import { OrderStatusBadge } from "@/components/domain/status-badges";
import {
  confirmStageDeliverablesRequest,
  releaseStageRequest,
  requestStageRevisionRequest,
} from "@/lib/api-client";
import { isStageClientPaid } from "@/lib/client-review";
import { resolveDeliverablePhase } from "@/lib/deliverable-phase";
import {
  canViewSignedContract,
  contractPageHref,
  isContractFullySigned,
  isOrderCancelled,
  needsClientSign,
} from "@/lib/order-lifecycle";
import { getStagePaymentDeadline } from "@/lib/order-payment-overdue";
import { useSessionStore } from "@/store/session-store";
import { formatCurrency } from "@/lib/utils";
import { FileSignature, ExternalLink } from "lucide-react";

function paidAmountOf(order: Order) {
  return order.stages
    .filter(isStageClientPaid)
    .reduce((sum, stage) => sum + stage.amount, 0);
}

export function BountyAwardedOrderPanel({
  order,
  getDesigner,
  onRefresh,
}: {
  order: Order;
  getDesigner: (id: string) => Designer | undefined;
  onRefresh: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [busy, setBusy] = useState(false);
  const [payTarget, setPayTarget] = useState<{
    stageId: string;
    name: string;
    amount: number;
  } | null>(null);

  const cancelled = isOrderCancelled(order);
  const signed = isContractFullySigned(order);
  const paid = paidAmountOf(order);
  const pending = Math.max(0, order.totalAmount - paid);

  const runAction = async (fn: () => Promise<unknown>, success: string, detail?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      push({ title: success, description: detail, variant: "success" });
      onRefresh();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const amountRows = useMemo(
    () => [
      { label: "项目金额", value: formatCurrency(order.totalAmount), emphasize: true },
      { label: "已付（含托管）", value: formatCurrency(paid) },
      { label: "待付", value: formatCurrency(pending) },
    ],
    [order.totalAmount, paid, pending],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            付款阶段与设计成果
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            选定设计师后按平台订单履约：预览成果、按阶段付款、确认后解锁下载。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/client/orders/${order.id}`}>
            <ExternalLink className="h-3.5 w-3.5" /> 打开平台订单
          </Link>
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge order={order} />
          <span className="text-xs text-ink-40">{order.code}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {amountRows.map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-ink-20 bg-ink-20/20 px-4 py-3"
            >
              <div className="text-[11px] text-ink-60">{row.label}</div>
              <div
                className={
                  row.emphasize
                    ? "mt-1 text-xl font-bold text-brand"
                    : "mt-1 text-lg font-semibold text-ink"
                }
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-20 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-ink-60">
            <FileSignature className="mt-0.5 h-4 w-4 text-brand" />
            <div>
              <div className="font-medium text-ink">
                {order.contractId || "电子合同尚未生成"}
              </div>
              <div className="text-xs">
                {signed
                  ? "双方已签约，可按阶段支付并查看成果。"
                  : needsClientSign(order)
                    ? "请先签署电子合同，设计师签约后即可支付预付款。"
                    : order.designerSignedContract
                      ? "设计师已签约，等待你签署。"
                      : "已生成订单，等待双方签署电子合同。"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {needsClientSign(order) && !cancelled ? (
              <Button asChild variant="brand" size="sm">
                <Link href={contractPageHref(order)}>签署电子合同</Link>
              </Button>
            ) : canViewSignedContract(order, "client") ? (
              <Button asChild variant="outline" size="sm">
                <Link href={contractPageHref(order)}>在线查阅合同</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        {cancelled ? (
          <p className="text-sm text-ink-60">该订单已取消，付款与成果仅供查阅。</p>
        ) : (
          <>
            <p className="mb-5 text-sm text-ink-60">
              设计师上传成果后可在线免费预览。确认满意并完成该阶段付款后解锁下载。
            </p>
            <StageTimeline
              order={order}
              perspective="client"
              getDesigner={getDesigner}
              collaboratorMode="client"
              onPay={(stage) =>
                setPayTarget({
                  stageId: stage.id,
                  name: stage.name,
                  amount: stage.amount,
                })
              }
              onStageComplete={(stage) =>
                runAction(
                  () => releaseStageRequest(order.id, stage.id),
                  `${stage.name}已确认验收，款项已解冻`,
                )
              }
              onConfirmDeliverables={(stage) => {
                const phase = resolveDeliverablePhase(stage, order.status);
                runAction(
                  () => confirmStageDeliverablesRequest(order.id, stage.id),
                  phase === "preliminary" ? "已确认初步成果" : "已确认最终成果",
                  phase === "preliminary"
                    ? "请等待设计师上传最终成果 / 确认单。"
                    : undefined,
                );
              }}
              onRevise={(stage) =>
                runAction(
                  () => requestStageRevisionRequest(order.id, stage.id),
                  "已提交返修需求，设计师将优先处理",
                )
              }
            />
          </>
        )}
      </Card>

      {!cancelled && payTarget ? (
        <StagePaymentDialog
          open={!!payTarget}
          onOpenChange={(open) => {
            if (!open) setPayTarget(null);
          }}
          orderId={order.id}
          stageId={payTarget.stageId}
          stageName={payTarget.name}
          amount={payTarget.amount}
          deadline={
            order.stages.find((stage) => stage.id === payTarget.stageId)
              ? getStagePaymentDeadline(
                  order,
                  order.stages.find((stage) => stage.id === payTarget.stageId)!,
                )
              : undefined
          }
          onPaid={() => {
            push({
              title: `${payTarget.name}支付成功，资金已托管`,
              variant: "success",
            });
            setPayTarget(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}
