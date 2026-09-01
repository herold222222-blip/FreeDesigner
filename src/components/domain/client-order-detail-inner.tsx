"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOrder, useDesigner, useDesigners } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import {
  releaseStageRequest,
  requestStageRevisionRequest,
  confirmStageDeliverablesRequest,
  submitOrderReviewRequest,
  ensureOrderReviewShareRequest,
  updateMatchingOrderRequest,
  confirmOrderQuoteRequest,
} from "@/lib/api-client";
import {
  MatchingOrderEditDialog,
  type MatchingOrderEditPayload,
} from "@/components/domain/matching-order-edit-dialog";
import { invalidateApiPath } from "@/lib/use-data";
import { StagePaymentDialog } from "@/components/domain/stage-payment-dialog";
import { OrderReviewDialog } from "@/components/domain/order-review-dialog";
import { ForwardDeliverablesConfirmDialog } from "@/components/domain/forward-deliverables-confirm-dialog";
import { DisputeFilingDialog } from "@/components/domain/dispute-filing-dialog";
import { OrderQuotePanel } from "@/components/domain/order-quote-panel";
import { ClientLevelQuoteMatchPanel } from "@/components/domain/client-level-quote-match-panel";
import {
  isContractFullySigned,
  isOrderCancelled,
  isOrderDeletable,
  needsClientReview,
  needsClientSign,
  orderExpectedDateLabel,
  orderFulfillmentFinished,
} from "@/lib/order-lifecycle";
import {
  formatClientReviewWindow,
  isClientReviewClosed,
} from "@/lib/client-review";
import {
  OrderCancelledBanner,
  OrderInteractionLock,
} from "@/components/domain/order-cancelled-lock";
import { OrderDeleteButton } from "@/components/domain/order-delete-button";
import {
  OrderEntrustDescription,
  quoteLinesFromOrder,
} from "@/components/domain/order-entrust-description";
import { OrderAttachmentsList } from "@/components/domain/order-attachments";
import {
  needsCsQuoteConfirm,
  clientCanEditEntrust,
  isAwaitingClientPaymentOrder,
} from "@/lib/order-supervision";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DesignerName } from "@/components/domain/designer-name";
import { maskDesignerPublicName, resolveVisiblePhone } from "@/lib/designer-contact-privacy";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { DEFAULT_DESIGNER_LEVEL } from "@/lib/level-management";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import {
  AwaitingClientPaymentBadge,
  OrderStatusBadge,
  SpecialtyBadge,
} from "@/components/domain/status-badges";
import { PaymentDeadlineBadge } from "@/components/domain/payment-deadline-note";
import { getPayableStageDeadline, getStagePaymentDeadline } from "@/lib/order-payment-overdue";
import { StageTimeline } from "@/components/domain/stage-timeline";
import { OrderScheduleBillingPanel } from "@/components/domain/order-schedule-billing-panel";
import { OrderDetailSwitchCard } from "@/components/domain/order-detail-switch-card";
import { OrderElectronicContractCard } from "@/components/domain/order-electronic-contract-card";
import { isTimeBilledOrder } from "@/lib/time-billing";
import {
  isScanAwaitingClientQuoteConfirm,
  isScanAwaitingDesignerQuote,
} from "@/lib/scan-order";
import { ScanQuotePanel } from "@/components/domain/scan-quote-panel";
import { OrderTrackAssignmentsPanel } from "@/components/domain/order-track-assignments";
import {
  OrderValueAddedBadges,
  OrderValueAddedServicesPanel,
} from "@/components/domain/order-value-added-services";
import { SUBJECT_TYPE_META } from "@/lib/constants";
import { clientOrderListNav } from "@/lib/unified-project-list";
import { bountyTrackFromOrder } from "@/lib/order-assign-tracks";
import type { Order } from "@/lib/types";
import { resolveDeliverablePhase } from "@/lib/deliverable-phase";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Hash,
  Info,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Sparkles,
  Star,
  Share2,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, formatOptionalDate } from "@/lib/utils";

export function ClientOrderDetailInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { data: order, loading, refresh } = useOrder(id);
  const { data: designer } = useDesigner(order?.designerId);
  const { data: designers } = useDesigners();
  const push = useSessionStore((s) => s.pushNotification);
  const commerce = usePlatformPricingStore((s) => s.config.commerce);
  const [busy, setBusy] = useState(false);
  const [payTarget, setPayTarget] = useState<{
    stageId: string;
    name: string;
    amount: number;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const stageId = searchParams.get("payStage");
    if (!stageId || !order) return;
    const stage = order.stages.find((s) => s.id === stageId);
    if (stage && stage.status !== "paid" && stage.status !== "released") {
      setPayTarget({
        stageId: stage.id,
        name: stage.name,
        amount: stage.amount,
      });
    }
  }, [order, searchParams]);

  const getDesigner = useMemo(
    () => (id: string) => designers.find((d) => d.id === id),
    [designers],
  );

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

  const handleSaveMatching = async (payload: MatchingOrderEditPayload) => {
    if (!order || editSaving) return;
    setEditSaving(true);
    try {
      await updateMatchingOrderRequest(order.id, payload);
      push({
        title: "项目信息已更新",
        description:
          order.levelQuotes?.length || order.quote
            ? "已按最新委托信息重新测算。请客服确认后，将显示等级报价卡并可匹配设计师。"
            : "请按最新信息重新匹配设计师。",
        variant: "success",
      });
      setEditOpen(false);
      invalidateApiPath("/api/orders");
      refresh();
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-ink-60">正在加载订单详情...</div>
    );
  }
  if (!order) {
    return (
      <div className="py-20 text-center text-ink-60">未找到该订单或无权访问。</div>
    );
  }

  const cancelled = isOrderCancelled(order);
  const contractSigned = isContractFullySigned(order);
  const paymentDeadline = getPayableStageDeadline(order);
  const statusCopy = describeClientOrderStatus(order);
  const { href: ordersListHref, label: ordersListLabel } =
    clientOrderListNav(order);

  return (
    <div className="space-y-6">
      <Link
        href={ordersListHref}
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {ordersListLabel}
      </Link>

      <OrderCancelledBanner order={order} />

      {isOrderDeletable(order) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/80 bg-rose-50/50 px-4 py-3">
          <p className="text-xs text-rose-900/80">
            {order.status === "cancelled" ? "已取消" : "已完成"}
            的订单可永久删除，删除后无法恢复。
          </p>
          <OrderDeleteButton
            order={order}
            perspective="client"
            redirectTo={ordersListHref}
          />
        </div>
      ) : null}

      <OrderInteractionLock order={order}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <OrderDetailSwitchCard
            showSchedule={order.status !== "pending_quote"}
            scheduleLabel={
              isTimeBilledOrder(order) ? "工作日历 & 付款" : "付款进度 & 阶段成果"
            }
            header={
              !cancelled && orderFulfillmentFinished(order) ? (
                <ClientProjectReviewCard
                  order={order}
                  onReview={() => setReviewOpen(true)}
                />
              ) : undefined
            }
            info={
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SpecialtyBadge specialty={order.specialty} />
                      <OrderStatusBadge order={order} />
                      {isAwaitingClientPaymentOrder(order) ? (
                        <AwaitingClientPaymentBadge perspective="client" />
                      ) : null}
                      {isClientReviewClosed(order) ? (
                        <Badge variant="muted">评论已关闭</Badge>
                      ) : null}
                      {paymentDeadline ? (
                        <PaymentDeadlineBadge deadline={paymentDeadline} />
                      ) : null}
                      <OrderValueAddedBadges order={order} />
                      <ProjectIdCopy code={order.code} />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-ink">
                      {order.title}
                    </h1>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    {!cancelled && clientCanEditEntrust(order) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setEditOpen(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> 修改项目信息
                      </Button>
                    ) : null}
                  </div>
                </div>

                <OrderEntrustDescription
                  description={order.description}
                  quoteLines={quoteLinesFromOrder(order)}
                  primaryTrack={bountyTrackFromOrder(order)}
                  revealContactPhone
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

                {order.onsiteSchedule ? (
                  <div className="mt-5 rounded-xl border border-ink-20 bg-ink-20/20 p-4 text-sm">
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                      线下上门安排
                    </div>
                    <div className="mt-2 text-ink">
                      {formatDate(order.onsiteSchedule.from)} 至 {formatDate(order.onsiteSchedule.to)} ·{" "}
                      {order.onsiteSchedule.address}
                    </div>
                  </div>
                ) : null}
              </>
            }
            schedule={
              isTimeBilledOrder(order) ? (
                <OrderScheduleBillingPanel
                  order={order}
                  embedded
                  paying={busy}
                  revising={busy}
                  onPayStage={(item) => {
                    if (!item.stageId) return;
                    setPayTarget({
                      stageId: item.stageId,
                      name: item.label,
                      amount: item.amount,
                    });
                  }}
                  onReviseStage={({ stageId, description, attachments, fileId, fileName }) =>
                    runAction(
                      () =>
                        requestStageRevisionRequest(
                          order.id,
                          stageId,
                          description,
                          attachments,
                          fileId,
                          fileName,
                        ),
                      "已提交返修需求",
                      "设计师将优先处理",
                    )
                  }
                  onConfirmStage={(stageId) => {
                    const stage = order.stages.find((s) => s.id === stageId);
                    const phase = stage
                      ? resolveDeliverablePhase(stage, order.status)
                      : "final";
                    runAction(
                      () => confirmStageDeliverablesRequest(order.id, stageId),
                      phase === "preliminary"
                        ? "已确认初步成果"
                        : "已确认最终成果",
                      phase === "preliminary"
                        ? "请等待设计师上传最终成果 / 确认单。"
                        : undefined,
                    );
                  }}
                />
              ) : (
                <>
                  <p className="mb-5 text-sm text-ink-60">
                    {isScanAwaitingDesignerQuote(order)
                      ? order.scanQuoteProposedAt
                        ? "已将修改后的费用、付款阶段与付款条件发给设计师，等待对方确认。"
                        : "付款阶段已由您在下单时填写。设计师确认费用后，各阶段金额与进度将在此更新。"
                      : isScanAwaitingClientQuoteConfirm(order)
                        ? "请核对总费用、付款阶段与付款条件。未改动可直接确认；如有修改将发回设计师再次确认。"
                        : "设计师上传成果文件后,你可在线免费预览。预览满意后付款解锁下载。"}
                  </p>
                  {isScanAwaitingClientQuoteConfirm(order) ? (
                    <ScanQuotePanel
                      order={order}
                      perspective="client"
                      onUpdated={refresh}
                      busy={busy}
                      setBusy={setBusy}
                    />
                  ) : (
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
                        () =>
                          confirmStageDeliverablesRequest(order.id, stage.id),
                        phase === "preliminary"
                          ? "已确认初步成果"
                          : "已确认最终成果",
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
                  )}
                </>
              )
            }
          />

          <OrderElectronicContractCard order={order} party="client" />

          {!cancelled &&
          (order.status === "pending_quote" ||
            order.status === "matching" ||
            order.status === "pending_designer_accept") &&
          (order.levelQuotes?.length ||
            (order.quote && order.orderSource === "regular")) ? (
            <ClientLevelQuoteMatchPanel
              order={order}
              designers={designers}
              onUpdated={refresh}
            />
          ) : !order.levelQuotes?.length && order.quote ? (
            <OrderQuotePanel
              order={order}
              hideUnconfirmedCards
              confirming={busy}
              onConfirm={
                !cancelled && order.status === "pending_quote"
                  ? () =>
                      runAction(
                        () => confirmOrderQuoteRequest(order.id),
                        "报价已确认，已通知管理员分配设计师",
                      )
                  : undefined
              }
            />
          ) : null}

          {order.status === "in_revision" && order.revisions.length > 0 ? (
            <Card className="border-violet-200 bg-violet-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-violet-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-900">
                    已提交返修需求 · 等待设计师响应
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
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {order.status !== "pending_quote" ? (
            <OrderTrackAssignmentsPanel order={order} getDesigner={getDesigner} />
          ) : null}

          {(order.withAuditService || order.withProjectManagement) ? (
            <OrderValueAddedServicesPanel order={order} />
          ) : null}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              对接设计师
            </div>
            {designer ? (
              <div className="mt-3 space-y-3">
                <Link
                  href={`/designers/${designer.id}`}
                  className="flex items-start gap-3 rounded-xl outline-none transition-colors hover:bg-ink-20/30 focus-visible:ring-2 focus-visible:ring-ink/20"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={designer.avatar}
                      alt={
                        contractSigned
                          ? designer.name
                          : maskDesignerPublicName(designer.name)
                      }
                    />
                    <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      <DesignerName
                        designer={designer}
                        revealFullName={contractSigned}
                        className="text-sm font-medium"
                      />
                      {(designer.reviewStatus ?? "approved") === "approved" ? (
                        <Badge variant="brand" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 已认证
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-60">
                      {designer.subjectType
                        ? SUBJECT_TYPE_META[designer.subjectType].label
                        : designer.code || "设计师"}
                    </div>
                  </div>
                </Link>
                <dl className="space-y-1.5 text-xs text-ink-60">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-ink-40" />
                    <dt className="shrink-0">联系电话</dt>
                    <dd className="font-medium text-ink">
                      {(() => {
                        const visible = resolveVisiblePhone(
                          designer.phone,
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
                    <Hash className="h-3.5 w-3.5 shrink-0 text-ink-40" />
                    <dt className="shrink-0">编号</dt>
                    <dd className="font-medium text-ink">
                      {designer.code || "—"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0">设计师等级</dt>
                    <dd>
                      <DesignerLevelBadge
                        level={designer.level ?? DEFAULT_DESIGNER_LEVEL}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-60">
                设计师确认接单后将在此展示。
              </p>
            )}
          </Card>

          {["in_progress", "in_revision", "pending_review"].includes(
            order.status,
          ) && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                纠纷与申诉
              </div>
              <p className="mt-2 text-xs text-ink-60">
                若与设计师存在履约争议，可申请平台介入调解。
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

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              当前状态说明
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-ink-60">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-40" />
              {statusCopy.detail
                ? `${statusCopy.label} · ${statusCopy.detail}`
                : statusCopy.label}
            </div>
          </Card>

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

      {!cancelled && clientCanEditEntrust(order) ? (
        <MatchingOrderEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          order={order}
          onSave={handleSaveMatching}
          saving={editSaving}
        />
      ) : null}

      {!cancelled ? (
      <OrderReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        designerName={designer?.name ?? "设计师"}
        deadlineHint={formatClientReviewWindow(order)}
        onSubmit={async (payload) => {
          try {
            await submitOrderReviewRequest(order.id, payload);
            push({ title: "评价已提交，感谢你的反馈", variant: "success" });
            refresh();
          } catch (e) {
            const message = e instanceof Error ? e.message : "提交失败";
            if (message.includes("已完成评价")) {
              push({ title: "评价已提交，感谢你的反馈", variant: "success" });
              refresh();
              return;
            }
            push({ title: message, variant: "destructive" });
            throw e;
          }
        }}
      />
      ) : null}

      {!cancelled ? (
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

      {!cancelled && payTarget && (
        <StagePaymentDialog
          open={!!payTarget}
          onOpenChange={(v) => {
            if (!v) setPayTarget(null);
          }}
          orderId={order.id}
          stageId={payTarget.stageId}
          stageName={payTarget.name}
          amount={payTarget.amount}
          deadline={
            order.stages.find((s) => s.id === payTarget.stageId)
              ? getStagePaymentDeadline(
                  order,
                  order.stages.find((s) => s.id === payTarget.stageId)!,
                )
              : paymentDeadline
          }
          onPaid={() => {
            push({ title: `${payTarget.name}支付成功，资金已托管`, variant: "success" });
            setPayTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ClientProjectReviewCard({
  order,
  onReview,
}: {
  order: Order;
  onReview: () => void;
}) {
  const canReview = needsClientReview(order);
  const [share, setShare] = useState<{
    code: string;
    shareId: string;
    url: string;
  } | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);

  useEffect(() => {
    if (!canReview) {
      setShare(null);
      return;
    }
    let active = true;
    ensureOrderReviewShareRequest(order.id)
      .then((next) => {
        if (active) setShare(next);
      })
      .catch(() => {
        if (active) setShare(null);
      });
    return () => {
      active = false;
    };
  }, [canReview, order.id]);

  if (isOrderCancelled(order) || !orderFulfillmentFinished(order)) return null;
  return (
    <Card className="space-y-3 border-amber-200 bg-amber-50/50 p-5">
      <div className="text-xs uppercase tracking-wider text-ink">
        项目评价
      </div>
      <div className="flex items-start gap-2 text-xs text-ink-60">
        <Star className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
        {order.clientReviewed
          ? "已提交评分和评论，感谢你的反馈。"
          : formatClientReviewWindow(order) ??
            "最终成果已确认，可对设计师评分并填写评论。"}
      </div>
      {canReview ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {share?.code ? (
            <div className="mr-auto rounded-lg border border-ink-20 bg-white px-2.5 py-1">
              <div className="text-[10px] leading-none text-ink-40">验证码</div>
              <div className="mt-0.5 font-mono text-sm font-semibold tracking-[0.28em] text-ink">
                {share.code}
              </div>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={!share?.url}
            onClick={() => setForwardOpen(true)}
          >
            <Share2 className="h-3.5 w-3.5" />
            转发
          </Button>
          <Button variant="brand" size="sm" onClick={onReview}>
            去评价设计师
          </Button>
        </div>
      ) : null}
      {share ? (
        <ForwardDeliverablesConfirmDialog
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          url={share.url}
          code={share.code}
          title={`${order.code} · 项目评价`}
          confirmLabel="评价"
        />
      ) : null}
    </Card>
  );
}

function describeClientOrderStatus(order: Order): { label: string; detail: string } {
  if (order.status === "cancelled") {
    return {
      label: "已取消",
      detail: "本订单已取消，仅可查看，不可操作。",
    };
  }
  if (needsClientReview(order)) {
    return {
      label: "待评价",
      detail: "项目已经完成，等待评价。",
    };
  }
  if (isClientReviewClosed(order)) {
    return {
      label: "已完成",
      detail: "项目已经完成，评价窗口已关闭。",
    };
  }
  if (order.clientReviewed) {
    return {
      label: "已完成",
      detail: "项目已结案，所有资金已结算并解冻。",
    };
  }

  if (isAwaitingClientPaymentOrder(order)) {
    return {
      label: "待支付",
      detail:
        order.stages.findIndex((s) => s.status === "pending") === 0
          ? "双方已签约，请支付预付款启动项目。"
          : "成果已确认，请支付本阶段款项。",
    };
  }

  switch (order.status) {
    case "pending_review":
      return {
        label: "待成果确认",
        detail: "设计师已上传阶段成果，请预览并确认。",
      };
    case "in_revision":
      return {
        label: "返修修改中",
        detail: "设计师已收到返修需求，正在优化中。",
      };
    case "in_progress":
      return {
        label: "进行中",
        detail: "设计师正在推进项目，等待阶段成果上传。",
      };
    case "completed":
      return {
        label: "待评价",
        detail: "项目已经完成，等待评价。",
      };
    case "pending_contract":
      return {
        label: "待签约",
        detail: isContractFullySigned(order)
          ? "双方已签约，请支付预付款启动项目。"
          : needsClientSign(order)
            ? order.designerSignedContract
              ? "设计师已经签署，请尽快完成签署。双方签完后即可支付预付款。"
              : "电子合同已生成，请先签署。双方签完后即可支付预付款。"
            : "您已签署合同，等待设计师完成签署。",
      };
    case "pending_schedule":
      return {
        label: isScanAwaitingDesignerQuote(order)
          ? order.scanQuoteProposedAt
            ? "已发回设计师确认费用"
            : "定向需求已经提交，等待设计师确认总费用和付款阶段"
          : "待确认匹配",
        detail: isScanAwaitingDesignerQuote(order)
          ? order.scanQuoteProposedAt
            ? "设计师确认后进入签约；如对方继续修改，将通知您再次核对。"
            : ""
          : isScanAwaitingClientQuoteConfirm(order)
            ? "请核对费用、付款阶段与付款条件。未改动可直接确认；如有修改将发回设计师确认。"
            : "委托人已提交档期申请，请确认后进入合同签署。",
      };
    case "pending_quote":
      return {
        label: "待确认报价",
        detail: needsCsQuoteConfirm(order)
          ? "已收到项目委托信息。客服确认需求后，将显示等级报价卡，即可选卡匹配设计师。"
          : "客服已更新报价。请查看等级报价卡后点击「匹配设计师」。",
      };
    case "matching":
      return {
        label: "待匹配设计师",
        detail:
          order.clientMatch?.pools?.length ||
          order.clientMatch?.trackPools?.length
            ? "请从备选设计师中确认人选；确认后将向对方发送接单邀请。项目信息已锁定，不可再修改。"
            : "已进入匹配，项目信息不可再修改。请确认备选设计师。",
      };
    case "pending_designer_accept":
      return {
        label: "待设计师确认委派",
        detail:
          "已向设计师发送接单邀请；对方同意后进入签约，拒绝则系统自动改派。",
      };
    default:
      return {
        label: "进行中",
        detail: "请根据当前订单进度继续处理。",
      };
  }
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
