import type { Order, OrderStatus } from "@/lib/types";
import { allOrderStagesPaid } from "@/lib/client-review";
import { isLastDeliverablesConfirmed } from "@/lib/order-track-status";

/** 已取消订单：仅可查看，不可任何操作 */
export function isOrderCancelled(
  order: Pick<Order, "status"> | { status: OrderStatus },
): boolean {
  return order.status === "cancelled";
}

/** 已取消 / 已完成：可永久删除（不可恢复） */
export function isOrderDeletable(
  order: Pick<Order, "status"> | { status: OrderStatus },
): boolean {
  return order.status === "cancelled" || order.status === "completed";
}

/** 最后阶段成果已确认，且全部费用已支付 */
export function orderFulfillmentFinished(
  order: Pick<Order, "stages" | "status">,
): boolean {
  if (order.status === "cancelled" || order.status === "terminated") {
    return false;
  }
  return isLastDeliverablesConfirmed(order) && allOrderStagesPaid(order);
}

/** 履约结束且委托人已评价 → 结案为已完成 */
export function shouldMarkOrderCompleted(order: Order): boolean {
  if (order.status === "completed") return false;
  if (order.status === "cancelled" || order.status === "terminated") {
    return false;
  }
  if (!order.clientReviewed) return false;
  return orderFulfillmentFinished(order);
}

export function normalizeCompletedStatus(order: Order): boolean {
  if (!shouldMarkOrderCompleted(order)) return false;
  order.status = "completed";
  order.pendingSettlement = false;
  if (!order.settlementConfirmedAt) {
    order.settlementConfirmedAt = new Date().toISOString();
  }
  return true;
}

/** 双方均已签署电子合同 */
export function isContractFullySigned(
  order: Pick<Order, "clientSignedContract" | "designerSignedContract">,
): boolean {
  return (
    order.clientSignedContract === true && order.designerSignedContract === true
  );
}

/** 列表 / 详情徽章：双方已签约后展示「进行中」；评价且履约结束后展示「已完成」 */
export function resolveDisplayOrderStatus(
  order: Pick<
    Order,
    | "status"
    | "clientSignedContract"
    | "designerSignedContract"
    | "clientReviewed"
    | "stages"
  >,
): OrderStatus {
  if (
    order.status !== "cancelled" &&
    order.status !== "terminated" &&
    order.clientReviewed &&
    Array.isArray(order.stages) &&
    orderFulfillmentFinished(order)
  ) {
    return "completed";
  }
  if (order.status === "pending_contract" && isContractFullySigned(order)) {
    return "in_progress";
  }
  return order.status;
}

export function needsClientSign(order: Order): boolean {
  return (
    order.status === "pending_contract" && order.clientSignedContract !== true
  );
}

export function needsDesignerSign(order: Order): boolean {
  return (
    order.status === "pending_contract" &&
    order.designerSignedContract !== true &&
    !!order.designerId
  );
}

/** 委托人已选报价卡并确认设计师后，阶段金额已锁定（支付仍须签约） */
export function orderHasLockedQuoteAmounts(order: Order): boolean {
  if (order.orderSource === "scan" && !order.scanQuoteProposedAt) return false;
  if (order.quote?.status === "confirmed") return true;
  if ((order.trackAssignments ?? []).some((a) => Boolean(a.designerId))) {
    return true;
  }
  return [
    "pending_designer_accept",
    "pending_schedule",
    "pending_contract",
    "in_progress",
    "pending_review",
    "in_revision",
    "completed",
  ].includes(order.status);
}

/** 签约完成后可支付各阶段款 */
export function canPayOrderStages(order: Order): boolean {
  if (!isContractFullySigned(order)) return false;
  return [
    "pending_contract",
    "in_progress",
    "pending_review",
    "in_revision",
  ].includes(order.status);
}

/** 全部阶段已验收，等待委托人「最终服务完成」 */
export function isPendingFinalSettlement(order: Order): boolean {
  return order.pendingSettlement === true;
}

/** 线上远程为预期交付；线下驻场为开始服务时间 */
export function orderExpectedDateLabel(
  order: Pick<{ serviceMode?: string }, "serviceMode">,
): string {
  return order.serviceMode === "onsite" ? "开始服务时间" : "预期交付";
}

/** 下单 / 修改表单中的日期字段名 */
export function expectedDateFieldLabel(serviceMode?: string): string {
  return serviceMode === "onsite" ? "开始服务时间" : "期望交付日期";
}

export {
  allOrderStagesPaid,
  getOrderPaymentProgress,
  isClientReviewClosed,
  needsClientReview,
} from "@/lib/client-review";
