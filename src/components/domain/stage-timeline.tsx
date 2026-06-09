"use client";

import * as React from "react";
import Link from "next/link";
import type { Designer, Order, PaymentStage } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StagePaymentSplitsPanel } from "@/components/domain/stage-payment-splits";
import { StageCollaboratorPanel } from "@/components/domain/stage-collaborator-panel";
import { StageTrackAcceptancePanel } from "@/components/domain/stage-track-acceptance";
import { resolveStagePaymentSplits } from "@/lib/stage-payment-splits";
import {
  canDesignerRequestWithdraw,
  designerInvolvedInStage,
  DESIGNER_STAGE_PAYMENT_META,
  getDesignerGrossForStage,
  getDesignerNetAmount,
  getDesignerOwnDeliverables,
  getDesignerStagePaymentStatus,
} from "@/lib/designer-order-scope";
import { getServiceProviderById } from "@/mocks/service-providers";
import { ForwardPaymentLinkDialog } from "@/components/domain/forward-payment-link-dialog";
import {
  ArrowDownToLine,
  Check,
  CircleDollarSign,
  Download,
  FileBox,
  Share2,
  Upload,
} from "lucide-react";
import { MONTHLY_BILLING_RULE, formatMonthlyDueHint } from "@/lib/monthly-billing";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";
import { isContractFullySigned } from "@/lib/order-lifecycle";

const STAGE_STATUS_META: Record<
  PaymentStage["status"],
  { label: string; tone: string }
> = {
  pending: { label: "待付款", tone: "bg-ink-20/40 text-ink" },
  paid: { label: "已付款", tone: "bg-blue-100 text-blue-800" },
  frozen: { label: "已托管 · 验收期", tone: "bg-violet-100 text-violet-800" },
  released: { label: "已结算", tone: "bg-emerald-100 text-emerald-800" },
};

export function StageTimeline({
  order,
  perspective,
  getDesigner,
  collaboratorMode,
  currentDesignerId,
  onPay,
  onStageComplete,
  onRevise,
  onUploadDeliverables,
}: {
  order: Order;
  perspective: "client" | "designer" | "admin";
  getDesigner?: (id: string) => Designer | undefined;
  /** 是否展示配合设计师区块 */
  collaboratorMode?: "client" | "designer" | "none";
  currentDesignerId?: string;
  onPay?: (stage: PaymentStage) => void;
  onStageComplete?: (stage: PaymentStage) => void;
  onRevise?: (stage: PaymentStage) => void;
  onUploadDeliverables?: (stage: PaymentStage) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [forwardPayStage, setForwardPayStage] =
    React.useState<PaymentStage | null>(null);
  const isClientView = perspective === "client" || perspective === "admin";
  const isDesignerView = perspective === "designer" && !!currentDesignerId;

  const visibleStages =
    isDesignerView ?
      order.stages.filter((s) =>
        designerInvolvedInStage(order, s, currentDesignerId!),
      )
    : order.stages;

  const handlePay = (stage: PaymentStage) => {
    if (onPay) {
      onPay(stage);
      return;
    }
    push({
      title: `支付成功 · ${formatCurrency(stage.amount)}`,
      description: `资金已托管,设计师可继续推进。验收无误后自动解冻。`,
      variant: "success",
    });
  };

  const handleConfirm = (stage: PaymentStage) => {
    if (onStageComplete) {
      onStageComplete(stage);
      return;
    }
    push({
      title: `已确认成果 · 解锁下载`,
      description: `本阶段款 ${formatCurrency(stage.amount)} 进入设计师托管账户。`,
      variant: "success",
    });
  };

  const handleTrackAccepted = (trackLabel: string) => {
    push({
      title: `「${trackLabel}」已验收`,
      description: "该专业成果已解锁下载。",
      variant: "success",
    });
  };

  const handleRevise = (stage: PaymentStage) => {
    if (onRevise) {
      onRevise(stage);
      return;
    }
    push({
      title: "已提交返修需求",
      description: "设计师将收到通知并优先处理。",
    });
  };

  if (isDesignerView && visibleStages.length === 0) {
    return (
      <p className="text-sm text-ink-60">
        当前订单暂无与你专业相关的付款阶段。
      </p>
    );
  }

  const isMonthlyOrder = order.billingMode === "monthly";

  return (
    <div className="space-y-5">
      {isMonthlyOrder && isClientView ? (
        <p className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 text-xs leading-relaxed text-violet-900">
          {MONTHLY_BILLING_RULE}
        </p>
      ) : null}
      {visibleStages.map((stage, i) => {
        const meta = STAGE_STATUS_META[stage.status];
        const designerPayStatus =
          isDesignerView ? getDesignerStagePaymentStatus(stage) : null;
        const designerPayMeta =
          designerPayStatus ?
            DESIGNER_STAGE_PAYMENT_META[designerPayStatus]
          : null;
        const designerGross =
          isDesignerView ?
            getDesignerGrossForStage(order, stage, currentDesignerId!)
          : 0;
        const designerNet =
          isDesignerView ?
            getDesignerNetAmount(designerGross, order.feeRate)
          : 0;
        const isPaid = stage.status !== "pending";
        const stageSplits =
          isClientView && getDesigner ?
            resolveStagePaymentSplits(order, stage)
          : [];
        const ownDeliverables =
          isDesignerView ?
            getDesignerOwnDeliverables(order, stage, currentDesignerId!)
          : (stage.deliverables ?? []);
        const showPayCTA =
          perspective === "client" &&
          stage.status === "pending" &&
          isContractFullySigned(order);
        const showForwardPayCTA =
          perspective === "admin" && stage.status === "pending";
        const showClientAcceptance =
          isClientView &&
          stage.status === "frozen" &&
          (stage.deliverables?.length ?? 0) > 0 &&
          !!getDesigner;
        const showUploadCTA =
          isDesignerView &&
          i > 0 &&
          stage.status === "pending" &&
          ["in_progress", "in_revision"].includes(order.status);
        const showWithdrawCTA =
          isDesignerView &&
          canDesignerRequestWithdraw(order, stage, currentDesignerId!);

        return (
          <Card key={stage.id} className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="flex flex-1 items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                    isPaid
                      ? "bg-ink text-white"
                      : "border border-ink-20 bg-white text-ink-60",
                  )}
                >
                  {isPaid ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-ink">
                      {stage.name}
                    </h4>
                    {isDesignerView && designerPayMeta ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          designerPayMeta.tone,
                        )}
                      >
                        {designerPayMeta.label}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                    )}
                    {!isDesignerView && !isMonthlyOrder ? (
                      <Badge variant="outline">
                        占比 {Math.round(stage.ratio * 100)}%
                      </Badge>
                    ) : null}
                    {!isDesignerView && isMonthlyOrder && i > 0 ? (
                      <Badge variant="outline">月费</Badge>
                    ) : null}
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-ink">
                    {isDesignerView ?
                      formatCurrency(designerNet)
                    : formatCurrency(stage.amount)}
                  </div>
                  {isDesignerView && designerGross > 0 ? (
                    <div className="text-xs text-ink-60">
                      应收 {formatCurrency(designerGross)} · 扣平台费{" "}
                      {Math.round((order.feeRate ?? 0.08) * 100)}% 后实收
                    </div>
                  ) : null}
                  {stage.paidAt ? (
                    <div className="text-xs text-ink-60">
                      付款时间 {formatDateTime(stage.paidAt)}
                    </div>
                  ) : null}
                  {stage.releasedAt ? (
                    <div className="text-xs text-emerald-700">
                      结算时间 {formatDateTime(stage.releasedAt)}
                    </div>
                  ) : null}
                  {isMonthlyOrder && stage.dueAt && stage.status === "pending" ? (
                    <div className="text-xs text-amber-700">
                      {formatMonthlyDueHint(stage)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showPayCTA ? (
                  <Button variant="brand" onClick={() => handlePay(stage)}>
                    <CircleDollarSign className="h-4 w-4" /> 立即支付
                  </Button>
                ) : null}
                {showForwardPayCTA ? (
                  <Button
                    variant="brand"
                    onClick={() => setForwardPayStage(stage)}
                  >
                    <Share2 className="h-4 w-4" /> 转发支付链接
                  </Button>
                ) : null}
                {showUploadCTA ? (
                  <Button
                    onClick={() => {
                      if (onUploadDeliverables) {
                        onUploadDeliverables(stage);
                        return;
                      }
                      push({
                        title: "成果文件已上传",
                        description: "委托人将收到验收提醒。",
                        variant: "success",
                      });
                    }}
                  >
                    <Upload className="h-4 w-4" /> 上传本阶段成果
                  </Button>
                ) : null}
                {showWithdrawCTA ? (
                  <Button variant="outline" asChild>
                    <Link href="/designer/wallet">
                      <ArrowDownToLine className="h-4 w-4" /> 申请提现
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {showClientAcceptance ? (
              <StageTrackAcceptancePanel
                order={order}
                stage={stage}
                getDesigner={getDesigner}
                onPreview={() =>
                  push({ title: "已打开成果预览", description: "可免费在线浏览" })
                }
                onRevise={() => handleRevise(stage)}
                onStageComplete={() => handleConfirm(stage)}
                onTrackAccepted={handleTrackAccepted}
              />
            ) : null}

            {isDesignerView && ownDeliverables.length > 0 ? (
              <div className="border-t border-ink-20 bg-ink-20/20 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-60">
                  <FileBox className="h-3.5 w-3.5" /> 我的本阶段成果
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {ownDeliverables.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-xl border border-ink-20 bg-white p-3"
                    >
                      {file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink-20">
                          <FileBox className="h-5 w-5 text-ink-60" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {file.name}
                        </div>
                        <div className="text-xs text-ink-60">
                          {file.size} · {formatDateTime(file.uploadedAt)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          push({
                            title: "下载已开始",
                            description: file.name,
                          })
                        }
                      >
                        <Download className="h-4 w-4" /> 下载
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {isClientView &&
            stage.status !== "frozen" &&
            (stage.deliverables?.length ?? 0) > 0 &&
            getDesigner ? (
              <div className="border-t border-ink-20 bg-ink-20/20 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-60">
                  <FileBox className="h-3.5 w-3.5" /> 阶段成果文件
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {stage.deliverables!.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-xl border border-ink-20 bg-white p-3"
                    >
                      {file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink-20">
                          <FileBox className="h-5 w-5 text-ink-60" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink">
                          {file.name}
                        </div>
                        <div className="text-xs text-ink-60">
                          {file.size} · {formatDateTime(file.uploadedAt)}
                          {file.designerId ?
                            ` · ${getDesigner(file.designerId)?.name ?? "设计师"}`
                          : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          push({
                            title: "下载已开始",
                            description: file.name,
                          })
                        }
                      >
                        <Download className="h-4 w-4" /> 下载
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {isClientView && getDesigner && stageSplits.length > 0 ? (
              <StagePaymentSplitsPanel
                stage={stage}
                splits={stageSplits}
                getDesigner={getDesigner}
                getServiceProvider={getServiceProviderById}
              />
            ) : null}

            {getDesigner &&
            collaboratorMode &&
            collaboratorMode !== "none" ? (
              <StageCollaboratorPanel
                order={order}
                stage={stage}
                getDesigner={getDesigner}
                mode={collaboratorMode}
                currentDesignerId={currentDesignerId}
              />
            ) : null}
          </Card>
        );
      })}

      {forwardPayStage ? (
        <ForwardPaymentLinkDialog
          open={!!forwardPayStage}
          onOpenChange={(open) => {
            if (!open) setForwardPayStage(null);
          }}
          order={order}
          stage={forwardPayStage}
        />
      ) : null}
    </div>
  );
}
