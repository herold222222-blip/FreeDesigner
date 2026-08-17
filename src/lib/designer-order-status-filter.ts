import type { Order, OrderStatus } from "@/lib/types";
import type { ScanOrder } from "@/lib/scan-order";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";
import {
  DESIGNER_DEFAULT_TAB_PRIORITY,
  compareByCreatedAtDesc,
  designerAllSortRank,
  isActiveSupervisionOrder,
  isAwaitingClientPaymentOrder,
  isDesignerAwaitingConfirmOrder,
  isDesignerAwaitingReviewOrder,
  isDesignerMatchingOthersOrder,
  isDesignerNeedsSignOrder,
  isInProgressSupervisionOrder,
  isInRevisionSupervisionOrder,
  scanMatchesSupervision,
  type OrderSupervisionStatus,
} from "@/lib/order-supervision";
import { isAwaitingClientReviewOrder } from "@/lib/client-review";

export type DesignerOrderStatusFilter = OrderSupervisionStatus;

export const DESIGNER_PROJECT_STATUS_TABS: {
  value: DesignerOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_payment", label: "待委托人支付" },
  { value: "awaiting_confirm", label: "待确认匹配" },
  { value: "matching", label: "匹配中" },
  { value: "pending_client_sign", label: "待委托人签约" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_designer_sign", label: "待签约" },
  { value: "in_revision", label: "返修中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

export { DESIGNER_DEFAULT_TAB_PRIORITY };

/** 有待项目时需高亮的状态 Tab */
export const DESIGNER_STATUS_TAB_HIGHLIGHT: DesignerOrderStatusFilter[] = [
  "awaiting_confirm",
  "pending_designer_sign",
  "in_revision",
];

export const DESIGNER_ORDER_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending_quote: "待匹配",
  matching: "待匹配",
  pending_designer_accept: "待确认匹配",
  pending_schedule: "待确认匹配",
  pending_contract: "待签约",
  in_progress: "进行中",
  pending_review: "待成果确认",
  in_revision: "返修中",
  completed: "已完成",
  cancelled: "已取消",
  terminated: "已终止",
};

export function isPendingFeeConfirmOrder(order: Order): boolean {
  return order.status === "pending_schedule";
}

export function isPendingFeeConfirmScan(scan: ScanOrder): boolean {
  return scan.status === "pending_designer_confirm";
}

export function isPendingRevisionOrder(order: Order): boolean {
  return order.status === "in_revision";
}

/** 委托人已付款托管、待验收解冻（设计师待收款） */
export function isPendingCollectionOrder(order: Order): boolean {
  if (order.status !== "in_progress") return false;
  return order.stages.some((s) => s.status === "frozen");
}

export function orderMatchesDesignerStatus(
  order: Order,
  status: DesignerOrderStatusFilter,
  designerId: string,
): boolean {
  switch (status) {
    case "all":
      return isActiveSupervisionOrder(order);
    case "in_progress":
      return isInProgressSupervisionOrder(order);
    case "pending_payment":
      return isAwaitingClientPaymentOrder(order);
    case "awaiting_confirm":
      return isDesignerAwaitingConfirmOrder(order, designerId);
    case "matching":
      return isDesignerMatchingOthersOrder(order, designerId);
    case "pending_client_sign":
      return (
        order.status === "pending_contract" &&
        order.designerSignedContract === true &&
        order.clientSignedContract !== true
      );
    case "pending_designer_sign":
      return isDesignerNeedsSignOrder(order);
    case "pending_review":
      return isDesignerAwaitingReviewOrder(order, designerId);
    case "pending_client_review":
      return false;
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

export function filterItemsByDesignerStatus(
  items: UnifiedProjectItem[],
  status: DesignerOrderStatusFilter,
  designerId?: string,
): UnifiedProjectItem[] {
  const id =
    designerId ||
    items.find((i) => i.order)?.order?.designerId ||
    items.find((i) => i.scan)?.scan?.designerId ||
    "";

  const filtered = items.filter((item) => {
    if (item.kind === "order" && item.order) {
      return orderMatchesDesignerStatus(item.order, status, id);
    }
    if (item.kind === "scan" && item.scan) {
      return scanMatchesSupervision(item.scan, status, "designer");
    }
    return false;
  });

  if (status === "all") {
    return filtered.sort((a, b) => {
      if (a.order && b.order) {
        const rank =
          designerAllSortRank(a.order, id) - designerAllSortRank(b.order, id);
        if (rank !== 0) return rank;
      }
      return compareByCreatedAtDesc(a, b);
    });
  }
  return filtered;
}

export function designerStatusCounts(
  items: UnifiedProjectItem[],
  designerId?: string,
): Record<DesignerOrderStatusFilter, number> {
  const counts = Object.fromEntries(
    DESIGNER_PROJECT_STATUS_TABS.map((t) => [t.value, 0]),
  ) as Record<DesignerOrderStatusFilter, number>;
  for (const tab of DESIGNER_PROJECT_STATUS_TABS) {
    counts[tab.value] = filterItemsByDesignerStatus(
      items,
      tab.value,
      designerId,
    ).length;
  }
  return counts;
}
