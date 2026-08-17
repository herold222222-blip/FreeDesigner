"use client";

import type { StagePaymentDeadline } from "@/lib/order-payment-overdue";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PaymentDeadlineBadge({
  deadline,
}: {
  deadline: StagePaymentDeadline;
}) {
  if (deadline.overdue) {
    return (
      <Badge variant="rose">
        支付超时 · 已超过 {deadline.overdueLabel}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-300 text-amber-800">
      支付时限 {formatDate(deadline.dueAt)}
    </Badge>
  );
}

export function PaymentDeadlineNote({
  deadline,
  className,
}: {
  deadline: StagePaymentDeadline;
  className?: string;
}) {
  if (deadline.overdue) {
    return (
      <p className={cn("text-xs text-rose-600", className)}>
        支付超时 · 已超过 {deadline.overdueLabel}
        <span className="mt-0.5 block text-[11px] text-rose-500/80">
          {deadline.ruleLabel}（截止 {formatDateTime(deadline.dueAt)}）
        </span>
      </p>
    );
  }
  return (
    <p className={cn("text-xs text-amber-800", className)}>
      支付时限 {formatDateTime(deadline.dueAt)}
      <span className="mt-0.5 block text-[11px] text-ink-40">
        {deadline.ruleLabel}
      </span>
    </p>
  );
}
