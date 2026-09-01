import {
  buildMonthlyStagesForOrder,
  getMonthlyHireMonthCount,
  resolveMonthlyServicePeriod,
} from "@/lib/monthly-billing";
import {
  normalizeCommerceSettings,
  type PlatformCommerceSettings,
} from "@/lib/platform-commerce";
import { landscapeConstructionPaymentStageRatios } from "@/lib/landscape-payment-stages";
import type { BillingMode, Order, PaymentStage } from "@/lib/types";

type MonthlyStageContext = Pick<
  Order,
  | "id"
  | "totalAmount"
  | "billingMode"
  | "selectedMonths"
  | "expectedDeliveryAt"
  | "onsiteSchedule"
  | "quote"
  | "levelQuotes"
>;

function normalizeRatio(r: number): number {
  return r > 1 ? r / 100 : r;
}

/** 按名称与比例生成付款阶段（ratio 为 0–1 或百分数） */
export function buildStagesFromRatios(
  orderId: string,
  total: number,
  defs: { name: string; ratio: number; note?: string }[],
): PaymentStage[] {
  if (!defs.length) return [];
  const normalized = defs.map((d) => ({
    name: d.name.trim() || "付款阶段",
    ratio: normalizeRatio(d.ratio),
    note: d.note?.trim() || undefined,
  }));
  const sum = normalized.reduce((s, d) => s + d.ratio, 0);
  const scale = sum > 0 ? 1 / sum : 1 / normalized.length;
  let allocated = 0;
  return normalized.map((d, i) => {
    const amount =
      i === normalized.length - 1
        ? Math.max(0, total - allocated)
        : Math.round(total * d.ratio * scale);
    allocated += amount;
    return {
      id: `${orderId}_s${i + 1}`,
      name: d.name,
      amount,
      ratio: d.ratio * scale,
      status: "pending" as const,
      note: d.note,
    };
  });
}

/** 按阶段比例把总金额拆到各阶段（末笔吃余数） */
export function allocateAmountsByRatio(total: number, ratios: number[]): number[] {
  if (!ratios.length || total <= 0) return ratios.map(() => 0);
  const normalized = ratios.map((r) => (r > 1 ? r / 100 : r));
  const sum = normalized.reduce((s, r) => s + r, 0);
  const scale = sum > 0 ? 1 / sum : 1 / normalized.length;
  let allocated = 0;
  return normalized.map((r, i) => {
    const amount =
      i === normalized.length - 1
        ? Math.max(0, total - allocated)
        : Math.round(total * r * scale);
    allocated += amount;
    return amount;
  });
}

function areaMilestoneStages(orderId: string, total: number): PaymentStage[] {
  return buildStagesFromRatios(
    orderId,
    total,
    landscapeConstructionPaymentStageRatios(),
  );
}

/** 按工时：签约预付 + 服务结束后合同尾款 */
function dailyRetainStages(
  orderId: string,
  total: number,
  prepayRatio = 0.3,
): PaymentStage[] {
  const ratio = Math.min(0.95, Math.max(0.05, prepayRatio));
  const prepay = Math.round(total * ratio);
  const final = total - prepay;
  return [
    {
      id: `${orderId}_s1`,
      name: "预付款",
      amount: prepay,
      ratio,
      status: "pending",
    },
    {
      id: `${orderId}_s2`,
      name: "合同尾款",
      amount: final,
      ratio: 1 - ratio,
      status: "pending",
    },
  ];
}

export function buildDefaultPaymentStages(input: {
  orderId: string;
  totalAmount: number;
  billingMode: BillingMode;
  selectedMonths?: string[];
  expectedDeliveryAt?: string;
  onsiteSchedule?: Order["onsiteSchedule"];
  quote?: Order["quote"];
  levelQuotes?: Order["levelQuotes"];
  commerce?: Partial<PlatformCommerceSettings> | null;
}): PaymentStage[] {
  if (input.billingMode === "monthly") {
    return buildMonthlyStagesForOrder(
      {
        id: input.orderId,
        totalAmount: input.totalAmount,
        billingMode: "monthly",
        selectedMonths: input.selectedMonths,
        expectedDeliveryAt: input.expectedDeliveryAt ?? "",
        onsiteSchedule: input.onsiteSchedule,
        quote: input.quote,
        levelQuotes: input.levelQuotes,
      },
      input.commerce,
    );
  }
  if (input.billingMode === "daily") {
    const prepayRatio = normalizeCommerceSettings(input.commerce).dailyPrepayRatio;
    return dailyRetainStages(input.orderId, input.totalAmount, prepayRatio);
  }
  return areaMilestoneStages(input.orderId, input.totalAmount);
}

export function buildDefaultPaymentStagesFromOrder(
  order: MonthlyStageContext,
  commerce?: Partial<PlatformCommerceSettings> | null,
): PaymentStage[] {
  return buildDefaultPaymentStages({
    orderId: order.id,
    totalAmount: order.totalAmount,
    billingMode: order.billingMode,
    selectedMonths: order.selectedMonths,
    expectedDeliveryAt: order.expectedDeliveryAt,
    onsiteSchedule: order.onsiteSchedule,
    quote: order.quote,
    levelQuotes: order.levelQuotes,
    commerce,
  });
}

function isUnpaidStage(stage: PaymentStage): boolean {
  return !stage.status || stage.status === "pending";
}

/** 预付款：签约后直接支付。按月各期均为预付 */
export function isPrepaymentStage(
  order: Pick<Order, "stages"> & { billingMode?: BillingMode },
  stage: Pick<PaymentStage, "id" | "name">,
): boolean {
  if (order.billingMode === "monthly") return true;
  const index = order.stages.findIndex((s) => s.id === stage.id);
  if (index === 0) return true;
  return stage.name.includes("预付款") || stage.name.includes("首月");
}

/**
 * 需要上传并确认成果的阶段。
 * 仅一笔全款时虽先付款，仍须确认最终成果后项目才算履约完成。
 */
export function stageRequiresDeliverables(
  order: Pick<Order, "stages"> & { billingMode?: BillingMode },
  stage: Pick<PaymentStage, "id" | "name">,
): boolean {
  if (order.billingMode === "monthly") return false;
  if (order.stages.length === 1) return true;
  return !isPrepaymentStage(order, stage);
}

/** 付款后仍可继续上传 / 确认成果（单阶段全款） */
export function allowsPostPaymentDeliverables(
  order: Pick<Order, "stages"> & { billingMode?: BillingMode },
  stage: Pick<PaymentStage, "id" | "status" | "name" | "deliverablesConfirmedAt">,
): boolean {
  if (!stageRequiresDeliverables(order, stage)) return false;
  if (order.stages.length !== 1) return false;
  return stage.status === "frozen" || stage.status === "paid";
}

/** 最后一笔需成果确认的阶段已确认最终成果 */
export function isLastDeliverablesConfirmed(
  order: Pick<Order, "stages" | "billingMode">,
): boolean {
  const reviewStages = order.stages.filter((s) =>
    stageRequiresDeliverables(order, s),
  );
  if (reviewStages.length === 0) {
    return order.billingMode === "monthly" && order.stages.length > 0;
  }
  return Boolean(reviewStages[reviewStages.length - 1]!.deliverablesConfirmedAt);
}

export function getLastDeliverablesConfirmedAt(
  order: Pick<Order, "stages" | "billingMode">,
): string | null {
  const reviewStages = order.stages.filter((s) =>
    stageRequiresDeliverables(order, s),
  );
  const last = reviewStages[reviewStages.length - 1];
  return last?.deliverablesConfirmedAt ?? null;
}

/** 成果已确认但仍停在 pending_review 时，纠正为进行中（随后按待支付筛选） */
export function normalizeConfirmedReviewStatus(order: Order): boolean {
  if (order.status !== "pending_review") return false;
  const reviewStages = order.stages.filter((s) =>
    stageRequiresDeliverables(order, s),
  );
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
    (s) => s.name.includes("中期") || s.name.includes("尾款"),
  );
}

function looksLikeDailyRetainStages(stages: PaymentStage[]): boolean {
  if (stages.length !== 2) return false;
  const names = stages.map((s) => s.name).join(" ");
  return names.includes("预付") && names.includes("尾款");
}

function looksLikeMonthlyHireStages(stages: PaymentStage[]): boolean {
  if (!stages.length) return false;
  if (stages.some((s) => s.name.includes("尾款") || s.name.includes("中期"))) {
    return false;
  }
  const first = stages[0]?.name ?? "";
  if (!first.includes("首月")) return false;
  if (stages.length === 1) return true;
  return stages
    .slice(1)
    .every(
      (s) =>
        s.name.includes("服务费") ||
        s.name.includes("个月") ||
        /\d{4}年\d{1,2}月/.test(s.name),
    );
}

function expectedMonthlyStageCount(
  order: Pick<
    Order,
    | "billingMode"
    | "selectedMonths"
    | "expectedDeliveryAt"
    | "onsiteSchedule"
    | "quote"
    | "levelQuotes"
  >,
): number {
  const months = resolveMonthlyServicePeriod(order)?.months.length ?? 0;
  if (months > 0) return months;
  const counted = Math.round(getMonthlyHireMonthCount(order));
  return counted > 0 ? counted : 0;
}

/** 工时单误用了面积三阶段，或按月单误用了 30/70 尾款 */
export function orderHasIncorrectTimeBillingStages(
  order: Pick<
    Order,
    | "billingMode"
    | "stages"
    | "selectedMonths"
    | "expectedDeliveryAt"
    | "onsiteSchedule"
    | "quote"
    | "levelQuotes"
  >,
): boolean {
  if (order.billingMode !== "daily" && order.billingMode !== "monthly") {
    return false;
  }
  if (!order.stages.length) return false;
  if (!order.stages.every(isUnpaidStage)) return false;

  if (order.billingMode === "monthly") {
    if (looksLikeDailyRetainStages(order.stages)) return true;
    if (looksLikeAreaMilestones(order.stages)) return true;
    if (!looksLikeMonthlyHireStages(order.stages)) return true;
    const expected = expectedMonthlyStageCount(order);
    return expected > 0 && order.stages.length !== expected;
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
  return buildDefaultPaymentStagesFromOrder(order);
}

/** 纠正尚未付款的工时单阶段；有改动返回 true */
export function normalizePaymentStages(order: Order): boolean {
  if (!orderHasIncorrectTimeBillingStages(order)) return false;
  order.stages = resolveOrderPaymentStages(order);
  return true;
}

function cutoffClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * 合同付款节点条件说明。
 * 扫码等场景优先用阶段自带 note；否则按计费方式套用商务规则。
 */
export function resolveStagePaymentCondition(
  order: Pick<Order, "billingMode" | "stages">,
  stage: Pick<PaymentStage, "id" | "name" | "note">,
  index: number,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  const custom = stage.note?.trim();
  if (custom) return custom;

  const s = normalizeCommerceSettings(commerce);
  const cutoff = cutoffClock(s.billingCutoffHour);
  const prepay = isPrepaymentStage(order, stage) || index === 0;

  if (order.billingMode === "monthly") {
    if (index === 0 || stage.name.includes("首月")) {
      return `甲方应于开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天 ${cutoff} 前支付本笔首月服务费；遇周末或法定节假日提前至前一个工作日。款项支付后由平台托管。`;
    }
    return `甲方应于每月 ${s.monthlyPrepayDay} 日 ${cutoff} 前预付下一月服务费；遇周末或法定节假日提前至前一个工作日。款项支付后由平台托管。`;
  }

  if (order.billingMode === "daily") {
    if (prepay) {
      return "甲方应于甲乙双方完成本合同电子签署后 2 个工作日内支付本笔预付款。预付款到账后启动服务并锁定档期，款项由平台托管。";
    }
    return `乙方完成本阶段服务并上传成果或确认单后，经甲方确认服务成果之日起 ${s.dailySettlementGraceDays} 日内付清本笔尾款。确认前不计算付款时限。款项支付后由平台托管。`;
  }

  if (prepay || stage.name.includes("预付")) {
    return "甲方应于甲乙双方完成本合同电子签署后 2 个工作日内支付本笔预付款。预付款到账后启动服务，款项由平台托管。";
  }
  if (stage.name.includes("中期")) {
    return "乙方上传本阶段成果并通过甲方确认后 5 个工作日内，甲方应支付本笔中期款。款项支付后由平台托管，验收期满无异议后结算。";
  }
  if (stage.name.includes("尾款") || index === order.stages.length - 1) {
    return "终稿或本阶段成果经甲方确认后 5 个工作日内，甲方应付清本笔尾款。款项支付后由平台托管，验收期满无异议后结算。";
  }
  return "乙方上传本阶段成果并通过甲方确认后 5 个工作日内，甲方应支付本笔款项。款项支付后由平台托管。";
}
