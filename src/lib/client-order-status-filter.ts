import {
  isPendingPaymentOrder,
} from "@/lib/client-order-focus";
import type { Order, OrderStatus } from "@/lib/types";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";
import { filterByStatus } from "@/lib/unified-project-list";

/** 委托人平台订单 · 状态筛选（含虚拟筛选项） */
export type ClientOrderStatusFilter =
  | OrderStatus
  | "all"
  | "pending_payment"
  | "pending_rating";

export const CLIENT_PLATFORM_STATUS_TABS: {
  value: ClientOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "matching", label: "待匹配设计师" },
  { value: "pending_contract", label: "待签约" },
  { value: "pending_payment", label: "待支付" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_rating", label: "待评价" },
  { value: "in_revision", label: "返修修改中" },
  { value: "completed", label: "已完成" },
  { value: "terminated", label: "已终止" },
];

/** 已完成但委托人尚未评价设计师 */
export function isPendingRatingOrder(order: Order): boolean {
  if (order.status !== "completed") return false;
  return order.clientReviewed !== true;
}

export function filterItemsByClientStatus(
  items: UnifiedProjectItem[],
  status: ClientOrderStatusFilter,
): UnifiedProjectItem[] {
  if (status === "all") return items;
  if (status === "pending_payment") {
    return items.filter((item) => {
      if (item.order) return isPendingPaymentOrder(item.order);
      return item.status === "pending_prepay";
    });
  }
  if (status === "pending_rating") {
    return items.filter(
      (item) => item.order && isPendingRatingOrder(item.order),
    );
  }
  return filterByStatus(items, status);
}

export function clientStatusCounts(
  items: UnifiedProjectItem[],
): Record<ClientOrderStatusFilter, number> {
  const counts = Object.fromEntries(
    CLIENT_PLATFORM_STATUS_TABS.map((t) => [t.value, 0]),
  ) as Record<ClientOrderStatusFilter, number>;
  counts.all = items.length;
  for (const item of items) {
    for (const tab of CLIENT_PLATFORM_STATUS_TABS) {
      if (tab.value === "all") continue;
      const matched = filterItemsByClientStatus([item], tab.value);
      if (matched.length > 0) counts[tab.value] += 1;
    }
  }
  return counts;
}
