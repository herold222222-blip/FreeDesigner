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
  confirmFinalSettlementRequest,
  submitOrderReviewRequest,
} from "@/lib/api-client";
import { StagePaymentDialog } from "@/components/domain/stage-payment-dialog";
import { OrderReviewDialog } from "@/components/domain/order-review-dialog";
import { DisputeFilingDialog } from "@/components/domain/dispute-filing-dialog";
import {
  canPayOrderStages,
  isContractFullySigned,
  isPendingFinalSettlement,
  needsClientReview,
  needsClientSign,
} from "@/lib/order-lifecycle";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesignerName } from "@/components/domain/designer-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { OrderStatusBadge, SpecialtyBadge } from "@/components/domain/status-badges";
import { StageTimeline } from "@/components/domain/stage-timeline";
import { OrderScheduleBillingPanel } from "@/components/domain/order-schedule-billing-panel";
import { isTimeBilledOrder } from "@/lib/time-billing";
import { OrderTrackAssignmentsPanel } from "@/components/domain/order-track-assignments";
import {
  OrderValueAddedBadges,
  OrderValueAddedServicesPanel,
} from "@/components/domain/order-value-added-services";
import { ORDER_STATUS_META } from "@/lib/constants";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileSignature,
  Info,
  MapPin,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  DAILY_BILLING_RULE,
  MONTHLY_BILLING_RULE_FULL,
} from "@/lib/time-billing";
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
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      push({ title: successTitle, variant: "success" });
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

  const meta = ORDER_STATUS_META[order.status];

  return (
    <div className="space-y-6">
      <Link
        href="/client/orders"
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回平台订单
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SpecialtyBadge specialty={order.specialty} />
                  <OrderStatusBadge status={order.status} />
                  <OrderValueAddedBadges order={order} />
                  <ProjectIdCopy code={order.code} />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {order.title}
                </h1>
                <p className="max-w-2xl text-sm text-ink-60">
                  {order.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-60">订单总额</div>
                <div className="text-2xl font-semibold tracking-tight text-ink">
                  {formatCurrency(order.totalAmount)}
                </div>
              </div>
            </div>

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
          </Card>

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

          <OrderTrackAssignmentsPanel order={order} getDesigner={getDesigner} />

          {(order.withAuditService || order.withProjectManagement) ? (
            <OrderValueAddedServicesPanel order={order} />
          ) : null}

          {isTimeBilledOrder(order) ? (
            <OrderScheduleBillingPanel
              order={order}
              paying={busy}
              onPayStage={(item) => {
                if (!item.stageId) return;
                setPayTarget({
                  stageId: item.stageId,
                  name: item.label,
                  amount: item.amount,
                });
              }}
            />
          ) : (
            <Card className="p-7">
              <div className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  付款进度 & 阶段成果
                </h2>
                <p className="mt-1 text-sm text-ink-60">
                  设计师上传成果文件后,你可在线免费预览。预览满意后付款解锁下载。
                </p>
              </div>
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
            </Card>
          )}

          <Card className="p-7">
            <div className="mb-5 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-ink-60" />
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                沟通记录
              </h2>
            </div>
            <div className="space-y-3">
              {order.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-4 text-sm ${
                    m.authorRole === "system"
                      ? "border border-dashed border-ink-20 text-ink-60"
                      : "bg-ink-20/30 text-ink"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-ink-40">
                    <span className="font-medium">
                      {m.authorRole === "system"
                        ? "系统"
                        : m.authorRole === "client"
                          ? "我"
                          : designer?.name}
                    </span>
                    <span>· {formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                placeholder="输入消息与设计师沟通..."
                className="flex h-11 w-full rounded-xl border border-ink-20 bg-white px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
              />
              <Button>
                <Send className="h-4 w-4" /> 发送
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              对接设计师
            </div>
            {designer ? (
              <Link
                href={`/designers/${designer.id}`}
                className="mt-3 flex items-start gap-3"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={designer.avatar} alt={designer.name} />
                  <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink hover:text-brand">
                    <DesignerName designer={designer} />
                  </div>
                  <div className="text-xs text-ink-60">{designer.tagline}</div>
                </div>
              </Link>
            ) : null}
            <Button variant="outline" size="sm" className="mt-4 w-full">
              <MessageSquare className="h-3.5 w-3.5" /> 与设计师对话
            </Button>
          </Card>

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              电子合同
            </div>
            {order.contractId ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-ink-20 p-3">
                  <FileSignature className="mt-0.5 h-4 w-4 text-brand" />
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {order.contractId}
                    </div>
                    <div className="text-xs text-ink-60">
                      已签署 · 永久存档
                    </div>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/contracts/${order.contractId}`}>在线查阅合同</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3 text-sm text-ink-60">合同生成中...</div>
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
              {order.status === "in_progress" &&
                "设计师正在推进项目,等待阶段成果上传。"}
              {order.status === "pending_review" &&
                "设计师已上传阶段成果,请预览并付款解锁下载。"}
              {order.status === "in_revision" &&
                "设计师已收到返修需求,正在优化中。"}
              {order.status === "completed" &&
                "项目已结案,所有资金已结算并解冻。"}
              {order.status === "pending_contract" &&
                (isContractFullySigned(order)
                  ? "双方已签约，请支付预付款启动项目。"
                  : "电子合同已生成，等待双方签署。")}
              {order.status === "pending_schedule" &&
                "委托人已提交档期申请,请确认后进入合同签署。"}
              {order.status === "matching" &&
                "悬赏招标中,等待设计师报名匹配。"}
            </div>
          </Card>

          {(needsClientSign(order) ||
            isPendingFinalSettlement(order) ||
            needsClientReview(order) ||
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
                      "已确认最终服务完成，欢迎评价设计师",
                    )
                  }
                >
                  最终服务完成
                </Button>
              )}
              {needsClientReview(order) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setReviewOpen(true)}
                >
                  去评价设计师
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

          <Card className="space-y-2 p-5 text-xs text-ink-60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              {order.billingMode === "monthly"
                ? MONTHLY_BILLING_RULE_FULL
                : order.billingMode === "daily"
                  ? DAILY_BILLING_RULE
                  : "所有阶段付款进入平台 30 天验收期托管,确保你的售后权益。"}
            </div>
          </Card>
        </aside>
      </div>

      <OrderReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        designerName={designer?.name ?? "设计师"}
        onSubmit={async (payload) => {
          await submitOrderReviewRequest(order.id, payload);
          push({ title: "评价已提交，感谢你的反馈", variant: "success" });
          refresh();
        }}
      />

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

      {payTarget && (
        <StagePaymentDialog
          open={!!payTarget}
          onOpenChange={(v) => {
            if (!v) setPayTarget(null);
          }}
          orderId={order.id}
          stageId={payTarget.stageId}
          stageName={payTarget.name}
          amount={payTarget.amount}
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
