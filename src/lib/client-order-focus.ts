import { getPayablePendingStage } from "@/lib/order-payment-overdue";
import type { Order, PaymentStage } from "@/lib/types";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";

export type ClientOrderFocus =
  | "pending_payment"
  | "pending_acceptance"
  | "pending_contract"
  | "after_sales";

export const CLIENT_ORDER_FOCUS_META: Record<
  ClientOrderFocus,
  { label: string; description: string; href: string }
> = {
  pending_payment: {
    label: "待支付的订单",
    description: "有待付款阶段的订单",
    href: "/client/orders?focus=pending_payment",
  },
  pending_acceptance: {
    label: "待确认成果的订单",
    description: "待验收或返修成果待确认的订单",
    href: "/client/orders?focus=pending_acceptance",
  },
  pending_contract: {
    label: "待签约的订单",
    description: "待签署电子合同或确认档期的订单",
    href: "/client/orders?focus=pending_contract",
  },
  after_sales: {
    label: "售后订单",
    description: "验收期内托管、返修或售后处理中的订单",
    href: "/client/orders?focus=after_sales",
  },
};

/** 有待付款阶段且已进入履约流程 */
export function isPendingPaymentOrder(order: Order): boolean {
  return getPayablePendingStage(order) !== null;
}

/** 待确认成果（含返修后待验收） */
export function isPendingAcceptanceOrder(order: Order): boolean {
  if (order.status === "pending_review") return true;
  return order.stages.some(
    (s) => s.status === "frozen" && (s.deliverables?.length ?? 0) > 0,
  );
}

/** 待成果确认阶段（列表特殊展示用） */
export function getPendingReviewStage(order: Order): PaymentStage | null {
  if (order.status !== "pending_review") return null;
  return (
    order.stages.find(
      (s) => s.status === "frozen" && (s.deliverables?.length ?? 0) > 0,
    ) ??
    order.stages.find((s) => s.status === "frozen") ??
    null
  );
}

/** 待签约 / 待确认档期 */
export function isPendingContractOrder(order: Order): boolean {
  return (
    order.status === "pending_contract" || order.status === "pending_schedule"
  );
}

/** 售后：验收期托管、返修流程、未结案返修单 */
export function isAfterSalesOrder(order: Order): boolean {
  if (order.status === "in_revision") return true;
  if (order.revisions.some((r) => r.status === "pending")) return true;
  return order.stages.some((s) => s.status === "frozen");
}

export function countClientOrderFocus(
  orders: Order[],
  focus: ClientOrderFocus,
): number {
  const matcher = CLIENT_ORDER_FOCUS_MATCHERS[focus];
  return orders.filter(matcher).length;
}

const CLIENT_ORDER_FOCUS_MATCHERS: Record<
  ClientOrderFocus,
  (order: Order) => boolean
> = {
  pending_payment: isPendingPaymentOrder,
  pending_acceptance: isPendingAcceptanceOrder,
  pending_contract: isPendingContractOrder,
  after_sales: isAfterSalesOrder,
};

export function orderMatchesClientFocus(
  order: Order,
  focus: ClientOrderFocus,
): boolean {
  return CLIENT_ORDER_FOCUS_MATCHERS[focus](order);
}

export function filterItemsByClientFocus(
  items: UnifiedProjectItem[],
  focus: ClientOrderFocus,
): UnifiedProjectItem[] {
  return items.filter((item) => {
    if (item.order) return orderMatchesClientFocus(item.order, focus);
    if (focus === "pending_contract") {
      return (
        item.kind === "draft" ||
        item.status === "pending_contract" ||
        item.status === "pending_designer_confirm" ||
        item.status === "pending_schedule"
      );
    }
    if (focus === "pending_payment") {
      return item.status === "pending_prepay";
    }
    return false;
  });
}

export function buildClientDashboardSummary(orders: Order[]): string {
  const pay = countClientOrderFocus(orders, "pending_payment");
  const accept = countClientOrderFocus(orders, "pending_acceptance");
  const contract = countClientOrderFocus(orders, "pending_contract");
  const after = countClientOrderFocus(orders, "after_sales");
  const parts: string[] = [];
  if (pay > 0) parts.push(`${pay} 个订单待支付`);
  if (accept > 0) parts.push(`${accept} 个订单待确认成果`);
  if (contract > 0) parts.push(`${contract} 个订单待签约`);
  if (after > 0) parts.push(`${after} 个售后订单`);
  if (parts.length === 0) return "暂无待办事项，可浏览设计师或发布新委托。";
  return `你有 ${parts.join("、")}。`;
}
