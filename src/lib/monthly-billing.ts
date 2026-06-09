import type { PaymentStage } from "@/lib/types";
import { formatMonthLabel } from "@/lib/designer-schedule";
import { formatDate } from "@/lib/utils";

/** 按月雇佣：每月几号前支付下月服务费 */
export const MONTHLY_PREPAY_DAY = 25;

export const MONTHLY_BILLING_RULE =
  "首月签约预付，此后每月 25 日 17:00 前支付下一个月服务费";

export function formatMonthlyDueHint(stage: PaymentStage): string | null {
  if (!stage.dueAt) return null;
  return `请于 ${formatDate(stage.dueAt)} 前支付（提前支付下月费用）`;
}

export function isMonthlyPrepayStage(stage: PaymentStage, index: number) {
  return index === 0 && stage.name.includes("首月");
}

/** 某雇佣月份对应的预付截止日（上月 25 号） */
export function monthlyPrepayDueAt(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const day = String(MONTHLY_PREPAY_DAY).padStart(2, "0");
  const month = String(prevMonth).padStart(2, "0");
  return `${prevYear}-${month}-${day}T00:00:00+08:00`;
}

/** 按月雇佣：首月预付 + 每月一期服务费 */
export function buildMonthlyStages(
  orderId: string,
  totalAmount: number,
  selectedMonths: string[],
): PaymentStage[] {
  const n = selectedMonths.length;
  if (n === 0) return [];

  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;

  return selectedMonths.map((monthKey, i) => {
    const amount = base + (i === n - 1 ? remainder : 0);
    const isFirst = i === 0;
    return {
      id: `${orderId}_s${i + 1}`,
      name: isFirst
        ? `首月预付（${formatMonthLabel(monthKey)}）`
        : `${formatMonthLabel(monthKey)}服务费`,
      amount,
      ratio: 1 / n,
      status: "pending",
      ...(isFirst ? {} : { dueAt: monthlyPrepayDueAt(monthKey) }),
    };
  });
}
