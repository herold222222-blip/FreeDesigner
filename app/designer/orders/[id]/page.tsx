"use client";

import { useMemo } from "react";
import type { Order } from "@/lib/types";
import Link from "next/link";
import { useOrder, useClient, useDesigners } from "@/lib/use-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import {
  OrderEntrustDescription,
  quoteLinesFromOrder,
} from "@/components/domain/order-entrust-description";
import { OrderAttachmentsList } from "@/components/domain/order-attachments";
import {
  AwaitingClientPaymentBadge,
  OrderStatusBadge,
  SpecialtyBadge,
} from "@/components/domain/status-badges";
import { PaymentDeadlineBadge } from "@/components/domain/payment-deadline-note";
import { isAwaitingClientPaymentOrder } from "@/lib/order-supervision";
import { getPayableStageDeadline } from "@/lib/order-payment-overdue";
import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";
import { StageTimeline } from "@/components/domain/stage-timeline";
import {
  OrderScheduleBillingPanel,
  OrderServiceControlCard,
} from "@/components/domain/order-schedule-billing-panel";
import { OrderDetailSwitchCard } from "@/components/domain/order-detail-switch-card";
import { OrderElectronicContractCard } from "@/components/domain/order-electronic-contract-card";
import { isTimeBilledOrder } from "@/lib/time-billing";
import { isDirectedOrderSource } from "@/lib/unified-project-list";
import { DesignerOrderScopePanel } from "@/components/domain/designer-order-scope-panel";
import { sumDesignerOrderNetEarnings } from "@/lib/designer-order-scope";
import { bountyTrackFromOrder } from "@/lib/order-assign-tracks";
import {
  formatDirectedPlatformFeeLabel,
  orderTaxCoefficient,
  taxPointRateFromCoefficient,
} from "@/lib/directed-platform-fee";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, formatOptionalDate } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { useRoleStore } from "@/store/role-store";
import {
  acceptOrderRequest,
  acceptDesignerAssignmentRequest,
  rejectDesignerAssignmentRequest,
  submitStageDeliverablesRequest,
  skipPreliminaryDeliverablesRequest,
  deleteStageDeliverableRequest,
  requestProjectSettlementRequest,
} from "@/lib/api-client";
import {
  isContractFullySigned,
  isOrderCancelled,
  needsClientReview,
  needsDesignerSign,
  orderExpectedDateLabel,
  resolveDisplayOrderStatus,
} from "@/lib/order-lifecycle";
import {
  isScanAwaitingClientQuoteConfirm,
  isScanAwaitingDesignerQuote,
  isScanSourceOrder,
  shouldHideDesignerScanPaymentTimeline,
} from "@/lib/scan-order";
import { DesignerScanQuoteWorkspace } from "@/components/domain/designer-scan-quote-workspace";
import { SelfOrderSharePanel } from "@/components/domain/self-order-share-panel";
import { isSelfOrderPendingClaim } from "@/lib/self-order-share";
import {
  OrderCancelledBanner,
  OrderInteractionLock,
} from "@/components/domain/order-cancelled-lock";
import { ORDER_STATUS_META, resolveTrackLabels } from "@/lib/constants";
import { resolveVisiblePhone } from "@/lib/designer-contact-privacy";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";
import { ClientLevelBadge } from "@/components/domain/level-badges";
import { DESIGNER_ORDER_STATUS_LABEL } from "@/lib/designer-order-status-filter";
import { DisputeFilingDialog } from "@/components/domain/dispute-filing-dialog";
import { StageDeliverableUploadDialog } from "@/components/domain/stage-deliverable-upload-dialog";
import { resolveDeliverablePhase } from "@/lib/deliverable-phase";
import { useState } from "react";

export default function DesignerOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: order, loading, refresh } = useOrder(params.id);
  const { data: client } = useClient(order?.clientId);
  const { data: designers } = useDesigners();
  const getDesigner = useMemo(
    () => (id: string) => designers.find((d) => d.id === id),
    [designers],
  );
  const push = useSessionStore((s) => s.pushNotification);
  const commerce = usePlatformPricingStore((s) => s.config.commerce);
  const identityId = useRoleStore((s) => s.identityId);
  const currentDesignerId = identityId || order?.designerId || "";
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [revisionUploadStageId, setRevisionUploadStageId] = useState<string | null>(null);

  const runAction = async (
    fn: () => Promise<unknown>,
    successTitle: string,
    successDescription?: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      push({
        title: successTitle,
        description: successDescription,
        variant: "success",
      });
      refresh();
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

  const handleAccept = () =>
    runAction(
      () => acceptOrderRequest(order!.id),
      "已确认档期",
      "等待双方签约并支付预付款。",
    );

  const handleAcceptAssignment = () =>
    runAction(
      () => acceptDesignerAssignmentRequest(order!.id),
      "已确认接单",
      "订单进入待签约，请双方签署电子合同。",
    );

  const handleRejectAssignment = () => {
    if (busy || !order) return;
    const reason = window.prompt("请填写拒绝原因（可选）", "");
    if (reason === null) return;
    void runAction(
      () =>
        rejectDesignerAssignmentRequest(
          order.id,
          reason.trim() || undefined,
        ),
      "已拒绝委派",
      "已通知管理员，订单将重新匹配设计师。",
    );
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-ink-60">正在加载项目详情...</div>
    );
  }
  if (!order) {
    return (
      <div className="py-20 text-center text-ink-60">未找到该项目或无权访问。</div>
    );
  }

  const myNetEarnings = currentDesignerId
    ? sumDesignerOrderNetEarnings(
        order,
        currentDesignerId,
        getDesigner(currentDesignerId),
      )
    : 0;
  const cancelled = isOrderCancelled(order);
  const contractSigned = isContractFullySigned(order);
  const displayStatus = resolveDisplayOrderStatus(order);
  const statusLabel = needsClientReview(order)
    ? "待评价"
    : (DESIGNER_ORDER_STATUS_LABEL[displayStatus] ??
      ORDER_STATUS_META[displayStatus].label);
  const awaitingPayment = isAwaitingClientPaymentOrder(order);
  const paymentDeadline = getPayableStageDeadline(order);

  const projectsListHref = isDirectedOrderSource(order)
    ? "/designer/directed-orders"
    : "/designer/orders";
  const projectsListLabel = isDirectedOrderSource(order)
    ? "返回定向订单"
    : "返回平台项目";

  return (
    <div className="space-y-6">
      <Link
        href={projectsListHref}
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {projectsListLabel}
      </Link>

      <OrderCancelledBanner order={order} />

      <OrderInteractionLock order={order}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {isScanAwaitingDesignerQuote(order) ? (
            <DesignerScanQuoteWorkspace
              order={order}
              myNetEarnings={myNetEarnings}
              onUpdated={refresh}
              busy={busy}
              setBusy={setBusy}
            />
          ) : (
          <>
          {isSelfOrderPendingClaim(order) ? (
            <SelfOrderSharePanel order={order} />
          ) : isScanAwaitingClientQuoteConfirm(order) ? (
            <Card className="border-brand/20 bg-brand/5 p-4 text-sm text-ink">
              <p className="font-medium text-ink">
                已提交费用及付款阶段，等待委托人确认
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-60">
                委托人确认后将进入合同签署；如对方修改金额、付款阶段或付款条件，将通知您再次确认。
              </p>
            </Card>
          ) : null}
          {!cancelled && order.status === "pending_designer_accept" ? (
            <DesignerAcceptCard
              order={order}
              currentDesignerId={currentDesignerId}
              myNetEarnings={myNetEarnings}
              busy={busy}
              onAccept={handleAcceptAssignment}
              onReject={handleRejectAssignment}
            />
          ) : null}
          {!cancelled &&
          order.status === "pending_schedule" &&
          !isScanSourceOrder(order) &&
          !isSelfOrderPendingClaim(order) ? (
            <Card className="space-y-3 border-brand/20 bg-brand/5 p-5">
              <p className="text-sm text-ink">
                委托人已提交档期申请，确认后双方可签约并支付预付款。
              </p>
              <Button
                variant="brand"
                size="sm"
                disabled={busy}
                onClick={handleAccept}
              >
                {busy ? "处理中..." : "确认接单档期"}
              </Button>
            </Card>
          ) : null}
          {!cancelled && order.pendingSettlement ? (
            <Card className="space-y-3 border-amber-200 bg-amber-50/50 p-5">
              <p className="text-sm text-ink">
                全部阶段已验收，可申请项目结算。委托人确认后项目结案。
              </p>
              <Button
                variant="brand"
                size="sm"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => requestProjectSettlementRequest(order.id),
                    "已申请项目结算",
                    "请等待委托人确认最终服务完成。",
                  )
                }
              >
                申请项目结算
              </Button>
            </Card>
          ) : null}
          <OrderDetailSwitchCard
            showSchedule={!isScanAwaitingClientQuoteConfirm(order)}
            scheduleLabel={
              isTimeBilledOrder(order) ? "工作日历 & 付款" : "付款进度 & 阶段成果"
            }
            info={
              <>
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
                      {formatCurrency(myNetEarnings)}
                    </div>
                    <div className="mt-1 text-xs text-ink-60">
                      {order.quote?.basicFee
                        ? "本专业基础服务费，不含平台管理费与税费"
                        : `按订单费用扣除平台服务费（${formatDirectedPlatformFeeLabel(
                            taxPointRateFromCoefficient(
                              orderTaxCoefficient(order),
                            ),
                          )}）后的预计实收`}
                    </div>
                  </div>
                </div>

                <OrderEntrustDescription
                  description={order.description}
                  quoteLines={quoteLinesFromOrder(order)}
                  primaryTrack={bountyTrackFromOrder(order)}
                  revealContactPhone={contractSigned}
                  afterNotes={
                    isScanAwaitingClientQuoteConfirm(order) &&
                    order.stages.length > 0 ? (
                      <section className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wider text-brand">
                              已提交费用及付款阶段
                            </div>
                            <p className="mt-1 text-xs text-ink-60">
                              等待委托人确认；确认后进入签约。如对方修改条款，将通知您再次核对。
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-ink-60">项目总费用</div>
                            <div className="text-2xl font-semibold tabular-nums tracking-tight text-brand">
                              {formatCurrency(order.totalAmount)}
                            </div>
                          </div>
                        </div>
                        <ul className="mt-4 space-y-2">
                          {order.stages.map((stage, i) => (
                            <li
                              key={stage.id}
                              className="rounded-xl border border-ink-20 bg-white px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-ink">
                                  {i + 1}. {stage.name} ·{" "}
                                  {Math.round((stage.ratio ?? 0) * 100)}%
                                </span>
                                <span className="text-sm font-semibold tabular-nums text-brand">
                                  {formatCurrency(stage.amount)}
                                </span>
                              </div>
                              {stage.note ? (
                                <p className="mt-1 text-[11px] leading-relaxed text-ink-60">
                                  {stage.note}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null
                  }
                />

                <OrderAttachmentsList attachments={order.attachments} />

                <Separator className="my-6" />

                <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <Field label="服务模式" value={order.serviceMode === "online" ? "纯线上" : "线下上门"} icon={MapPin} />
                  <Field
                    label="计费模式"
                    value={
                      order.billingMode === "area"
                        ? "常规面积报价"
                        : order.billingMode === "daily"
                          ? "按工时"
                          : "按月雇佣"
                    }
                    icon={Clock}
                  />
                  <Field label="项目类型" value={order.projectType} />
                  <Field label={orderExpectedDateLabel(order)} value={formatOptionalDate(order.expectedDeliveryAt)} icon={Calendar} />
                </div>
              </>
            }
            schedule={
              <>
                {isTimeBilledOrder(order) ? (
                  <OrderScheduleBillingPanel
                    order={order}
                    embedded
                    perspective="designer"
                    hideServiceControls
                  />
                ) : (
                  <p className="mb-5 text-sm text-ink-60">
                    仅展示与你相关的阶段款项与成果 · 委托方已支付后可至钱包申请提现。
                  </p>
                )}
                {isTimeBilledOrder(order) ? (
                  <div className="mt-8">
                    <h2 className="text-lg font-semibold tracking-tight text-ink">
                      本专业付款阶段
                    </h2>
                    <p className="mt-1 mb-5 text-sm text-ink-60">
                      仅展示与你相关的阶段款项与成果 · 委托方已支付后可至钱包申请提现。
                    </p>
                  </div>
                ) : null}
                {shouldHideDesignerScanPaymentTimeline(order) ? (
                  <div className="space-y-2">
                    <PaymentEscrowHint />
                    <p className="text-sm leading-relaxed text-ink-60">
                    {isScanAwaitingClientQuoteConfirm(order)
                      ? "已提交费用及付款阶段，等待委托人最终确认。确认后将在此展示各阶段进度。"
                      : "付款阶段已由委托人在下单时填写。请确认费用方案后，委托人确认后将在此展示各阶段进度。"}
                    </p>
                  </div>
                ) : (
                <StageTimeline
                  order={order}
                  perspective="designer"
                  getDesigner={getDesigner}
                  collaboratorMode="designer"
                  currentDesignerId={currentDesignerId}
                  hideMonthlyCalendar={order.billingMode === "monthly"}
                  onUploadDeliverables={(stage, files) => {
                    const revisingNow = order.status === "in_revision";
                    const phase = resolveDeliverablePhase(stage, order.status);
                    const title = revisingNow
                      ? "返修成果已上传"
                      : phase === "final"
                        ? "最终成果 / 确认单已上传"
                        : "初步成果已上传";
                    const description = revisingNow
                      ? "委托人将收到验收提醒。"
                      : phase === "final"
                        ? "委托人可进行最终成果确认。"
                        : "委托人可确认初步成果，或你可跳过进入最终成果。";
                    runAction(
                      () =>
                        submitStageDeliverablesRequest(
                          order.id,
                          stage.id,
                          files,
                        ),
                      title,
                      description,
                    );
                  }}
                  onSkipPreliminary={(stage) =>
                    runAction(
                      () =>
                        skipPreliminaryDeliverablesRequest(order.id, stage.id),
                      "已跳过初步成果",
                      "请上传最终成果 / 确认单。",
                    )
                  }
                  onDeleteDeliverable={(stage, file) =>
                    runAction(
                      () =>
                        deleteStageDeliverableRequest(
                          order.id,
                          stage.id,
                          file.id,
                        ),
                      "成果已删除",
                      "该文件已从本阶段移除。",
                    )
                  }
                />
                )}
                {isTimeBilledOrder(order) ? (
                  <OrderServiceControlCard
                    order={order}
                    perspective="designer"
                    className="mt-5"
                  />
                ) : null}
              </>
            }
          />
          </>
          )}

          <OrderElectronicContractCard order={order} party="designer" />

          {order.status === "in_revision" && order.revisions.length > 0 ? (
            <Card className="border-violet-200 bg-violet-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-violet-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-900">
                    委托人提交了返修需求 · 请尽快响应
                  </div>
                  {order.revisions.map((r) => (
                    <div key={r.id} className="mt-3 rounded-lg bg-white p-4">
                      <div className="text-xs text-ink-40">
                        {formatDateTime(r.createdAt)}
                      </div>
                      <div className="mt-1 text-sm text-ink">
                        {r.description}
                      </div>
                      {r.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.attachments.map((a, i) => (
                            <Badge key={i} variant="muted">
                              📎 {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={busy}
                          onClick={() => setRevisionUploadStageId(r.stageId)}
                        >
                          <Upload className="h-3.5 w-3.5" /> 上传返修方案
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {currentDesignerId ? (
            <DesignerOrderScopePanel
              order={order}
              designerId={currentDesignerId}
              getDesigner={getDesigner}
              onDeleteDeliverable={(stageId, file) =>
                runAction(
                  () =>
                    deleteStageDeliverableRequest(order.id, stageId, file.id),
                  "成果已删除",
                  "该文件已从本阶段移除。",
                )
              }
            />
          ) : null}


        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              对接委托人
            </div>
            {client ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={client.avatar} alt={client.name} />
                    <AvatarFallback>{client.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {client.name}
                      {client.verified && client.type === "enterprise" ? (
                        <Badge variant="brand" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 企业认证
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-60">
                      {client.type === "enterprise" ? client.companyName : "个人委托人"}
                    </div>
                  </div>
                </div>
                <dl className="space-y-1.5 text-xs text-ink-60">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ink-40" />
                    <dt className="shrink-0">联系人电话</dt>
                    <dd className="font-medium text-ink">
                      {(() => {
                        const visible = resolveVisiblePhone(
                          client.phone,
                          contractSigned,
                        );
                        if (!visible) return "—";
                        return visible.href ? (
                          <a href={visible.href} className="hover:text-brand">
                            {visible.display}
                          </a>
                        ) : (
                          visible.display
                        );
                      })()}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0">委托人等级</dt>
                    <dd>
                      <ClientLevelBadge
                        level={client.level ?? DEFAULT_CLIENT_LEVEL}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              当前状态说明
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-ink-60">
              <Info className="mt-0.5 h-3.5 w-3.5 text-ink-40" />
              {statusLabel} · {designerStatusDescription(order, awaitingPayment)}
            </div>
          </Card>

          {!cancelled &&
            ["in_progress", "in_revision", "pending_review"].includes(
            order.status,
          ) && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                纠纷与申诉
              </div>
              <p className="mt-2 text-xs text-ink-60">
                若委托人长期未付款或未响应，可申请平台介入。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setDisputeOpen(true)}
              >
                <ShieldAlert className="h-3.5 w-3.5" /> 申请平台介入
              </Button>
            </Card>
          )}

          <Card className="space-y-2 p-5 text-xs text-ink-60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              每笔款项进入 {commerce.escrowDays} 天托管期，验收无误自动解冻可提现。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              设计师提交最终成果后 {commerce.deliverableConfirmDays} 天内未确认，系统自动确认并开始验收期；确认后 {commerce.afterSalesDays} 天无异议自动解冻。返修后从设计师重新提交起重新计时。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              最后一笔费用支付后 {commerce.clientReviewDays} 天内可评价设计师，逾期评论关闭。
            </div>
          </Card>
        </aside>
      </div>
      </OrderInteractionLock>

      {!cancelled && order ? (
        <DisputeFilingDialog
          open={disputeOpen}
          onOpenChange={setDisputeOpen}
          order={order}
          onFiled={() => {
            push({
              title: "纠纷申请已提交",
              description: "平台管理员将尽快受理。",
              variant: "success",
            });
            refresh();
          }}
        />
      ) : null}

      <StageDeliverableUploadDialog
        open={!!revisionUploadStageId}
        onOpenChange={(open) => {
          if (!open) setRevisionUploadStageId(null);
        }}
        stage={
          order.stages.find((s) => s.id === revisionUploadStageId) ?? null
        }
        revising
        submitting={busy}
        onConfirm={(files) => {
          if (!revisionUploadStageId) return;
          const stageId = revisionUploadStageId;
          setRevisionUploadStageId(null);
          runAction(
            () => submitStageDeliverablesRequest(order.id, stageId, files),
            "返修成果已上传",
            "委托人将收到验收提醒。",
          );
        }}
      />
    </div>
  );
}

function designerStatusDescription(order: Order, awaitingPayment: boolean) {
  if (order.status === "cancelled") {
    return "本订单已取消，仅可查看，不可操作。";
  }
  if (needsClientReview(order)) {
    return "项目已经完成，等待委托人评价。";
  }
  if (awaitingPayment) {
    return order.stages.findIndex((s) => s.status === "pending") === 0
      ? "双方已完成电子签约，等待委托人支付预付款后即可开工。"
      : "委托人已确认成果，请等待委托人付款。";
  }
  switch (resolveDisplayOrderStatus(order)) {
    case "pending_quote":
    case "matching":
      return "订单正在匹配中，请等待平台或委托人确认。";
    case "pending_designer_accept":
      return "平台已向您委派本订单，请确认是否接单。";
    case "pending_schedule":
      if (isScanAwaitingDesignerQuote(order)) {
        return order.scanQuoteProposedAt
          ? "委托人已修改费用或付款条款，请确认或修改后发回。"
          : "委托人已通过扫码提交项目需求。未改动可直接确认费用；如修改金额、付款阶段或付款条件，将发回委托人确认。";
      }
      if (isScanAwaitingClientQuoteConfirm(order)) {
        return "费用方案已发送，等待委托人确认后将进入合同签署。";
      }
      return "委托人已提交档期申请，请确认后进入合同签署。";
    case "pending_contract":
      if (needsDesignerSign(order)) {
        return order.clientSignedContract
          ? "委托人已经签署，请尽快完成签署。双方签完后即可等待预付款。"
          : "电子合同已生成，请先签署。双方签完后委托人即可支付预付款。";
      }
      return order.clientSignedContract
        ? "双方已完成电子签约，等待委托人支付预付款后即可开工。"
        : "您已签署合同，等待委托人完成签约。";
    case "in_progress":
      return "项目进行中，请按阶段推进并上传本专业成果。";
    case "pending_review":
      return "成果已上传，等待委托人预览并确认。";
    case "in_revision":
      return "委托人已提交返修需求，请尽快优化后重新上传。";
    case "completed":
      return "项目已结案，阶段款项验收后可至钱包申请提现。";
    default:
      return "请根据当前订单进度继续处理。";
  }
}

function DesignerAcceptCard({
  order,
  currentDesignerId,
  myNetEarnings,
  busy,
  onAccept,
  onReject,
}: {
  order: Order;
  currentDesignerId: string;
  myNetEarnings: number;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const myTracks = (order.trackAssignments ?? []).filter(
    (a) => a.designerId === currentDesignerId,
  );
  const myPending = myTracks.filter((a) => a.status === "pending_match");
  const waitingPeers = (order.trackAssignments ?? []).some(
    (a) => a.designerId !== currentDesignerId && a.status === "pending_match",
  );
  const alreadyAccepted = myTracks.length > 0 && myPending.length === 0;
  return (
    <Card className="space-y-3 border-brand/20 bg-brand/5 p-5">
      <p className="text-sm leading-relaxed text-ink">
        平台已向您委派本订单，您本专业预计实收 {formatCurrency(myNetEarnings)}
        （不含平台管理费与税费）。
        {myTracks.length > 0
          ? `您负责：${myTracks
              .map((a) => {
                const labels = resolveTrackLabels(a.l1, a.l2, a.l3);
                return `${labels.l2Label}·${labels.l3Label}`;
              })
              .join("、")}。`
          : ""}
        {alreadyAccepted
          ? waitingPeers
            ? "您已确认，正在等待其他专业设计师确认后进入签约。"
            : "您已确认接单。"
          : waitingPeers
            ? "同意后将等待其他专业设计师确认；全部确认后进入签约；拒绝后管理员将重新匹配。"
            : "同意后进入签约；拒绝后管理员将重新匹配。"}
      </p>
      {!alreadyAccepted ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" size="sm" disabled={busy} onClick={onAccept}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy ? "处理中..." : "同意接单"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={busy}
            onClick={onReject}
          >
            <XCircle className="h-3.5 w-3.5" />
            拒绝委派
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function Field({
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
