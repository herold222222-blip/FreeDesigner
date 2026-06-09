import type { BillingMode, ServiceMode } from "@/lib/types";

export type ScanPricingMode = "hourly" | "fixed";

export interface ScanPaymentStageDraft {
  id: string;
  name: string;
  ratio: number;
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
    label: "三阶段 · 30 / 40 / 30",
    stages: [
      { name: "预付款", ratio: 30 },
      { name: "方案确认款", ratio: 40 },
      { name: "尾款", ratio: 30 },
    ],
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
  return stagesWithIds(SCAN_PAYMENT_PRESETS[0].stages);
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
