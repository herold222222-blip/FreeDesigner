"use client";

import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";
import { resolveBountyPaymentStages } from "@/lib/bounty-payment-stages";
import type { Bounty } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

export function BountyPaymentStagesList({
  bounty,
  className,
}: {
  bounty: Pick<Bounty, "reward" | "paymentStages">;
  className?: string;
}) {
  const stages = resolveBountyPaymentStages(bounty);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium text-ink-60">付款阶段</div>
      <PaymentEscrowHint />
      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div
            key={`${stage.name}-${index}`}
            className="rounded-xl border border-ink-20 bg-white px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">
                {stage.name}
              </span>
              <span className="shrink-0 tabular-nums text-ink-60">
                {stage.ratio}% · {formatCurrency(Math.round((bounty.reward * stage.ratio) / 100))}
              </span>
            </div>
            {stage.note ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-50">{stage.note}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
