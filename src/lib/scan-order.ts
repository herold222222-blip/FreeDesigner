import { landscapeConstructionPaymentStageRatios } from "@/lib/landscape-payment-stages";
import { LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES } from "@/lib/constants";
import { formatMonthLabel } from "@/lib/designer-schedule";
import {
  formatIsoDateLabel,
  type MonthlyRangeQuote,
} from "@/lib/monthly-range-billing";
import {
  normalizeCommerceSettings,
  type PlatformCommerceSettings,
} from "@/lib/platform-commerce";
import type { BillingMode, Order, ServiceMode } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { isSelfOrderPendingClaim } from "@/lib/self-order-share";
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
      {
        name: "预付款",
        ratio: 50,
        note: "合同签订后支付，资金由平台托管。",
      },
      {
        name: "验收尾款",
        ratio: 50,
        note: "成果验收通过后支付。",
      },
    ],
  },
  {
    label: "全款预付",
    stages: [
      {
        name: "全款",
        ratio: 100,
        note: "双方签约后一次性支付，资金由平台托管。",
      },
    ],
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

/** 与常规委托按日一致：签约预付 + 服务结束后合同尾款 */
export function dailyTimePaymentStageDrafts(
  commerce?: Partial<PlatformCommerceSettings> | null,
): ScanPaymentStageDraft[] {
  const s = normalizeCommerceSettings(commerce);
  const prepay = Math.round(s.dailyPrepayRatio * 100);
  return stagesWithIds([
    {
      name: "预付款",
      ratio: prepay,
      note: "签约后预付，确认后开工",
    },
    {
      name: "合同尾款",
      ratio: 100 - prepay,
      note: `服务结束后 ${s.dailySettlementGraceDays} 日内付清`,
    },
  ]);
}

function ratiosFromAmounts(amounts: number[]): number[] {
  const n = amounts.length;
  if (n === 0) return [];
  if (n === 1) return [100];
  const total = amounts.reduce((sum, amt) => sum + amt, 0);
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((amt) => (amt / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remain = 100 - floors.reduce((sum, amt) => sum + amt, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < remain; k++) {
    const idx = order[k % n]?.i;
    if (idx != null) out[idx] += 1;
  }
  for (let i = 0; i < n; i++) {
    if (out[i] !== 0) continue;
    const donor = out.findIndex((v) => v > 1);
    if (donor < 0) break;
    out[i] += 1;
    out[donor] -= 1;
  }
  return out;
}

/** 按月起止日折算：各月一段，金额占比对应整月或工作日折算 */
export function monthlyRangePaymentStageDrafts(
  quote: MonthlyRangeQuote | null | undefined,
  commerce?: Partial<PlatformCommerceSettings> | null,
): ScanPaymentStageDraft[] {
  const s = normalizeCommerceSettings(commerce);
  const segs = (quote?.segments ?? []).filter((seg) => seg.amount > 0);
  if (!quote || segs.length === 0) {
    return stagesWithIds([
      {
        name: "首月预付",
        ratio: 100,
        note: `开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天预付首月；此后每月 ${s.monthlyPrepayDay} 日前预付下月。请先在日历中点选开始日期与结束日期。`,
      },
    ]);
  }
  const ratios = ratiosFromAmounts(segs.map((seg) => seg.amount));
  return stagesWithIds(
    segs.map((seg, i) => {
      const isFirst = i === 0;
      const periodNote = seg.isFull
        ? `${formatMonthLabel(seg.monthKey)}整月`
        : `${formatMonthLabel(seg.monthKey)} ${formatIsoDateLabel(seg.from)}～${formatIsoDateLabel(seg.to)} 折算 ${seg.workdays} 工作日`;
      return {
        name: isFirst
          ? `首月预付（${formatMonthLabel(seg.monthKey)}）`
          : `${formatMonthLabel(seg.monthKey)}服务费`,
        ratio: ratios[i] ?? 0,
        note: isFirst
          ? `${periodNote}。开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天预付，资金由平台托管。`
          : `${periodNote}。每月 ${s.monthlyPrepayDay} 日前预付该月服务费，资金由平台托管。`,
      };
    }),
  );
}

/** 与常规委托按月一致：已选月份各一期（首月预付 + 此后每月服务费） */
export function monthlyTimePaymentStageDrafts(
  selectedMonths: string[],
  commerce?: Partial<PlatformCommerceSettings> | null,
): ScanPaymentStageDraft[] {
  const s = normalizeCommerceSettings(commerce);
  const months = [...selectedMonths].filter(Boolean).sort();
  if (months.length === 0) {
    return stagesWithIds([
      {
        name: "首月预付",
        ratio: 100,
        note: `开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天预付首月；此后每月 ${s.monthlyPrepayDay} 日前预付下月。请先在日历中选择雇佣月份。`,
      },
    ]);
  }
  const n = months.length;
  let allocated = 0;
  return stagesWithIds(
    months.map((key, i) => {
      const ratio = i === n - 1 ? 100 - allocated : Math.round(100 / n);
      allocated += ratio;
      const isFirst = i === 0;
      return {
        name: isFirst
          ? `首月预付（${formatMonthLabel(key)}）`
          : `${formatMonthLabel(key)}服务费`,
        ratio,
        note: isFirst
          ? `开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天预付该月，资金由平台托管。`
          : `每月 ${s.monthlyPrepayDay} 日前预付该月服务费，资金由平台托管。`,
      };
    }),
  );
}

/** 从委托人提交的说明中解析直填费用或设计师标准预估 */
export function parseScanClientReferenceAmount(description: string): number | null {
  const patterns = [
    /委托人填写费用[：:]\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/,
    /按设计师标准取费预估\s*[¥￥]?\s*([\d,]+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = description.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

export function draftsFromOrderPaymentStages(
  stages: { id: string; name: string; ratio: number; note?: string }[] | undefined,
): ScanPaymentStageDraft[] | null {
  if (!stages?.length) return null;
  return stages.map((s) => ({
    id: s.id || newStageId(),
    name: s.name,
    ratio: Math.round((s.ratio > 1 ? s.ratio : s.ratio * 100) || 0),
    note: s.note ?? "",
  }));
}
export function paymentStagesTotalRatio(stages: ScanPaymentStageDraft[]) {
  return stages.reduce((sum, s) => sum + s.ratio, 0);
}

export function paymentStagesValid(stages: ScanPaymentStageDraft[]) {
  if (stages.length < 1) return false;
  if (
    stages.some(
      (s) => !s.name.trim() || !s.note?.trim() || s.ratio <= 0,
    )
  ) {
    return false;
  }
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

export type ScanQuoteLastActor = "client" | "designer";

export type ScanQuoteTerms = {
  total: number;
  stages: { name: string; ratio: number; note: string }[];
};

function ratioToPercent(ratio: number): number {
  return Math.round((ratio > 1 ? ratio : ratio * 100) || 0);
}

/** 把总费用与付款阶段规范成可比较的条款（比例为 0–100 整数） */
export function normalizeScanQuoteTerms(
  totalAmount: number,
  stages: { name: string; ratio: number; note?: string }[],
): ScanQuoteTerms {
  return {
    total: Math.round(Number(totalAmount) || 0),
    stages: stages.map((s) => ({
      name: s.name.trim(),
      ratio: ratioToPercent(s.ratio),
      note: (s.note ?? "").trim(),
    })),
  };
}

export function scanQuoteTermsFromOrder(
  order: Pick<Order, "totalAmount" | "stages" | "description">,
): ScanQuoteTerms {
  const referenced =
    order.totalAmount > 0
      ? order.totalAmount
      : parseScanClientReferenceAmount(order.description ?? "") ?? 0;
  return normalizeScanQuoteTerms(
    referenced,
    (order.stages ?? []).map((s) => ({
      name: s.name,
      ratio: s.ratio,
      note: s.note,
    })),
  );
}

export function scanQuoteTermsEqual(a: ScanQuoteTerms, b: ScanQuoteTerms): boolean {
  if (a.total !== b.total) return false;
  if (a.stages.length !== b.stages.length) return false;
  return a.stages.every((stage, i) => {
    const other = b.stages[i];
    return (
      stage.name === other.name &&
      stage.ratio === other.ratio &&
      stage.note === other.note
    );
  });
}

/** 当前草稿是否相对订单上的费用 / 阶段 / 付款条件有改动 */
export function directedScanQuoteHasChanges(
  order: Pick<Order, "totalAmount" | "stages" | "description">,
  totalAmount: number,
  stages: ScanPaymentStageDraft[],
): boolean {
  return !scanQuoteTermsEqual(
    scanQuoteTermsFromOrder(order),
    normalizeScanQuoteTerms(totalAmount, stages),
  );
}

export function describeScanQuoteDiff(
  prev: ScanQuoteTerms,
  next: ScanQuoteTerms,
): string[] {
  const lines: string[] = [];
  if (prev.total !== next.total) {
    lines.push(
      `项目总费用由 ${formatCurrency(prev.total)} 调整为 ${formatCurrency(next.total)}`,
    );
  }
  const max = Math.max(prev.stages.length, next.stages.length);
  for (let i = 0; i < max; i++) {
    const a = prev.stages[i];
    const b = next.stages[i];
    const idx = i + 1;
    if (!a && b) {
      lines.push(
        `新增第 ${idx} 阶段「${b.name}」（${b.ratio}%${
          b.note ? `，付款条件：${b.note}` : ""
        }）`,
      );
      continue;
    }
    if (a && !b) {
      lines.push(`删除第 ${idx} 阶段「${a.name}」`);
      continue;
    }
    if (!a || !b) continue;
    if (a.name !== b.name) {
      lines.push(`第 ${idx} 阶段名称由「${a.name}」改为「${b.name}」`);
    }
    if (a.ratio !== b.ratio) {
      lines.push(
        `第 ${idx} 阶段「${b.name}」比例由 ${a.ratio}% 调整为 ${b.ratio}%`,
      );
    }
    if (a.note !== b.note) {
      if (!a.note) {
        lines.push(`第 ${idx} 阶段「${b.name}」补充付款条件：${b.note}`);
      } else if (!b.note) {
        lines.push(
          `第 ${idx} 阶段「${b.name}」清空了付款条件（原为：${a.note}）`,
        );
      } else {
        lines.push(
          `第 ${idx} 阶段「${b.name}」付款条件由「${a.note}」改为「${b.note}」`,
        );
      }
    }
  }
  return lines;
}

type ScanQuoteWaitOrder = Pick<
  Order,
  | "orderSource"
  | "status"
  | "scanQuoteProposedAt"
  | "scanQuoteLastActor"
  | "selfOrderPendingClaim"
  | "clientId"
>;

export function isScanAwaitingDesignerQuote(order: ScanQuoteWaitOrder): boolean {
  if (!isScanSourceOrder(order) || order.status !== "pending_schedule") {
    return false;
  }
  if (isSelfOrderPendingClaim(order)) return false;
  if (!order.scanQuoteProposedAt) return true;
  return order.scanQuoteLastActor === "client";
}

export function isScanAwaitingClientQuoteConfirm(
  order: ScanQuoteWaitOrder,
): boolean {
  if (!isScanSourceOrder(order) || order.status !== "pending_schedule") {
    return false;
  }
  if (isSelfOrderPendingClaim(order)) return false;
  if (!order.scanQuoteProposedAt) return false;
  return order.scanQuoteLastActor !== "client";
}

/** 设计师端：待报价或已提交待委托人确认时，不展示付款阶段时间线 */
export function shouldHideDesignerScanPaymentTimeline(
  order: ScanQuoteWaitOrder & Pick<Order, "stages">,
): boolean {
  return (
    isScanAwaitingDesignerQuote(order) || isScanAwaitingClientQuoteConfirm(order)
  );
}

/** 扫码 / 定向待确认阶段：委托人发给设计师、设计师发给委托人，统一为「待确认匹配」 */
export function scanQuoteStatusLabel(
  order: ScanQuoteWaitOrder,
): string | null {
  if (isSelfOrderPendingClaim(order)) return "待确认匹配";
  if (isScanAwaitingDesignerQuote(order)) return "待确认匹配";
  if (isScanAwaitingClientQuoteConfirm(order)) return "待确认匹配";
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
