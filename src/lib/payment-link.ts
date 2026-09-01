import type { Order, PaymentStage } from "@/lib/types";
import { clientOrderDetailHref } from "@/lib/unified-project-list";

/** 委托人扫码支付的公开付款页链接 */
export function buildStagePaymentPageUrl(
  order: Pick<Order, "id" | "code" | "bountyId" | "orderSource">,
  stage: Pick<PaymentStage, "id" | "name" | "amount">,
  origin = "",
) {
  const params = new URLSearchParams({ payStage: stage.id });
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${clientOrderDetailHref(order)}?${params.toString()}`;
}
