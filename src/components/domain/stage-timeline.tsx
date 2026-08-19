"use client";

import * as React from "react";
import Link from "next/link";
import type { DeliverableFile, Designer, Order, PaymentStage } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StagePaymentSplitsPanel } from "@/components/domain/stage-payment-splits";
import { StageCollaboratorPanel } from "@/components/domain/stage-collaborator-panel";
import { StageTrackAcceptancePanel } from "@/components/domain/stage-track-acceptance";
import { StageParticipantDeliverables } from "@/components/domain/stage-participant-deliverables";
import { getActivePaymentStageId, getStagePaymentDeadline } from "@/lib/order-payment-overdue";
import { PaymentDeadlineNote } from "@/components/domain/payment-deadline-note";
import { resolveStagePaymentSplits } from "@/lib/stage-payment-splits";
import {
  canDesignerRequestWithdraw,
  designerInvolvedInStage,
  DESIGNER_STAGE_PAYMENT_META,
  getDesignerReceivableForStage,
  getDesignerOwnDeliverables,
  getDesignerStagePaymentStatus,
} from "@/lib/designer-order-scope";
import { findServiceProvider } from "@/lib/service-provider-catalog";
import { useServiceProviders } from "@/lib/use-data";
import { ForwardPaymentLinkDialog } from "@/components/domain/forward-payment-link-dialog";
import { StageDeliverableUploadDialog } from "@/components/domain/stage-deliverable-upload-dialog";
import {
  ArrowDownToLine,
  Check,
  CircleDollarSign,
  Download,
  FileBox,
  Share2,
  Upload,
} from "lucide-react";
import { formatMonthlyDueHint } from "@/lib/monthly-billing";
import { OrderMonthlyServiceCalendar } from "@/components/domain/order-monthly-service-calendar";
import { DAILY_BILLING_RULE } from "@/lib/time-billing";
import {
  isPrepaymentStage,
  resolveOrderPaymentStages,
} from "@/lib/order-payment-stages";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";
import {
  isContractFullySigned,
  isOrderCancelled,
  orderHasLockedQuoteAmounts,
} from "@/lib/order-lifecycle";

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
  hideMonthlyCalendar,
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
  onUploadDeliverables?: (stage: PaymentStage, files: DeliverableFile[]) => void;
  /** 工作日历已在其它面板展示时隐藏，避免重复 */
  hideMonthlyCalendar?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: serviceProviders } = useServiceProviders();
  const getServiceProvider = (id: string) =>
    findServiceProvider(serviceProviders, id);
  const [forwardPayStage, setForwardPayStage] =
    React.useState<PaymentStage | null>(null);
  const [uploadStage, setUploadStage] = React.useState<PaymentStage | null>(null);
  const isClientView = perspective === "client" || perspective === "admin";
  const isDesignerView = perspective === "designer" && !!currentDesignerId;

  const paymentStages = resolveOrderPaymentStages(order);
  const visibleStages =
    isDesignerView ?
      paymentStages.filter((s) =>
        designerInvolvedInStage(order, s, currentDesignerId!),
      )
    : paymentStages;

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
  const isDailyOrder = order.billingMode === "daily";
  const contractSigned = isContractFullySigned(order);
  const amountsReady = contractSigned || orderHasLockedQuoteAmounts(order);
  /** 报价未锁定前只展示比例；匹配确认后展示金额，支付仍须签约 */
  const previewOnly = !amountsReady;
  const activeStageId = getActivePaymentStageId(order, visibleStages);
  const revising = order.status === "in_revision";

  return (
    <div className="space-y-5">
      {isMonthlyOrder && !hideMonthlyCalendar ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">按月工时日历</h3>
            <p className="mt-1 text-xs text-ink-60">
              红色为工作日服务（不含周末与法定节假日）；灰色为休息日；琥珀色「付」为支付节点（首月预付为开始服务日前 3 天，此后每月 25 日 17:00 前；遇周末或节假日提前至前一个工作日）。
            </p>
          </div>
          <OrderMonthlyServiceCalendar order={order} />
        </div>
      ) : null}
      {isDailyOrder && isClientView ? (
        <p className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 text-xs leading-relaxed text-violet-900">
          {DAILY_BILLING_RULE}
        </p>
      ) : null}
      {previewOnly && isClientView ? (
        <p className="text-xs text-ink-40">
          电子合同尚未签订，此处仅预览付款比例，不展示金额。双方签约后方可转发支付链接。
        </p>
      ) : null}
      {amountsReady && !contractSigned && isClientView ? (
        <p className="text-xs text-ink-40">
          报价已锁定，阶段金额按确认方案计算。双方完成电子签约后方可支付或转发支付链接。
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
        const designerReceivable =
          isDesignerView ?
            getDesignerReceivableForStage(order, stage, currentDesignerId!, {
              designer: getDesigner?.(currentDesignerId!),
              involvedStages: visibleStages,
            })
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
        const isActive = stage.id === activeStageId;
        const prior = i > 0 ? visibleStages[i - 1] : null;
        const priorHeld =
          !prior ||
          prior.status === "released" ||
          prior.status === "frozen" ||
          prior.status === "paid";
        const stageRevisions = (order.revisions ?? []).filter(
          (r) => r.stageId === stage.id,
        );
        const showPayCTA =
          perspective === "client" &&
          !isOrderCancelled(order) &&
          stage.status === "pending" &&
          isContractFullySigned(order) &&
          isActive;
        const showForwardPayCTA =
          perspective === "admin" &&
          !isOrderCancelled(order) &&
          stage.status === "pending" &&
          contractSigned &&
          isActive;
        const showForwardPayLocked =
          perspective === "admin" &&
          !isOrderCancelled(order) &&
          stage.status === "pending" &&
          !contractSigned &&
          isActive;
        const needsDeliverables = !isPrepaymentStage(order, stage);
        const paymentDeadline =
          stage.status === "pending"
            ? getStagePaymentDeadline(order, stage)
            : null;
        const showClientAcceptance =
          needsDeliverables &&
          isClientView &&
          !isOrderCancelled(order) &&
          stage.status === "frozen" &&
          (stage.deliverables?.length ?? 0) > 0 &&
          !!getDesigner;
        const showUploadCTA =
          needsDeliverables &&
          isDesignerView &&
          !isOrderCancelled(order) &&
          ["in_progress", "in_revision"].includes(order.status) &&
          ((isActive && (stage.status !== "pending" || revising)) ||
            (stage.status === "pending" && i > 0 && priorHeld) ||
            stage.status === "frozen" ||
            stage.status === "paid");
        const showWithdrawCTA =
          isDesignerView &&
          !isOrderCancelled(order) &&
          canDesignerRequestWithdraw(order, stage, currentDesignerId!);

        return (
          <Card
            key={stage.id}
            className={cn(
              "overflow-hidden transition-shadow",
              isActive &&
                "border-brand ring-2 ring-brand/20 shadow-md",
            )}
          >
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
                    {isActive ? (
                      <Badge variant="brand">当前阶段</Badge>
                    ) : null}
                    {isDesignerView && designerPayMeta && !previewOnly ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          designerPayMeta.tone,
                        )}
                      >
                        {designerPayMeta.label}
                      </span>
                    ) : previewOnly && !isPaid ? (
                      <span className="rounded-full bg-ink-20/40 px-2.5 py-0.5 text-xs font-medium text-ink">
                        预览
                      </span>
                    ) : isDesignerView && designerPayMeta ? (
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
                    {!isMonthlyOrder && !previewOnly ? (
                      <Badge variant="outline">
                        占比 {Math.round(stage.ratio * 100)}%
                      </Badge>
                    ) : null}
                    {!isDesignerView && isMonthlyOrder && i > 0 ? (
                      <Badge variant="outline">月费</Badge>
                    ) : null}
                  </div>
                  {previewOnly ? (
                    <div className="text-2xl font-semibold tracking-tight text-ink">
                      {Math.round(stage.ratio * 100)}%
                    </div>
                  ) : (
                    <div className="text-2xl font-semibold tracking-tight text-ink">
                      {isDesignerView ?
                        formatCurrency(designerReceivable)
                      : formatCurrency(stage.amount)}
                    </div>
                  )}
                  {!needsDeliverables && isClientView && !previewOnly ? (
                    <div className="text-xs text-ink-60">
                      签约后支付即可开工，预付款无需上传或确认成果。
                    </div>
                  ) : null}
                  {isDesignerView && !previewOnly && designerReceivable > 0 ? (
                    <div className="text-xs text-ink-60">
                      {needsDeliverables &&
                      isActive &&
                      (stage.status === "pending" ||
                        designerPayStatus === "client_pending")
                        ? "本阶段请设计师上传成果或确认单(图片/PDF)。委托人可确认后支付。"
                        : !needsDeliverables &&
                            isActive &&
                            stage.status === "pending"
                          ? "本阶段为预付款，无需上传或确认成果。等待委托人支付后即可开工。"
                          : "本专业基础服务费本阶段份额，不含平台管理费与税费"}
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
                  {needsDeliverables && stage.deliverablesConfirmedAt ? (
                    <div className="text-xs text-ink-40">
                      成果确认时间 {formatDateTime(stage.deliverablesConfirmedAt)}
                    </div>
                  ) : null}
                  {isMonthlyOrder && stage.dueAt && stage.status === "pending" && !paymentDeadline ? (
                    <div className="text-xs text-amber-700">
                      {formatMonthlyDueHint(stage)}
                    </div>
                  ) : null}
                  {paymentDeadline ? (
                    <PaymentDeadlineNote deadline={paymentDeadline} />
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
                {showForwardPayLocked ? (
                  <Button
                    variant="brand"
                    disabled
                    title="签订电子合同后方可转发支付链接"
                  >
                    <Share2 className="h-4 w-4" /> 转发支付链接
                  </Button>
                ) : null}
                {showUploadCTA ? (
                  <Button
                    variant={isActive ? "brand" : "outline"}
                    onClick={() => setUploadStage(stage)}
                  >
                    <Upload className="h-4 w-4" />
                    {revising ? "上传返修成果" : "上传本阶段成果"}
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

            {stageRevisions.length > 0 ? (
              <div className="border-t border-violet-200 bg-violet-50/60 px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-wider text-violet-800">
                  {revising ? "返修中" : "返修记录"}
                </div>
                <div className="mt-2 space-y-2">
                  {stageRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs text-ink"
                    >
                      <div className="text-ink-40">
                        {formatDateTime(rev.createdAt)} ·{" "}
                        {rev.status === "pending" ? "待响应" : "已响应"}
                      </div>
                      <div className="mt-1">{rev.description}</div>
                      {rev.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {rev.attachments.map((a, idx) => (
                            <Badge key={`${rev.id}-${idx}`} variant="muted">
                              {a.name}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {isClientView && revising && isActive && needsDeliverables ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        push({
                          title: "已打开返修成果预览",
                          description: stage.name,
                        })
                      }
                    >
                      查看返修成果
                    </Button>
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={() => handleConfirm(stage)}
                    >
                      确认返修成果
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

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
                canConfirm={perspective === "client"}
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

            {isClientView && getDesigner ? (
              <StageParticipantDeliverables
                order={order}
                stage={stage}
                getDesigner={getDesigner}
                getServiceProvider={getServiceProvider}
                showFiles={needsDeliverables}
                roles={
                  showClientAcceptance
                    ? ["auditor", "project_manager"]
                    : undefined
                }
                unlocked={stage.status === "released" || showClientAcceptance}
              />
            ) : null}

            {isClientView &&
            !previewOnly &&
            getDesigner &&
            stageSplits.length > 0 ? (
              <StagePaymentSplitsPanel
                stage={stage}
                splits={stageSplits}
                getDesigner={getDesigner}
                getServiceProvider={getServiceProvider}
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

      <StageDeliverableUploadDialog
        open={!!uploadStage}
        onOpenChange={(open) => {
          if (!open) setUploadStage(null);
        }}
        stage={uploadStage}
        revising={revising}
        onConfirm={(files) => {
          if (!uploadStage) return;
          if (onUploadDeliverables) {
            onUploadDeliverables(uploadStage, files);
          } else {
            push({
              title: revising ? "返修成果已上传" : "成果文件已上传",
              description: "委托人将收到验收提醒。",
              variant: "success",
            });
          }
          setUploadStage(null);
        }}
      />
    </div>
  );
}
