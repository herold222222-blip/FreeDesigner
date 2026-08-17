import { buildMonthlyStages } from "@/lib/monthly-billing";
import type { BillingMode, Order, PaymentStage } from "@/lib/types";

function areaMilestoneStages(orderId: string, total: number): PaymentStage[] {
  const prepay = Math.round(total * 0.3);
  const mid = Math.round(total * 0.4);
  const final = total - prepay - mid;
  return [
    {
      id: `${orderId}_s1`,
      name: "预付款",
      amount: prepay,
      ratio: 0.3,
      status: "pending",
    },
    {
      id: `${orderId}_s2`,
      name: "中期成果",
      amount: mid,
      ratio: 0.4,
      status: "pending",
    },
    {
      id: `${orderId}_s3`,
      name: "尾款验收",
      amount: final,
      ratio: 0.3,
      status: "pending",
    },
  ];
}

/** 按工时：签约预付 30% + 服务结束后合同尾款 70% */
function dailyRetainStages(orderId: string, total: number): PaymentStage[] {
  const prepay = Math.round(total * 0.3);
  const final = total - prepay;
  return [
    {
      id: `${orderId}_s1`,
      name: "预付款",
      amount: prepay,
      ratio: 0.3,
      status: "pending",
    },
    {
      id: `${orderId}_s2`,
      name: "合同尾款",
      amount: final,
      ratio: 0.7,
      status: "pending",
    },
  ];
}

export function buildDefaultPaymentStages(input: {
  orderId: string;
  totalAmount: number;
  billingMode: BillingMode;
  selectedMonths?: string[];
}): PaymentStage[] {
  if (input.billingMode === "monthly" && input.selectedMonths?.length) {
    return buildMonthlyStages(
      input.orderId,
      input.totalAmount,
      input.selectedMonths,
    );
  }
  if (input.billingMode === "daily" || input.billingMode === "monthly") {
    return dailyRetainStages(input.orderId, input.totalAmount);
  }
  return areaMilestoneStages(input.orderId, input.totalAmount);
}

function isUnpaidStage(stage: PaymentStage): boolean {
  return !stage.status || stage.status === "pending";
}

/** 预付款（首阶段）：签约后直接支付，不上传、不确认成果 */
export function isPrepaymentStage(
  order: Pick<Order, "stages">,
  stage: Pick<PaymentStage, "id" | "name">,
): boolean {
  const index = order.stages.findIndex((s) => s.id === stage.id);
  if (index === 0) return true;
  return stage.name.includes("预付款") || stage.name.includes("首月");
}

/** 成果已确认但仍停在 pending_review 时，纠正为进行中（随后按待支付筛选） */
export function normalizeConfirmedReviewStatus(order: Order): boolean {
  if (order.status !== "pending_review") return false;
  const reviewStages = order.stages.filter((s) => !isPrepaymentStage(order, s));
  const hasUnconfirmed = reviewStages.some(
    (s) =>
      !s.deliverablesConfirmedAt &&
      (s.status === "pending" || s.status === "frozen") &&
      ((s.deliverables?.length ?? 0) > 0 || s.status === "pending"),
  );
  const hasConfirmed = reviewStages.some((s) => Boolean(s.deliverablesConfirmedAt));
  if (hasUnconfirmed || !hasConfirmed) return false;
  order.status = "in_progress";
  return true;
}

function looksLikeAreaMilestones(stages: PaymentStage[]): boolean {
  if (stages.length !== 3) return false;
  return stages.some(
    (s) => s.name.includes("中期") || s.name.includes("尾款验收"),
  );
}

/** 工时单误用了面积项目的三阶段（预付款 / 中期成果 / 尾款验收） */
export function orderHasIncorrectTimeBillingStages(
  order: Pick<Order, "billingMode" | "stages" | "selectedMonths">,
): boolean {
  if (order.billingMode !== "daily" && order.billingMode !== "monthly") {
    return false;
  }
  if (!order.stages.length) return false;
  if (!order.stages.every(isUnpaidStage)) return false;

  if (order.billingMode === "monthly" && order.selectedMonths?.length) {
    return order.stages.length !== order.selectedMonths.length;
  }

  if (looksLikeAreaMilestones(order.stages)) return true;
  if (order.stages.length !== 2) return true;
  if (
    order.stages.length === 2 &&
    !order.stages.some((s) => s.name.includes("尾款"))
  ) {
    return true;
  }
  return false;
}

export function resolveOrderPaymentStages(order: Order): PaymentStage[] {
  if (!orderHasIncorrectTimeBillingStages(order)) return order.stages;
  return buildDefaultPaymentStages({
    orderId: order.id,
    totalAmount: order.totalAmount,
    billingMode: order.billingMode,
    selectedMonths: order.selectedMonths,
  });
}

/** 纠正尚未付款的工时单阶段；有改动返回 true */
export function normalizePaymentStages(order: Order): boolean {
  if (!orderHasIncorrectTimeBillingStages(order)) return false;
  order.stages = resolveOrderPaymentStages(order);
  return true;
}
