"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOrder, useDesigner, useDesigners } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import {
  signOrderRequest,
  releaseStageRequest,
  requestStageRevisionRequest,
  confirmStageDeliverablesRequest,
  confirmFinalSettlementRequest,
  submitOrderReviewRequest,
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
import { DisputeFilingDialog } from "@/components/domain/dispute-filing-dialog";
import { OrderQuotePanel } from "@/components/domain/order-quote-panel";
import { ClientLevelQuoteMatchPanel } from "@/components/domain/client-level-quote-match-panel";
import {
  canPayOrderStages,
  isContractFullySigned,
  isOrderCancelled,
  isOrderDeletable,
  isPendingFinalSettlement,
  needsClientReview,
  needsClientSign,
  resolveDisplayOrderStatus,
} from "@/lib/order-lifecycle";
import {
  allOrderStagesPaid,
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
import { isTimeBilledOrder } from "@/lib/time-billing";
import { OrderTrackAssignmentsPanel } from "@/components/domain/order-track-assignments";
import {
  OrderValueAddedBadges,
  OrderValueAddedServicesPanel,
} from "@/components/domain/order-value-added-services";
import { ORDER_STATUS_META, SUBJECT_TYPE_META } from "@/lib/constants";
import type { Order } from "@/lib/types";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileSignature,
  Hash,
  Info,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Sparkles,
  Star,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default function ClientOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink-60">加载订单...</div>}>
      <ClientOrderDetailInner id={params.id} />
    </Suspense>
  );
}

function ClientOrderDetailInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { data: order, loading, refresh } = useOrder(id);
  const { data: designer } = useDesigner(order?.designerId);
  const { data: designers } = useDesigners();
  const push = useSessionStore((s) => s.pushNotification);
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
            ? "已重新生成等级报价卡。请客服再次确认后，即可选卡匹配设计师。"
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

  const meta = ORDER_STATUS_META[resolveDisplayOrderStatus(order)];
  const cancelled = isOrderCancelled(order);
  const paymentDeadline = getPayableStageDeadline(order);

  return (
    <div className="space-y-6">
      <Link
        href="/client/orders"
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回平台订单
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
            redirectTo="/client/orders"
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
              !cancelled && allOrderStagesPaid(order) ? (
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
                      {needsClientReview(order) ? (
                        <Badge variant="brand">待评价</Badge>
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
                  <Field label="预期交付" value={formatDate(order.expectedDeliveryAt)} icon={Calendar} />
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
                  onConfirmStage={(stageId) =>
                    runAction(
                      () => confirmStageDeliverablesRequest(order.id, stageId),
                      "已确认本阶段设计成果",
                    )
                  }
                />
              ) : (
                <>
                  <p className="mb-5 text-sm text-ink-60">
                    设计师上传成果文件后,你可在线免费预览。预览满意后付款解锁下载。
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
                    onRevise={(stage) =>
                      runAction(
                        () => requestStageRevisionRequest(order.id, stage.id),
                        "已提交返修需求，设计师将优先处理",
                      )
                    }
                  />
                </>
              )
            }
          />

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
                    <AvatarImage src={designer.avatar} alt={designer.name} />
                    <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      <DesignerName
                        designer={designer}
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
                      {designer.phone ? (
                        <a href={`tel:${designer.phone}`} className="hover:text-brand">
                          {designer.phone}
                        </a>
                      ) : (
                        "—"
                      )}
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
              <Info className="mt-0.5 h-3.5 w-3.5 text-ink-40" />
              {meta.label} ·{" "}
              {isAwaitingClientPaymentOrder(order)
                ? order.stages.findIndex((s) => s.status === "pending") === 0
                  ? "双方已签约，请支付预付款启动项目。"
                  : "成果已确认，请支付本阶段款项。"
                : order.status === "in_progress" &&
                  "设计师正在推进项目,等待阶段成果上传。"}
              {order.status === "pending_review" &&
                "设计师已上传阶段成果，请预览并确认。"}
              {order.status === "in_revision" &&
                "设计师已收到返修需求,正在优化中。"}
              {order.status === "completed" &&
                "项目已结案,所有资金已结算并解冻。"}
              {order.status === "pending_contract" &&
                !isAwaitingClientPaymentOrder(order) &&
                (isContractFullySigned(order)
                  ? "双方已签约，请支付预付款启动项目。"
                  : "电子合同已生成，等待双方签署。")}
              {order.status === "pending_schedule" &&
                "委托人已提交档期申请,请确认后进入合同签署。"}
              {order.status === "pending_quote" &&
                (needsCsQuoteConfirm(order)
                  ? "报价卡仅供参考。客服根据您的需求二次确认后，即可选择等级报价卡并匹配设计师。"
                  : "客服已更新报价。请查看等级报价卡后点击「匹配设计师」。")}
              {order.status === "matching" &&
                (order.clientMatch?.pools?.length ||
                order.clientMatch?.trackPools?.length
                  ? "请从备选设计师中确认人选；确认后将向对方发送接单邀请。项目信息已锁定，不可再修改。"
                  : "已进入匹配，项目信息不可再修改。请确认备选设计师。")}
              {order.status === "pending_designer_accept" &&
                "已向设计师发送接单邀请；对方同意后进入签约，拒绝则系统自动改派。"}
              {order.status === "cancelled" &&
                "本订单已取消，仅可查看，不可操作。"}
            </div>
          </Card>

          {!cancelled && order.status === "pending_quote" &&
          order.quote &&
          !order.levelQuotes?.length ? (
            <Card className="space-y-3 p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                待办操作
              </div>
              <Button
                variant="brand"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => confirmOrderQuoteRequest(order.id),
                    "报价已确认，已通知管理员分配设计师",
                  )
                }
              >
                确认报价并提交匹配
              </Button>
            </Card>
          ) : null}

          {!cancelled &&
            (needsClientSign(order) ||
            isPendingFinalSettlement(order) ||
            (canPayOrderStages(order) &&
              (!isTimeBilledOrder(order) &&
                order.stages.some(
                  (s) => s.status === "pending" || s.status === "frozen",
                )) ||
              (isTimeBilledOrder(order) &&
                order.stages.some((s) => s.status === "pending")))) && (
            <Card className="space-y-3 p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                待办操作
              </div>
              {needsClientSign(order) && (
                <Button
                  variant="brand"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => signOrderRequest(order.id),
                      "合同已签署，请等待设计师签约后支付预付款",
                    )
                  }
                >
                  签署电子合同
                </Button>
              )}
              {isPendingFinalSettlement(order) && (
                <Button
                  variant="brand"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => confirmFinalSettlementRequest(order.id),
                      "已确认最终服务完成，项目已结案",
                    )
                  }
                >
                  最终服务完成
                </Button>
              )}
              {canPayOrderStages(order) && !isTimeBilledOrder(order) &&
                order.stages.map((s) => {
                  if (s.status === "pending") {
                    return (
                      <Button
                        key={s.id}
                        variant="brand"
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        onClick={() =>
                          setPayTarget({
                            stageId: s.id,
                            name: s.name,
                            amount: s.amount,
                          })
                        }
                      >
                        支付 {s.name}（{formatCurrency(s.amount)}）
                      </Button>
                    );
                  }
                  if (s.status === "frozen") {
                    return (
                      <Button
                        key={s.id}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () => releaseStageRequest(order.id, s.id),
                            `${s.name}已确认验收，款项已解冻`,
                          )
                        }
                      >
                        确认验收 {s.name}
                      </Button>
                    );
                  }
                  return null;
                })}
              {canPayOrderStages(order) && isTimeBilledOrder(order) &&
                order.stages
                  .filter((s) => s.status === "pending")
                  .map((s) => (
                    <Button
                      key={s.id}
                      variant="brand"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        setPayTarget({
                          stageId: s.id,
                          name: s.name,
                          amount: s.amount,
                        })
                      }
                    >
                      支付 {s.name}（{formatCurrency(s.amount)}）
                    </Button>
                  ))}
            </Card>
          )}

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              电子合同
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-ink-20 p-3">
              <FileSignature className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="text-sm font-medium text-ink">
                  {order.contractId || "尚未生成"}
                </div>
                <div className="text-xs text-ink-60">
                  {isContractFullySigned(order)
                    ? "已签署 · 永久存档"
                    : order.contractId
                      ? "已生成 · 待签署完成"
                      : "尚未生成"}
                </div>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/contracts/${order.contractId || "preview"}`}>
                在线查阅合同
              </Link>
            </Button>
          </Card>

          <Card className="space-y-2 p-5 text-xs text-ink-60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              每笔款项进入 30 天托管期,验收无误自动解冻可提现。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              超过 30 天委托人无异议,系统自动确认成果无误。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              最后一笔费用支付后 30 天内可评价设计师，逾期评论关闭。
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
          await submitOrderReviewRequest(order.id, payload);
          push({ title: "评价已提交，感谢你的反馈", variant: "success" });
          refresh();
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
  if (isOrderCancelled(order) || !allOrderStagesPaid(order)) return null;
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
            "最后一笔费用已支付，可对设计师评分并填写评论。"}
      </div>
      {needsClientReview(order) ? (
        <Button variant="brand" size="sm" className="w-full" onClick={onReview}>
          去评价设计师
        </Button>
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
