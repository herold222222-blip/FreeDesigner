"use client";

import {
  bountyDesignerTakeHomeFromBounty,
  bountyInvoiceLabel,
} from "@/lib/bounty-invoice";
import type { Bounty, Role } from "@/lib/types";
import { cn, formatBountyReward } from "@/lib/utils";

export function BountyRewardAmount({
  bounty,
  viewerRole,
  showInvoice,
  className,
  amountClassName,
}: {
  bounty: Pick<Bounty, "reward" | "invoiceType">;
  viewerRole?: Role | "guest" | string | null;
  showInvoice?: boolean;
  className?: string;
  amountClassName?: string;
}) {
  const isDesigner = viewerRole === "designer";
  const takeHome = bountyDesignerTakeHomeFromBounty(bounty);

  return (
    <div className={className}>
      <div
        className={cn(
          "font-bold tracking-tight text-brand",
          amountClassName,
        )}
      >
        {formatBountyReward(bounty.reward)}
      </div>
      {isDesigner ? (
        <p className="mt-1 text-xs leading-relaxed text-rose-600">
          <span className="whitespace-nowrap">实际到手金额</span>
          <span className="mt-0.5 block whitespace-nowrap">
            {formatBountyReward(takeHome)}
          </span>
        </p>
      ) : showInvoice ? (
        <p className="mt-1 text-xs text-ink-50">
          发票 {bountyInvoiceLabel(bounty)}
        </p>
      ) : null}
    </div>
  );
}
