"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderProjectWorkCalendar } from "@/components/domain/order-project-work-calendar";
import { OrderMonthlyServiceCalendar } from "@/components/domain/order-monthly-service-calendar";
import { ServiceExtensionDialog } from "@/components/domain/service-extension-dialog";
import { StageParticipantDeliverables } from "@/components/domain/stage-participant-deliverables";
import { useDesigner, useDesigners, useServiceProviders } from "@/lib/use-data";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { useSessionStore } from "@/store/session-store";
import type { Order, PaymentStage } from "@/lib/types";
import { isContractFullySigned, isOrderCancelled } from "@/lib/order-lifecycle";
import { getActivePaymentStageId, getStagePaymentDeadline } from "@/lib/order-payment-overdue";
import { PaymentDeadlineNote } from "@/components/domain/payment-deadline-note";
import { resolveStagePaymentSplits } from "@/lib/stage-payment-splits";
import {
  DAILY_BILLING_RULE,
  MONTHLY_BILLING_RULE_FULL,
  buildDailyPaymentItems,
  buildMonthlyPaymentItems,
  canRequestServiceExtension,
  canTerminateService,
  formatPartialMonthSettlementHint,
  formatServiceExtensionDeadline,
  getEffectiveServiceEnd,
  getExtensionRule,
  getMonthlyUnitFee,
  getOrderScheduleEvents,
  getTerminationRule,
  type ServiceExtensionRecord,
  type TimeBillingPaymentItem,
} from "@/lib/time-billing";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  CalendarRange,
  Check,
  Clock,
  StopCircle,
} from "lucide-react";

const PAYMENT_STATUS_META: Record<
  string,
  { label: string; variant: "muted" | "blue" | "violet" | "emerald" | "amber" }
> = {
  pending: { label: "待支付", variant: "amber" },
  paid: { label: "已支付", variant: "blue" },
  frozen: { label: "已托管", variant: "violet" },
  released: { label: "已结算", variant: "emerald" },
  settled: { label: "已结算", variant: "emerald" },
  due: { label: "待付尾款", variant: "amber" },
};

export function OrderServiceControlCard({
  order,
  perspective = "client",
  className,
}: {
  order: Order;
  perspective?: "client" | "designer";
  className?: string;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [extensions, setExtensions] = useState<ServiceExtensionRecord[]>([]);
  const [extendOpen, setExtendOpen] = useState(false);
  const isMonthly = order.billingMode === "monthly";
  const monthlyFee = getMonthlyUnitFee(order);
  const cancelled = isOrderCancelled(order);
  const contractSigned = isContractFullySigned(order);
  const isDesignerView = perspective === "designer";
  const actionsEnabled = contractSigned && !cancelled && !isDesignerView;
  const deadlineOpen = canRequestServiceExtension(order, extensions);
  const extensionOpen = actionsEnabled && deadlineOpen;
  const extensionDeadline = formatServiceExtensionDeadline(order, extensions);
  const serviceEnd = getEffectiveServiceEnd(order, extensions);
  const canTerminate = actionsEnabled && canTerminateService(order);

  const handleExtensionSubmit = (record: ServiceExtensionRecord) => {
    setExtensions((prev) => [...prev, record]);
    push({
      title: "延长服务申请已提交",
      description: `延长 ${record.units} ${record.unitType === "month" ? "个月" : "个半天"}，预估 ${formatCurrency(record.amount)}。新服务结束日 ${formatDate(record.extendedEndAt)}，待设计师确认。`,
      variant: "success",
    });
  };

  const handleTerminate = () => {
    if (!canTerminate) {
      push({
        title: "已过终止时限",
        description: getTerminationRule(order),
        variant: "destructive",
      });
      return;
    }
    push({
      title: "已发起终止结算",
      description: isMonthly
        ? formatPartialMonthSettlementHint(monthlyFee)
        : "设计师确认后将按实际服务工时结算尾款。",
    });
  };

  return (
    <>
      {extensions.map((ext) => (
        <div
          key={ext.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">
                延长服务 ·{" "}
                {ext.units}
                {ext.unitType === "month" ? " 个月" : " 个半天"}
              </span>
              <Badge variant="muted">待设计师确认</Badge>
            </div>
            <p className="text-xs text-ink-60">
              延长至 {formatDate(ext.extendedEndAt)} · 预估{" "}
              {formatCurrency(ext.amount)}
            </p>
          </div>
        </div>
      ))}
      <div
        className={cn(
          "rounded-xl border border-ink-20 bg-ink-20/10 p-4 space-y-3",
          className,
        )}
      >
        {isDesignerView ? (
          <p className="text-xs text-ink-50">
            延长与终止由委托人发起，确认后将同步到本页日历与付款安排。
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!extensionOpen}
              onClick={() => setExtendOpen(true)}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> 延长服务
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canTerminate}
              onClick={handleTerminate}
            >
              <StopCircle className="h-3.5 w-3.5" /> 终止服务并结算
            </Button>
          </div>
        )}
        {!isDesignerView && !contractSigned && !cancelled ? (
          <p className="text-xs text-ink-40">
            双方完成电子签约后，方可支付、延长或终止服务。
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-ink-60">
          {getExtensionRule(order)}
          {extensionDeadline && deadlineOpen ? (
            <span className="mt-1 block text-amber-700">
              在 {extensionDeadline}前可以申请延长服务时间
              {serviceEnd ? `（本次服务截止 ${formatDate(serviceEnd)}）` : ""}
            </span>
          ) : extensionDeadline ? (
            <span className="mt-1 block text-rose-600">
              已过本次延长申请截止（{extensionDeadline}）
            </span>
          ) : null}
        </p>
        <p className="text-xs text-ink-50">{getTerminationRule(order)}</p>
      </div>
      {isDesignerView ? null : (
        <ServiceExtensionDialog
          open={extendOpen}
          onOpenChange={setExtendOpen}
          order={order}
          extensions={extensions}
          onSubmit={handleExtensionSubmit}
        />
      )}
    </>
  );
}

export function OrderScheduleBillingPanel({
  order,
  onPayStage,
  paying,
  embedded,
  perspective = "client",
  hideServiceControls,
  onReviseStage,
  onConfirmStage,
  revising,
}: {
  order: Order;
  onPayStage?: (item: TimeBillingPaymentItem) => void;
  paying?: boolean;
  embedded?: boolean;
  perspective?: "client" | "designer";
  hideServiceControls?: boolean;
  onReviseStage?: (payload: {
    stageId: string;
    fileId?: string;
    fileName?: string;
    description: string;
    attachments: { name: string; url?: string; size?: number }[];
  }) => void;
  revising?: boolean;
  onConfirmStage?: (stageId: string) => void;
}) {
  const designerId = order.designerId;
  const { data: designer } = useDesigner(designerId);
  const { data: designers } = useDesigners();
  const { data: serviceProviders } = useServiceProviders();
  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);
  const getDesigner = useMemo(
    () => (id: string) => designers.find((d) => d.id === id),
    [designers],
  );
  const getServiceProvider = useMemo(
    () => (id: string) => serviceProviders.find((p) => p.id === id),
    [serviceProviders],
  );

  const [pendingPayItem, setPendingPayItem] = useState<TimeBillingPaymentItem | null>(null);

  useEffect(() => {
    if (designer) hydrateFromDesigner(designer);
  }, [designer, hydrateFromDesigner]);

  const scheduleEvents = useMemo(
    () => getOrderScheduleEvents(getEvents(designerId), order),
    [getEvents, designerId, order],
  );

  const isMonthly = order.billingMode === "monthly";
  const paymentItems = useMemo(
    () =>
      isMonthly
        ? buildMonthlyPaymentItems(order)
        : buildDailyPaymentItems(order),
    [order, isMonthly],
  );

  const monthlyFee = getMonthlyUnitFee(order);
  const ruleText = isMonthly ? MONTHLY_BILLING_RULE_FULL : DAILY_BILLING_RULE;
  const cancelled = isOrderCancelled(order);
  const contractSigned = isContractFullySigned(order);
  const isDesignerView = perspective === "designer";
  const actionsEnabled = contractSigned && !cancelled && !isDesignerView;
  const activeStageId = getActivePaymentStageId(order);
  const isDaily = order.billingMode === "daily";

  const resolveItemStage = (item: TimeBillingPaymentItem): PaymentStage | undefined => {
    if (item.stageId) return order.stages.find((s) => s.id === item.stageId);
    if (item.id === "final") return order.stages[1];
    return undefined;
  };

  const handlePayClick = (item: TimeBillingPaymentItem) => {
    if (!onPayStage) return;
    const stage = resolveItemStage(item);
    const needsDeliverable = isDaily && item.id === "final";
    const hasFiles = (stage?.deliverables?.length ?? 0) > 0;
    if (needsDeliverable && !hasFiles) {
      setPendingPayItem(item);
      return;
    }
    onPayStage(item);
  };

  const body = (
    <>
      {embedded ? (
        <p className="mb-5 text-sm text-ink-60">{ruleText}</p>
      ) : (
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            工作日历 & 付款
          </h2>
          <p className="mt-1 text-sm text-ink-60">{ruleText}</p>
        </div>
      )}

      {isMonthly ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">按月工时日历</h3>
            <p className="mt-1 text-xs text-ink-60">
              红色为工作日服务（不含周末与法定节假日）；灰色为休息日；琥珀色「付」为支付节点（首月预付为开始服务日前 3 天，此后每月 25 日 17:00 前；遇周末或节假日提前至前一个工作日）。
            </p>
          </div>
          <OrderMonthlyServiceCalendar order={order} />
        </div>
      ) : (
        <OrderProjectWorkCalendar events={scheduleEvents} />
      )}

      {isDesignerView ? null : (
      <>
      <Separator className="my-6" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-ink-60" />
          付款安排
        </div>

        <div className="space-y-3">
          {paymentItems.map((item) => {
            const meta =
              PAYMENT_STATUS_META[item.status] ?? PAYMENT_STATUS_META.pending;
            const stage = resolveItemStage(item);
            const isActive = Boolean(
              item.stageId && activeStageId && item.stageId === activeStageId,
            );
            const showPay =
              !isDesignerView &&
              onPayStage &&
              item.stageId &&
              isActive &&
              (item.status === "pending" || item.status === "due");
            const isBalance = isDaily && item.id === "final";
            const paymentDeadline = stage
              ? getStagePaymentDeadline(order, stage)
              : null;
            const splits =
              stage && !isDesignerView
                ? resolveStagePaymentSplits(order, stage)
                : [];
            const showParticipants = Boolean(stage && !isDesignerView);

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border bg-white p-4 transition-shadow",
                  isActive
                    ? "border-brand ring-2 ring-brand/20 shadow-md"
                    : "border-ink-20",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {item.label}
                      </span>
                      {isActive ? (
                        <Badge variant="brand">当前阶段</Badge>
                      ) : null}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    {item.hint ? (
                      <p className="text-xs text-ink-60">{item.hint}</p>
                    ) : null}
                    {paymentDeadline ? (
                      <PaymentDeadlineNote deadline={paymentDeadline} />
                    ) : null}
                    {isBalance &&
                    stage &&
                    stage.status === "pending" &&
                    !stage.deliverablesConfirmedAt ? (
                      <p className="text-xs text-ink-50">
                        本阶段请设计师上传成果或确认单（图片 / PDF）。委托人可确认后支付。
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-ink">
                      {formatCurrency(item.amount)}
                    </span>
                    {showPay ? (
                      <Button
                        variant="brand"
                        size="sm"
                        disabled={paying || !actionsEnabled}
                        onClick={() => handlePayClick(item)}
                      >
                        支付
                      </Button>
                    ) : item.status === "settled" ||
                      item.status === "frozen" ||
                      item.status === "paid" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : null}
                  </div>
                </div>

                {stage && showParticipants ? (
                  <StageParticipantDeliverables
                    order={order}
                    stage={stage}
                    getDesigner={getDesigner}
                    getServiceProvider={getServiceProvider}
                    forceShow
                    compact
                    splits={splits}
                    showFiles={isBalance}
                    unlocked={
                      stage.status === "released" ||
                      stage.status === "frozen" ||
                      stage.status === "paid"
                    }
                    onConfirm={
                      isBalance && actionsEnabled && onConfirmStage
                        ? () => onConfirmStage(stage.id)
                        : undefined
                    }
                    confirmDisabled={!actionsEnabled}
                    onRevise={
                      isBalance && actionsEnabled && onReviseStage
                        ? ({ file, description, attachments }) =>
                            onReviseStage({
                              stageId: stage.id,
                              fileId: file.id,
                              fileName: file.name,
                              description,
                              attachments,
                            })
                        : undefined
                    }
                    reviseDisabled={!actionsEnabled || revising}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {hideServiceControls ? null : (
          <OrderServiceControlCard order={order} perspective={perspective} />
        )}

        {isMonthly ? (
          <p className="rounded-xl border border-ink-20 bg-ink-20/10 px-4 py-3 text-xs text-ink-60">
            <CalendarRange className="mr-1 inline h-3.5 w-3.5" />
            {formatPartialMonthSettlementHint(monthlyFee)}
          </p>
        ) : null}
      </div>
      </>
      )}

      <Dialog
        open={!!pendingPayItem}
        onOpenChange={(open) => {
          if (!open) setPendingPayItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认支付本阶段费用</DialogTitle>
            <DialogDescription>
              当前设计师未上传任何成果或者确认单，是否确认并去支付该阶段费用？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPayItem(null)}>
              取消
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                if (pendingPayItem) onPayStage?.(pendingPayItem);
                setPendingPayItem(null);
              }}
            >
              确认并支付
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return body;
  return <Card className="p-7">{body}</Card>;
}
