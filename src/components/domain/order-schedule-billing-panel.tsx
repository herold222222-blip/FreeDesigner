"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrderProjectWorkCalendar } from "@/components/domain/order-project-work-calendar";
import { ServiceExtensionDialog } from "@/components/domain/service-extension-dialog";
import { useDesigner } from "@/lib/use-data";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";
import { useSessionStore } from "@/store/session-store";
import type { Order } from "@/lib/types";
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

export function OrderScheduleBillingPanel({
  order,
  onPayStage,
  paying,
}: {
  order: Order;
  onPayStage?: (item: TimeBillingPaymentItem) => void;
  paying?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const designerId = order.designerId;
  const { data: designer } = useDesigner(designerId);
  const hydrateFromDesigner = useDesignerCalendarStore((s) => s.hydrateFromDesigner);
  const getEvents = useDesignerCalendarStore((s) => s.getEvents);

  const [extensions, setExtensions] = useState<ServiceExtensionRecord[]>([]);
  const [extendOpen, setExtendOpen] = useState(false);

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
  const extensionOpen = canRequestServiceExtension(order, extensions);
  const extensionDeadline = formatServiceExtensionDeadline(order, extensions);
  const serviceEnd = getEffectiveServiceEnd(order, extensions);
  const canTerminate = canTerminateService(order);

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
    <Card className="p-7">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          工作日历 & 付款
        </h2>
        <p className="mt-1 text-sm text-ink-60">{ruleText}</p>
      </div>

      <OrderProjectWorkCalendar events={scheduleEvents} />

      <Separator className="my-6" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="h-4 w-4 text-ink-60" />
          付款安排
        </div>

        <div className="space-y-2">
          {paymentItems.map((item) => {
            const meta =
              PAYMENT_STATUS_META[item.status] ?? PAYMENT_STATUS_META.pending;
            const canPay =
              onPayStage &&
              item.stageId &&
              (item.status === "pending" || item.status === "due");

            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-20 bg-white p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {item.label}
                    </span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  {item.hint ? (
                    <p className="text-xs text-ink-60">{item.hint}</p>
                  ) : null}
                  {item.dueAt && item.status !== "settled" ? (
                    <p className="text-xs text-ink-40">
                      截止 {formatDateTime(item.dueAt)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-ink">
                    {formatCurrency(item.amount)}
                  </span>
                  {canPay ? (
                    <Button
                      variant="brand"
                      size="sm"
                      disabled={paying}
                      onClick={() => onPayStage(item)}
                    >
                      支付
                    </Button>
                  ) : item.status === "settled" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : null}
                </div>
              </div>
            );
          })}

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
        </div>

        <div className="rounded-xl border border-ink-20 bg-ink-20/10 p-4 space-y-3">
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
          <p className="text-xs leading-relaxed text-ink-60">
            {getExtensionRule(order)}
            {extensionDeadline && extensionOpen ? (
              <span className="mt-1 block text-amber-700">
                本次可申请至 {extensionDeadline}
                {serviceEnd ? `（当前服务结束 ${formatDate(serviceEnd)}）` : ""}
              </span>
            ) : !extensionOpen && extensionDeadline ? (
              <span className="mt-1 block text-rose-600">
                已过本次延长申请截止（{extensionDeadline}）
              </span>
            ) : null}
          </p>
          <p className="text-xs text-ink-50">{getTerminationRule(order)}</p>
        </div>

        {isMonthly ? (
          <p className="rounded-xl border border-ink-20 bg-ink-20/10 px-4 py-3 text-xs text-ink-60">
            <CalendarRange className="mr-1 inline h-3.5 w-3.5" />
            {formatPartialMonthSettlementHint(monthlyFee)}
          </p>
        ) : null}
      </div>

      <ServiceExtensionDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        order={order}
        extensions={extensions}
        onSubmit={handleExtensionSubmit}
      />
    </Card>
  );
}
