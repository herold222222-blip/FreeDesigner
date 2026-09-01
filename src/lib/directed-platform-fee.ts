import { PLATFORM_FEE_RATE, TAX_OPTIONS } from "@/lib/constants";
import type { Order, OrderSource } from "@/lib/types";

/** 定向下单 / 扫码下单：平台服务费基数 5% */
export const DIRECTED_PLATFORM_SERVICE_RATE = 0.05;
/** 未选发票时按默认 1% 普票税点 */
export const DEFAULT_TAX_POINT_RATE = 0.01;

export function isDirectedLikeOrderSource(
  source?: OrderSource | string | null,
) {
  return source === "directed" || source === "scan";
}

export function taxPointRateFromCoefficient(coefficient?: number | null) {
  if (coefficient == null || !Number.isFinite(coefficient)) {
    return DEFAULT_TAX_POINT_RATE;
  }
  const match = TAX_OPTIONS.find(
    (t) => Math.abs(t.coefficient - coefficient) < 0.001,
  );
  if (match) return taxPointRateFromLabel(match.label);
  if (coefficient > 1) {
    return Math.round((coefficient - 1) * 1000) / 1000;
  }
  return DEFAULT_TAX_POINT_RATE;
}

export function taxPointRateFromLabel(label?: string | null) {
  const m = label?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]) / 100;
  return DEFAULT_TAX_POINT_RATE;
}

export function taxPointRateFromOption(option?: {
  label?: string;
  coefficient?: number;
} | null) {
  if (option?.label) return taxPointRateFromLabel(option.label);
  return taxPointRateFromCoefficient(option?.coefficient);
}

export function directedPlatformFeeRate(taxPointRate?: number | null) {
  return (
    DIRECTED_PLATFORM_SERVICE_RATE + (taxPointRate ?? DEFAULT_TAX_POINT_RATE)
  );
}

export function orderTaxCoefficient(
  order: Pick<Order, "taxCoefficient" | "quote">,
) {
  const fromOrder = order.taxCoefficient;
  if (typeof fromOrder === "number" && fromOrder > 0) return fromOrder;
  const fromQuote = order.quote?.taxCoefficient;
  if (typeof fromQuote === "number" && fromQuote > 0) return fromQuote;
  return 1;
}

/** 结算 / 预计实收用的平台费率：定向/扫码为 5%+税点，其余沿用订单 feeRate */
export function resolveOrderPlatformFeeRate(
  order: Pick<Order, "orderSource" | "feeRate" | "taxCoefficient" | "quote">,
) {
  if (isDirectedLikeOrderSource(order.orderSource)) {
    return directedPlatformFeeRate(
      taxPointRateFromCoefficient(orderTaxCoefficient(order)),
    );
  }
  return order.feeRate ?? PLATFORM_FEE_RATE;
}

export function formatDirectedPlatformFeeLabel(taxPointRate?: number | null) {
  const tax = Math.round((taxPointRate ?? DEFAULT_TAX_POINT_RATE) * 100);
  const total = Math.round(
    directedPlatformFeeRate(taxPointRate ?? DEFAULT_TAX_POINT_RATE) * 100,
  );
  return `5% + ${tax}%税点（合计 ${total}%）`;
}

/** 含服务费报价 → 设计师实收：总额 ÷ (1 + 费率) */
export function netFromInclusiveFee(amount: number, feeRate: number) {
  const gross = Math.max(0, Math.round(amount) || 0);
  if (gross <= 0) return 0;
  if (!(feeRate > 0)) return gross;
  return Math.round(gross / (1 + feeRate));
}

export function platformFeeAmountFromOrder(
  order: Pick<Order, "orderSource" | "feeRate" | "taxCoefficient" | "quote">,
  amount: number,
) {
  const gross = Math.max(0, Math.round(amount) || 0);
  const rate = resolveOrderPlatformFeeRate(order);
  if (isDirectedLikeOrderSource(order.orderSource)) {
    return gross - netFromInclusiveFee(gross, rate);
  }
  return Math.round(gross * rate);
}
