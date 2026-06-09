import type { Order, OrderStatus } from "@/lib/types";
import type { ScanOrder } from "@/lib/scan-order";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";

/** 设计师我的项目 · 状态筛选 */
export type DesignerOrderStatusFilter =
  | OrderStatus
  | "all"
  | "pending_fee_confirm"
  | "pending_revision"
  | "pending_collection";

export const DESIGNER_PROJECT_STATUS_TABS: {
  value: DesignerOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "pending_fee_confirm", label: "待确认费用" },
  { value: "pending_contract", label: "待签约" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_revision", label: "待修改" },
  { value: "pending_collection", label: "待收款" },
  { value: "completed", label: "已完成" },
  { value: "terminated", label: "已终止" },
];

/** 有待项目时需高亮的状态 Tab */
export const DESIGNER_STATUS_TAB_HIGHLIGHT: DesignerOrderStatusFilter[] = [
  "pending_fee_confirm",
  "pending_contract",
  "pending_revision",
];

export const DESIGNER_ORDER_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending_schedule: "待确认费用",
  pending_contract: "待签约",
  in_progress: "进行中",
  pending_review: "待成果确认",
  in_revision: "待修改",
  completed: "已完成",
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

function scanMatchesDesignerStatus(
  scan: ScanOrder,
  status: DesignerOrderStatusFilter,
): boolean {
  if (status === "pending_fee_confirm") {
    return isPendingFeeConfirmScan(scan);
  }
  if (status === "pending_contract") {
    return scan.status === "pending_contract" || scan.status === "pending_prepay";
  }
  if (status === "in_progress") {
    return scan.status === "in_service";
  }
  return false;
}

export function orderMatchesDesignerStatus(
  order: Order,
  status: DesignerOrderStatusFilter,
): boolean {
  switch (status) {
    case "all":
      return true;
    case "pending_fee_confirm":
      return isPendingFeeConfirmOrder(order);
    case "pending_revision":
      return isPendingRevisionOrder(order);
    case "pending_collection":
      return isPendingCollectionOrder(order);
    case "in_progress":
      return order.status === "in_progress" && !isPendingCollectionOrder(order);
    default:
      return order.status === status;
  }
}

export function filterItemsByDesignerStatus(
  items: UnifiedProjectItem[],
  status: DesignerOrderStatusFilter,
): UnifiedProjectItem[] {
  if (status === "all") return items;
  return items.filter((item) => {
    if (item.kind === "order" && item.order) {
      return orderMatchesDesignerStatus(item.order, status);
    }
    if (item.kind === "scan" && item.scan) {
      return scanMatchesDesignerStatus(item.scan, status);
    }
    return false;
  });
}

export function designerStatusCounts(
  items: UnifiedProjectItem[],
): Record<DesignerOrderStatusFilter, number> {
  const counts = Object.fromEntries(
    DESIGNER_PROJECT_STATUS_TABS.map((t) => [t.value, 0]),
  ) as Record<DesignerOrderStatusFilter, number>;
  counts.all = items.length;
  for (const tab of DESIGNER_PROJECT_STATUS_TABS) {
    if (tab.value === "all") continue;
    counts[tab.value] = filterItemsByDesignerStatus(items, tab.value).length;
  }
  return counts;
}
