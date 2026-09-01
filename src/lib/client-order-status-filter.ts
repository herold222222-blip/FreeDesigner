import {
  CLIENT_DEFAULT_TAB_PRIORITY,
  adminClientAllSortRank,
  compareByCreatedAtDesc,
  isActiveSupervisionOrderWithClientReview,
  isAwaitingClientPaymentOrder,
  isAwaitingClientSignOrder,
  isAwaitingDesignerSignOrder,
  isAwaitingMatchOrder,
  isAwaitingReviewOrder,
  isInProgressSupervisionOrder,
  isInRevisionSupervisionOrder,
  isMatchingInProgressOrder,
  scanMatchesSupervision,
  type OrderSupervisionStatus,
} from "@/lib/order-supervision";
import { isAwaitingClientReviewOrder } from "@/lib/client-review";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";

export type ClientOrderStatusFilter = OrderSupervisionStatus;

export const CLIENT_PLATFORM_STATUS_TABS: {
  value: ClientOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_payment", label: "待支付" },
  { value: "awaiting_match", label: "待匹配" },
  { value: "matching", label: "匹配中" },
  { value: "pending_client_sign", label: "待签约" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_client_review", label: "待评价" },
  { value: "pending_designer_sign", label: "待设计师签约" },
  { value: "in_revision", label: "返修中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

/** 委托人定向下单：无平台匹配，待确认对应常规的「匹配中」 */
export const CLIENT_DIRECTED_STATUS_TABS: {
  value: ClientOrderStatusFilter;
  label: string;
}[] = CLIENT_PLATFORM_STATUS_TABS.filter(
  (t) => t.value !== "awaiting_match",
).map((t) => (t.value === "matching" ? { ...t, label: "待确认匹配" } : t));

export const CLIENT_DIRECTED_TAB_PRIORITY: ClientOrderStatusFilter[] = [
  "pending_payment",
  "pending_review",
  "pending_client_review",
  "pending_client_sign",
  "pending_designer_sign",
  "in_revision",
  "matching",
  "in_progress",
  "all",
];

export { CLIENT_DEFAULT_TAB_PRIORITY };

function orderMatchesClientStatus(
  order: NonNullable<UnifiedProjectItem["order"]>,
  status: ClientOrderStatusFilter,
): boolean {
  switch (status) {
    case "all":
      return isActiveSupervisionOrderWithClientReview(order);
    case "in_progress":
      return (
        isInProgressSupervisionOrder(order) &&
        !isAwaitingClientReviewOrder(order)
      );
    case "pending_payment":
      return isAwaitingClientPaymentOrder(order);
    case "awaiting_match":
      return isAwaitingMatchOrder(order);
    case "matching":
      return isMatchingInProgressOrder(order);
    case "pending_client_sign":
      return isAwaitingClientSignOrder(order);
    case "pending_designer_sign":
      return isAwaitingDesignerSignOrder(order);
    case "pending_review":
      return isAwaitingReviewOrder(order);
    case "pending_client_review":
      return isAwaitingClientReviewOrder(order);
    case "in_revision":
      return isInRevisionSupervisionOrder(order);
    case "completed":
      return order.status === "completed" && !isAwaitingClientReviewOrder(order);
    case "cancelled":
      return order.status === "cancelled";
    default:
      return false;
  }
}

export function filterItemsByClientStatus(
  items: UnifiedProjectItem[],
  status: ClientOrderStatusFilter,
): UnifiedProjectItem[] {
  const filtered = items.filter((item) => {
    if (item.order) return orderMatchesClientStatus(item.order, status);
    if (item.scan) {
      return scanMatchesSupervision(item.scan, status, "client");
    }
    if (status === "all") {
      return item.status !== "completed" && item.status !== "cancelled";
    }
    return false;
  });

  if (status === "all") {
    return filtered.sort((a, b) => {
      if (a.order && b.order) {
        const rank = adminClientAllSortRank(a.order) - adminClientAllSortRank(b.order);
        if (rank !== 0) return rank;
      }
      return compareByCreatedAtDesc(a, b);
    });
  }
  return filtered;
}

export function clientStatusCounts(
  items: UnifiedProjectItem[],
): Record<ClientOrderStatusFilter, number> {
  const counts = Object.fromEntries(
    CLIENT_PLATFORM_STATUS_TABS.map((t) => [t.value, 0]),
  ) as Record<ClientOrderStatusFilter, number>;
  for (const tab of CLIENT_PLATFORM_STATUS_TABS) {
    counts[tab.value] = filterItemsByClientStatus(items, tab.value).length;
  }
  return counts;
}
