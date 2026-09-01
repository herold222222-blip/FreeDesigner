import { cn } from "@/lib/utils";

export const PAYMENT_ESCROW_HINT =
  "费用支付到平台托管，设计师提供成果后再支付到设计师，资金安全有保障，支持不满意退款。";

/** 各委托类型「付款阶段」标题下的托管说明 */
export function PaymentEscrowHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-ink-40", className)}>
      {PAYMENT_ESCROW_HINT}
    </p>
  );
}
