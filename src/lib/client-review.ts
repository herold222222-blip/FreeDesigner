import type { Order, PaymentStage } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** 最后一笔费用支付后，委托人可评价的天数 */
export const CLIENT_REVIEW_DAYS = 30;

function addDaysIso(from: string, days: number): string {
  return new Date(
    new Date(from).getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function isStageClientPaid(
  stage: Pick<PaymentStage, "status">,
): boolean {
  return (
    stage.status === "frozen" ||
    stage.status === "paid" ||
    stage.status === "released"
  );
}

/** 项目全部费用已支付（含托管冻结 / 已解冻） */
export function allOrderStagesPaid(order: Pick<Order, "stages">): boolean {
  return (
    order.stages.length > 0 && order.stages.every(isStageClientPaid)
  );
}

/** 列表付款进度：已支付（含托管）金额占比 */
export function getOrderPaymentProgress(
  order: Pick<Order, "stages" | "totalAmount" | "status">,
): number {
  if (order.status === "completed") return 100;
  if (!order.totalAmount || order.stages.length === 0) return 0;
  const paidAmount = order.stages
    .filter(isStageClientPaid)
    .reduce((sum, stage) => sum + stage.amount, 0);
  return Math.min(100, Math.round((paidAmount / order.totalAmount) * 100));
}

export function getLastStagePaidAt(order: Pick<Order, "stages">): string | null {
  let latest: string | null = null;
  for (const stage of order.stages) {
    if (!isStageClientPaid(stage)) continue;
    const stamp = stage.paidAt || stage.releasedAt;
    if (!stamp) continue;
    if (!latest || new Date(stamp).getTime() > new Date(latest).getTime()) {
      latest = stamp;
    }
  }
  return latest;
}

/** 评价截止时间：最后一笔支付起 30 天 */
export function resolveReviewDeadlineAt(order: Order): string | null {
  if (!allOrderStagesPaid(order)) return null;
  const start = getLastStagePaidAt(order) || order.settlementConfirmedAt;
  if (start) return addDaysIso(start, CLIENT_REVIEW_DAYS);
  return order.reviewDeadlineAt ?? null;
}

export function isClientReviewClosed(order: Order): boolean {
  if (order.status === "cancelled") return false;
  if (order.clientReviewed) return false;
  if (!allOrderStagesPaid(order)) return false;
  if (order.reviewExpired) return true;
  const deadline = resolveReviewDeadlineAt(order);
  if (!deadline) return false;
  return new Date(deadline).getTime() <= Date.now();
}

/** 最后一笔费用已支付，且评价窗口仍有效 */
export function needsClientReview(order: Order): boolean {
  if (order.status === "cancelled") return false;
  if (order.clientReviewed) return false;
  if (!allOrderStagesPaid(order)) return false;
  if (order.reviewExpired) return false;
  const deadline = resolveReviewDeadlineAt(order);
  if (deadline && new Date(deadline).getTime() <= Date.now()) return false;
  return true;
}

/** 最后一笔费用已支付且尚未评价（30 天窗口内），用于列表「待评价」分类 */
export function isAwaitingClientReviewOrder(order: Order): boolean {
  return needsClientReview(order);
}

export function getClientReviewRemainingDays(order: Order): number | null {
  const deadline = resolveReviewDeadlineAt(order);
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatClientReviewWindow(order: Order): string | null {
  const deadline = resolveReviewDeadlineAt(order);
  if (!deadline) return null;
  if (order.clientReviewed) return "已提交评价";
  if (isClientReviewClosed(order)) {
    return "评论已关闭（支付完成后超过 30 天）";
  }
  const days = getClientReviewRemainingDays(order) ?? 0;
  const until = formatDate(deadline);
  if (days <= 1) return `评价将于 ${until} 关闭（即将截止）`;
  return `评价将于 ${until} 关闭（剩余 ${days} 天）`;
}

/** 读取时补齐评价截止（不写库；是否关闭由截止时间判定） */
export function hydrateClientReviewWindow(order: Order): void {
  if (order.status === "cancelled" || order.clientReviewed) return;
  if (!allOrderStagesPaid(order)) return;
  const deadline = resolveReviewDeadlineAt(order);
  if (!deadline) return;
  order.reviewDeadlineAt = deadline;
}
