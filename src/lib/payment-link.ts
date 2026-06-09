import type { Order, PaymentStage } from "@/lib/types";

/** 委托人扫码支付的公开付款页链接 */
export function buildStagePaymentPageUrl(
  order: Pick<Order, "id" | "code">,
  stage: Pick<PaymentStage, "id" | "name" | "amount">,
  origin = "",
) {
  const params = new URLSearchParams({ payStage: stage.id });
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/client/orders/${order.id}?${params.toString()}`;
}
