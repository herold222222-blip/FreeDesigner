import type { Order } from "@/lib/types";

/** 双方均已签署电子合同 */
export function isContractFullySigned(order: Order): boolean {
  return (
    order.clientSignedContract === true && order.designerSignedContract === true
  );
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

/** 已结案但委托人尚未评价 */
export function needsClientReview(order: Order): boolean {
  return (
    order.status === "completed" &&
    order.clientReviewed !== true &&
    order.reviewExpired !== true
  );
}
