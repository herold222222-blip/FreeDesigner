"use client";

import { Card } from "@/components/ui/card";
import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";
import type { PlatformPaymentStageDef } from "@/lib/landscape-payment-stages";
import { cn, formatCurrency } from "@/lib/utils";
import { CircleDollarSign } from "lucide-react";

export function PlatformPaymentStagesPreview({
  title = "付款阶段（平台标准）",
  description,
  stages,
  totalAmount,
  className,
}: {
  title?: string;
  description?: string;
  stages: PlatformPaymentStageDef[];
  /** 有金额时展示各阶段参考金额；扫码下单前无报价则仅展示比例与条件 */
  totalAmount?: number;
  className?: string;
}) {
  if (!stages.length) return null;

  const showAmounts = typeof totalAmount === "number" && totalAmount > 0;

  return (
    <Card className={cn("space-y-3 p-5", className)}>
      <div className="flex items-start gap-2">
        <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          {description ? (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-60">{description}</p>
          ) : null}
          <PaymentEscrowHint className="mt-1.5" />
        </div>
      </div>
      <ul className="space-y-2">
        {stages.map((stage, i) => (
          <li
            key={`${stage.name}-${i}`}
            className="rounded-xl border border-ink-20 bg-ink-20/15 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {i + 1}. {stage.name} · {Math.round(stage.ratio * 100)}%
              </span>
              {showAmounts ? (
                <span className="text-sm font-semibold tabular-nums text-brand">
                  {formatCurrency(Math.round(totalAmount * stage.ratio))}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-60">{stage.note}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
