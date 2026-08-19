import { landscapeConstructionPaymentStageRatios } from "@/lib/landscape-payment-stages";
import { LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES } from "@/lib/constants";
import type { BillingMode, Order, ServiceMode } from "@/lib/types";
export type ScanPricingMode = "hourly" | "fixed";

export interface ScanPaymentStageDraft {
  id: string;
  name: string;
  ratio: number;
  note?: string;
}

export type ScanOrderStatus =
  | "pending_designer_confirm"
  | "pending_contract"
  | "pending_prepay"
  | "in_service"
  | "rejected";

export interface ScanOrder {
  id: string;
  designerId: string;
  clientId: string;
  createdAt: string;
  status: ScanOrderStatus;
  pricingMode: ScanPricingMode;
  serviceMode: ServiceMode;
  billingMode?: BillingMode;
  workDays?: number;
  months?: number;
  unitDaily?: number;
  unitMonthly?: number;
  fixedAmount?: number;
  title: string;
  description: string;
  paymentStages: ScanPaymentStageDraft[];
  designerNote?: string;
  contractId: string;
  totalAmount: number;
  signedByClient: boolean;
  signedByDesigner: boolean;
  prepayPaid: boolean;
  rejectReason?: string;
}

export const SCAN_PAYMENT_PRESETS: { label: string; stages: Omit<ScanPaymentStageDraft, "id">[] }[] = [
  {
    label: "常规委托 · 30 / 40 / 30",
    stages: landscapeConstructionPaymentStageRatios().map((s) => ({
      name: s.name,
      ratio: Math.round(s.ratio * 100),
    })),
  },
  {
    label: "两阶段 · 50 / 50",
    stages: [
      { name: "预付款", ratio: 50 },
      { name: "验收尾款", ratio: 50 },
    ],
  },
  {
    label: "全款预付",
    stages: [{ name: "预付款 · 100%", ratio: 100 }],
  },
];

export function newStageId() {
  return `stg_${Math.random().toString(36).slice(2, 8)}`;
}

export function stagesWithIds(
  stages: Omit<ScanPaymentStageDraft, "id">[],
): ScanPaymentStageDraft[] {
  return stages.map((s) => ({ ...s, id: newStageId() }));
}

export function defaultPaymentStages(): ScanPaymentStageDraft[] {
  return stagesWithIds(
    LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES.map((s) => ({
      name: s.name,
      ratio: Math.round(s.ratio * 100),
      note: s.note,
    })),
  );
}

/** 从委托人提交的说明中解析直填费用参考价 */
export function parseScanClientReferenceAmount(description: string): number | null {
  const m = description.match(/委托人填写费用[：:]\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
export function paymentStagesTotalRatio(stages: ScanPaymentStageDraft[]) {
  return stages.reduce((sum, s) => sum + s.ratio, 0);
}

export function paymentStagesValid(stages: ScanPaymentStageDraft[]) {
  if (stages.length < 1) return false;
  if (stages.some((s) => !s.name.trim() || s.ratio <= 0)) return false;
  return paymentStagesTotalRatio(stages) === 100;
}

export function stagesToAmounts(
  stages: ScanPaymentStageDraft[],
  total: number,
): ScanPaymentStageDraft[] & { amount?: number }[] {
  return stages.map((s) => ({
    ...s,
    amount: Math.round((total * s.ratio) / 100),
  }));
}

export function buildScanOrderPath(designerId: string) {
  return `/scan-order/${designerId}`;
}

export function getScanOrderUrl(designerId: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${buildScanOrderPath(designerId)}`;
}

export function isScanSourceOrder(
  order: Pick<Order, "orderSource">,
): boolean {
  return order.orderSource === "scan";
}

export function isScanAwaitingDesignerQuote(
  order: Pick<Order, "orderSource" | "status" | "scanQuoteProposedAt">,
): boolean {
  return (
    isScanSourceOrder(order) &&
    order.status === "pending_schedule" &&
    !order.scanQuoteProposedAt
  );
}

export function isScanAwaitingClientQuoteConfirm(
  order: Pick<Order, "orderSource" | "status" | "scanQuoteProposedAt">,
): boolean {
  return (
    isScanSourceOrder(order) &&
    order.status === "pending_schedule" &&
    Boolean(order.scanQuoteProposedAt)
  );
}

/** 扫码订单待设计师报价时，订单详情不展示付款阶段时间线 */
export function shouldHideScanPaymentTimeline(
  order: Pick<Order, "orderSource" | "status" | "scanQuoteProposedAt" | "stages">,
): boolean {
  return isScanAwaitingDesignerQuote(order);
}

/** 设计师端：待报价或已提交待委托人确认时，不展示付款阶段时间线 */
export function shouldHideDesignerScanPaymentTimeline(
  order: Pick<Order, "orderSource" | "status" | "scanQuoteProposedAt" | "stages">,
): boolean {
  return (
    isScanAwaitingDesignerQuote(order) || isScanAwaitingClientQuoteConfirm(order)
  );
}

/** 扫码订单在待确认档期阶段的展示文案（报价前 / 待委托人确认） */
export function scanQuoteStatusLabel(
  order: Pick<Order, "orderSource" | "status" | "scanQuoteProposedAt">,
): string | null {
  if (isScanAwaitingDesignerQuote(order)) return "待设计师报价";
  if (isScanAwaitingClientQuoteConfirm(order)) return "待确认费用";
  return null;
}

export function computeScanOrderTotal(input: {
  pricingMode: ScanPricingMode;
  billingMode?: BillingMode;
  unitDaily?: number;
  unitMonthly?: number;
  workDays?: number;
  months?: number;
  fixedAmount?: number;
}): number {
  if (input.pricingMode === "fixed") {
    return Math.max(0, input.fixedAmount ?? 0);
  }
  if (input.billingMode === "monthly") {
    return Math.max(0, (input.unitMonthly ?? 0) * Math.max(input.months ?? 0, 0));
  }
  return Math.max(0, (input.unitDaily ?? 0) * Math.max(input.workDays ?? 0, 0));
}

export const SCAN_ORDER_STATUS_LABEL: Record<ScanOrderStatus, string> = {
  pending_designer_confirm: "待设计师确认",
  pending_contract: "待签署合同",
  pending_prepay: "待付预付款",
  in_service: "服务进行中",
  rejected: "已拒绝",
};
