"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  OrderEntrustDescription,
  quoteLinesFromOrder,
} from "@/components/domain/order-entrust-description";
import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import { ScanOrderInfoEditDialog } from "@/components/domain/scan-order-info-edit-dialog";
import {
  AwaitingClientPaymentBadge,
  OrderStatusBadge,
  SpecialtyBadge,
} from "@/components/domain/status-badges";
import { PaymentDeadlineBadge } from "@/components/domain/payment-deadline-note";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { proposeScanQuoteRequest } from "@/lib/api-client";
import { parseRegularEntrustDescription } from "@/lib/entrust-description";
import { isAwaitingClientPaymentOrder } from "@/lib/order-supervision";
import { getPayableStageDeadline } from "@/lib/order-payment-overdue";
import { orderExpectedDateLabel } from "@/lib/order-lifecycle";
import { designerNetFromGross } from "@/lib/designer-order-scope";
import {
  formatDirectedPlatformFeeLabel,
  orderTaxCoefficient,
  taxPointRateFromCoefficient,
} from "@/lib/directed-platform-fee";
import { defaultBountyPaymentStageDrafts } from "@/lib/bounty-payment-stages";
import {
  directedScanQuoteHasChanges,
  draftsFromOrderPaymentStages,
  parseScanClientReferenceAmount,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import { bountyTrackFromOrder } from "@/lib/order-assign-tracks";
import type { Order } from "@/lib/types";
import { cn, formatCurrency, formatOptionalDate } from "@/lib/utils";
import {
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Send,
} from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export function DesignerScanQuoteWorkspace({
  order,
  myNetEarnings,
  onUpdated,
  busy,
  setBusy,
}: {
  order: Order;
  myNetEarnings: number;
  onUpdated: () => void;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [infoEditOpen, setInfoEditOpen] = useState(false);
  const [stagesEditing, setStagesEditing] = useState(false);
  const clientReferenceAmount = useMemo(
    () => parseScanClientReferenceAmount(order.description),
    [order.description],
  );
  const parsedDesc = useMemo(
    () => parseRegularEntrustDescription(order.description),
    [order.description],
  );

  const [totalAmount, setTotalAmount] = useState(
    order.totalAmount > 0
      ? String(order.totalAmount)
      : clientReferenceAmount
        ? String(clientReferenceAmount)
        : "",
  );
  const [totalEditing, setTotalEditing] = useState(false);
  const totalInputRef = useRef<HTMLInputElement>(null);
  const [paymentStages, setPaymentStages] = useState<ScanPaymentStageDraft[]>(
    () =>
      draftsFromOrderPaymentStages(order.stages) ??
      defaultBountyPaymentStageDrafts(),
  );

  const amount = Math.round(Number(totalAmount) || 0);
  const liveNetEarnings =
    amount > 0 ? designerNetFromGross(order, amount) : myNetEarnings;
  const canSubmit = amount > 0 && paymentStagesValid(paymentStages);
  const hasChanges = directedScanQuoteHasChanges(order, amount, paymentStages);
  const paymentDeadline = getPayableStageDeadline(order);
  const clientCountered = order.scanQuoteLastActor === "client";

  const handlePropose = async () => {
    if (!canSubmit || busy) return;
    setBusy?.(true);
    try {
      await proposeScanQuoteRequest(order.id, {
        totalAmount: amount,
        stages: paymentStages.map((s) => ({
          name: s.name,
          ratio: s.ratio,
          note: s.note?.trim() || undefined,
        })),
      });
      push({
        title: hasChanges ? "费用方案已发送" : "已确认费用",
        description: hasChanges
          ? "已通知委托人确认修改后的费用、付款阶段与付款条件。"
          : "双方已确认费用，请签署电子合同。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: hasChanges ? "提交失败" : "确认失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy?.(false);
    }
  };

  return (
    <>
      <Card className="space-y-8 p-7">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-ink">项目信息</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInfoEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> 修改
            </Button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SpecialtyBadge specialty={order.specialty} />
                <OrderStatusBadge order={order} />
                {isAwaitingClientPaymentOrder(order) ? (
                  <AwaitingClientPaymentBadge perspective="designer" />
                ) : null}
                {paymentDeadline ? (
                  <PaymentDeadlineBadge deadline={paymentDeadline} />
                ) : null}
                <ProjectIdCopy code={order.code} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {order.title}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-60">我的预计实收</div>
              <div className="text-2xl font-semibold tracking-tight text-brand">
                {formatCurrency(liveNetEarnings)}
              </div>
              <div className="mt-1 text-xs text-ink-60">
                按确认费用扣除平台服务费（
                {formatDirectedPlatformFeeLabel(
                  taxPointRateFromCoefficient(orderTaxCoefficient(order)),
                )}
                ）后的预计实收
              </div>
            </div>
          </div>
          <OrderEntrustDescription
            description={order.description}
            quoteLines={quoteLinesFromOrder(order)}
            primaryTrack={bountyTrackFromOrder(order)}
          />
          <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
            <InfoField
              label="服务模式"
              value={order.serviceMode === "online" ? "纯线上" : "线下上门"}
              icon={MapPin}
            />
            <InfoField
              label="计费模式"
              value={
                order.billingMode === "area"
                  ? "按面积"
                  : order.billingMode === "daily"
                    ? "按工时"
                    : "按月雇佣"
              }
              icon={Clock}
            />
            <InfoField label="项目类型" value={order.projectType} />
            <InfoField
              label={orderExpectedDateLabel(order)}
              value={formatOptionalDate(order.expectedDeliveryAt)}
              icon={Calendar}
            />
          </div>
        </section>

        <Separator />

        <section className="rounded-2xl border-2 border-brand/25 bg-gradient-to-br from-brand/8 to-brand/3 p-6">
          <div className="text-xs font-medium uppercase tracking-wider text-brand">
            委托人参考价格
          </div>
          {clientReferenceAmount ? (
            <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-brand">
              {formatCurrency(clientReferenceAmount)}
            </div>
          ) : (
            <div className="mt-2 text-sm leading-relaxed text-ink-60">
              委托人未直填费用金额
              {parsedDesc.structured && parsedDesc.billing?.detailLines.length
                ? "，以下为按面积等项目信息，请按本人取费标准报价："
                : "，请根据项目信息与本人取费标准报价。"}
            </div>
          )}
          {parsedDesc.structured && parsedDesc.billing?.detailLines.length ? (
            <ul className="mt-3 space-y-1 text-xs text-ink-60">
              {parsedDesc.billing.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label htmlFor="designer-scan-total" className="text-base font-semibold text-ink">
                确认项目总费用
              </Label>
              <p className="mt-1 text-xs text-ink-60">
                {hasChanges
                  ? "修改后将发送给委托人再次确认。"
                  : "与对方提交的方案一致，确认后进入签约。"}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/designer/rates" target="_blank">
                <Calculator className="h-3.5 w-3.5" /> 我的取费标准
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={totalInputRef}
              id="designer-scan-total"
              type="number"
              min={1000}
              step={100}
              readOnly={!totalEditing}
              className={cn(
                "max-w-xs text-lg font-semibold tabular-nums",
                !totalEditing && "cursor-default bg-ink-20/30",
              )}
              value={totalAmount}
              onChange={(e) => {
                if (!totalEditing) return;
                setTotalAmount(e.target.value);
              }}
              placeholder="如 28000"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTotalEditing((v) => {
                  const next = !v;
                  if (next) {
                    requestAnimationFrame(() => totalInputRef.current?.focus());
                  }
                  return next;
                });
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              {totalEditing ? "完成修改" : "修改"}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                付款阶段方案
              </h2>
              <p className="mt-1 text-xs text-ink-60">
                {hasChanges
                  ? "可修改名称、比例与付款条件；发送后由委托人再次确认。"
                  : "未改动付款阶段与付款条件时，确认后进入签约。"}
              </p>
              {!stagesEditing ? <PaymentEscrowHint className="mt-1.5" /> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStagesEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {stagesEditing ? "完成修改" : "修改"}
            </Button>
          </div>

          {stagesEditing ? (
            <ScanPaymentStagesEditor
              stages={paymentStages}
              onChange={setPaymentStages}
              totalAmount={amount}
            />
          ) : (
            <ul className="space-y-2">
              {paymentStages.map((stage, i) => (
                <li
                  key={stage.id}
                  className="rounded-xl border border-ink-20 bg-ink-20/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {i + 1}. {stage.name} · {stage.ratio}%
                    </span>
                    {amount > 0 ? (
                      <span className="text-sm font-semibold tabular-nums text-brand">
                        {formatCurrency(Math.round((amount * stage.ratio) / 100))}
                      </span>
                    ) : null}
                  </div>
                  {stage.note ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-60">
                      {stage.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {clientCountered ? (
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-ink">
            委托人已修改费用或付款条款，请核对后确认；如需继续修改，将发回委托人再次确认。
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3 border-t border-ink-20 pt-6">
          <Button
            variant="brand"
            size="lg"
            disabled={!canSubmit || busy}
            onClick={handlePropose}
          >
            {hasChanges ? (
              <Send className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {busy
              ? hasChanges
                ? "发送中..."
                : "确认中..."
              : hasChanges
                ? "发送给委托人确认"
                : "确认费用"}
          </Button>
        </div>
      </Card>

      <ScanOrderInfoEditDialog
        open={infoEditOpen}
        onOpenChange={setInfoEditOpen}
        order={order}
        onSaved={onUpdated}
      />
    </>
  );
}

function InfoField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <div className="text-xs text-ink-40">{label}</div>
      <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
        {Icon ? <Icon className="h-3.5 w-3.5 text-ink-60" /> : null}
        {value}
      </div>
    </div>
  );
}
