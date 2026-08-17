import { isContractFullySigned } from "@/lib/order-lifecycle";
import { isAwaitingClientReviewOrder } from "@/lib/client-review";
import type { Order } from "@/lib/types";
import type { ScanOrder } from "@/lib/scan-order";

/** 订单监管状态（三端共用语义，标签按角色不同） */
export type OrderSupervisionStatus =
  | "all"
  | "in_progress"
  | "pending_payment"
  | "awaiting_match"
  | "matching"
  | "awaiting_confirm"
  | "pending_client_sign"
  | "pending_designer_sign"
  | "pending_review"
  | "pending_client_review"
  | "in_revision"
  | "completed"
  | "cancelled";

function hasPendingDesignerOffer(order: Order): boolean {
  if (order.clientMatch?.offerStatus === "pending") return true;
  return (order.clientMatch?.trackPools ?? []).some(
    (p) => p.offerStatus === "pending",
  );
}

/** 【全部】不含已完成、已取消 */
export function isActiveSupervisionOrder(order: Pick<Order, "status">): boolean {
  return order.status !== "completed" && order.status !== "cancelled";
}

/** 委托人 / 管理端【全部】：不含已完成、已取消，但待评价仍列入待办 */
export function isActiveSupervisionOrderWithClientReview(order: Order): boolean {
  if (order.status === "cancelled") return false;
  if (order.status === "completed") return isAwaitingClientReviewOrder(order);
  return true;
}

/** 【待匹配】：已填资料，尚未最终选定设计师 */
export function isAwaitingMatchOrder(order: Order): boolean {
  if (order.status === "pending_quote") return true;
  if (order.status === "matching" && !hasPendingDesignerOffer(order)) return true;
  return false;
}

/** 有等级报价卡且客服尚未二次确认：委托人不可选卡匹配 */
export function needsCsQuoteConfirm(order: Pick<
  Order,
  "status" | "levelQuotes" | "quote" | "csQuoteConfirmedAt"
>): boolean {
  if (order.status !== "pending_quote") return false;
  if (!order.levelQuotes?.length && !order.quote) return false;
  return !order.csQuoteConfirmedAt;
}

/** 委托人仅在选卡匹配设计师之前可改项目信息 */
export function clientCanEditEntrust(order: Pick<Order, "status">): boolean {
  return order.status === "pending_quote";
}

/**
 * 【匹配中】（管理端 / 委托人）：已选定设计师，等待设计师确认接单或费用。
 */
export function isMatchingInProgressOrder(order: Order): boolean {
  if (order.status === "pending_designer_accept") return true;
  if (order.status === "pending_schedule") return true;
  if (order.status === "matching" && hasPendingDesignerOffer(order)) return true;
  return false;
}

function myTrackAssignments(order: Order, designerId: string) {
  return (order.trackAssignments ?? []).filter((a) => a.designerId === designerId);
}

/** 【待确认匹配】：等待当前设计师确认 */
export function isDesignerAwaitingConfirmOrder(
  order: Order,
  designerId: string,
): boolean {
  if (!designerId) return false;
  if (order.status === "pending_schedule") {
    return (
      order.designerId === designerId ||
      myTrackAssignments(order, designerId).length > 0
    );
  }
  if (order.status === "matching" && hasPendingDesignerOffer(order)) {
    const offerId =
      order.clientMatch?.offerDesignerId ??
      order.clientMatch?.trackPools?.find((p) => p.offerStatus === "pending")
        ?.offerDesignerId;
    if (offerId) return offerId === designerId;
    return (
      order.clientMatch?.trackPools?.some(
        (p) => p.offerStatus === "pending" && p.offerDesignerId === designerId,
      ) === true
    );
  }
  if (order.status !== "pending_designer_accept") return false;
  const assignments = order.trackAssignments ?? [];
  if (assignments.length === 0) {
    return order.designerId === designerId;
  }
  return myTrackAssignments(order, designerId).some(
    (a) => a.status === "pending_match",
  );
}

/** 【匹配中】（设计师）：本人已确认，仍在等待其他设计师确认 */
export function isDesignerMatchingOthersOrder(
  order: Order,
  designerId: string,
): boolean {
  if (!designerId) return false;
  if (order.status !== "pending_designer_accept") return false;
  const assignments = order.trackAssignments ?? [];
  if (assignments.length === 0) return false;
  const mine = myTrackAssignments(order, designerId);
  if (mine.length === 0) return false;
  const iAccepted = mine.every((a) => a.status !== "pending_match");
  const othersPending = assignments.some(
    (a) => a.designerId !== designerId && a.status === "pending_match",
  );
  return iAccepted && othersPending;
}

/** 【待委托人签约】/ 委托人【待签约】：委托人尚未签署 */
export function isAwaitingClientSignOrder(order: Order): boolean {
  return (
    order.status === "pending_contract" && order.clientSignedContract !== true
  );
}

/** 【待设计师签约】：委托人已签、设计师未签（避免与待委托人签约重复计入） */
export function isAwaitingDesignerSignOrder(order: Order): boolean {
  return (
    order.status === "pending_contract" &&
    order.clientSignedContract === true &&
    order.designerSignedContract !== true
  );
}

/** 设计师本人尚未签署电子合同 */
export function isDesignerNeedsSignOrder(order: Order): boolean {
  return (
    order.status === "pending_contract" &&
    order.designerSignedContract !== true
  );
}

function isStageSettledOrHeld(stage: { status: string }): boolean {
  return (
    stage.status === "released" ||
    stage.status === "frozen" ||
    stage.status === "paid"
  );
}

/**
 * 【待支付】：签约完成后，等待委托人支付。
 * 预付款；或上一阶段已托管/结算且本阶段成果已确认；或上一阶段已验收解冻。
 * 待成果确认、返修中不计入。
 */
export function isAwaitingClientPaymentOrder(order: Order): boolean {
  if (
    order.status === "cancelled" ||
    order.status === "terminated" ||
    order.status === "completed" ||
    order.status === "in_revision"
  ) {
    return false;
  }
  if (!isContractFullySigned(order)) return false;
  for (let i = 0; i < order.stages.length; i++) {
    const stage = order.stages[i];
    if (stage.status !== "pending") continue;
    const priorSettled = order.stages.slice(0, i).every(isStageSettledOrHeld);
    if (!priorSettled) continue;
    if (i === 0) return true;
    if (stage.deliverablesConfirmedAt) return true;
    const priorReleased = order.stages
      .slice(0, i)
      .every((s) => s.status === "released");
    if (priorReleased) return true;
  }
  return false;
}

/** 【待成果确认】：设计师已上传成果，待委托人确认 */
export function isAwaitingReviewOrder(order: Order): boolean {
  if (order.status !== "pending_review") return false;
  if (isAwaitingClientPaymentOrder(order)) return false;
  return true;
}

export function isDesignerAwaitingReviewOrder(
  order: Order,
  designerId: string,
): boolean {
  if (!isAwaitingReviewOrder(order)) return false;
  if (!designerId) return false;
  const mine = myTrackAssignments(order, designerId);
  if (mine.length === 0) {
    return order.designerId === designerId;
  }
  return true;
}

/** 【返修中】 */
export function isInRevisionSupervisionOrder(order: Order): boolean {
  return order.status === "in_revision";
}

/** 【进行中】：双方已签约且履约中，不含待支付 / 待成果确认 / 返修 / 待签约 */
export function isInProgressSupervisionOrder(order: Order): boolean {
  if (
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.status === "terminated" ||
    order.status === "pending_review" ||
    order.status === "in_revision"
  ) {
    return false;
  }
  if (!isContractFullySigned(order)) return false;
  if (isAwaitingClientSignOrder(order) || isAwaitingDesignerSignOrder(order)) {
    return false;
  }
  if (isAwaitingClientPaymentOrder(order)) return false;
  return true;
}

export function pickDefaultSupervisionTab<T extends string>(
  counts: Partial<Record<T, number>>,
  priority: T[],
  fallback: T,
): T {
  for (const key of priority) {
    if ((counts[key] ?? 0) > 0) return key;
  }
  return fallback;
}

/** 管理端 / 委托人【全部】排序：待支付 > 待成果确认 > 待评价 > 待签约 > 待设计师签约 > 返修中 > 待匹配 > 匹配中 > 进行中 */
export function adminClientAllSortRank(order: Order): number {
  if (isAwaitingClientPaymentOrder(order)) return 0;
  if (isAwaitingReviewOrder(order)) return 1;
  if (isAwaitingClientReviewOrder(order)) return 2;
  if (isAwaitingClientSignOrder(order)) return 3;
  if (isAwaitingDesignerSignOrder(order)) return 4;
  if (isInRevisionSupervisionOrder(order)) return 5;
  if (isAwaitingMatchOrder(order)) return 6;
  if (isMatchingInProgressOrder(order)) return 7;
  if (isInProgressSupervisionOrder(order)) return 8;
  return 9;
}

/** 设计师【全部】排序 */
export function designerAllSortRank(order: Order, designerId: string): number {
  if (isDesignerAwaitingConfirmOrder(order, designerId)) return 0;
  if (isDesignerNeedsSignOrder(order)) return 1;
  if (isInRevisionSupervisionOrder(order)) return 2;
  if (isAwaitingClientPaymentOrder(order)) return 3;
  if (isDesignerAwaitingReviewOrder(order, designerId)) return 4;
  if (
    order.status === "pending_contract" &&
    order.designerSignedContract === true &&
    order.clientSignedContract !== true
  ) {
    return 5;
  }
  if (isDesignerMatchingOthersOrder(order, designerId)) return 6;
  if (isInProgressSupervisionOrder(order)) return 7;
  return 8;
}

export const ADMIN_DEFAULT_TAB_PRIORITY: OrderSupervisionStatus[] = [
  "awaiting_match",
  "matching",
  "pending_payment",
  "pending_client_sign",
  "pending_designer_sign",
  "pending_review",
  "pending_client_review",
  "in_revision",
  "in_progress",
  "all",
];

export const CLIENT_DEFAULT_TAB_PRIORITY: OrderSupervisionStatus[] = [
  "awaiting_match",
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

export const DESIGNER_DEFAULT_TAB_PRIORITY: OrderSupervisionStatus[] = [
  "awaiting_confirm",
  "pending_designer_sign",
  "in_revision",
  "pending_payment",
  "pending_review",
  "pending_client_sign",
  "matching",
  "in_progress",
  "all",
];

export function scanMatchesSupervision(
  scan: ScanOrder,
  status: OrderSupervisionStatus,
  role: "client" | "designer",
): boolean {
  switch (status) {
    case "all":
      return scan.status !== "rejected";
    case "awaiting_confirm":
      return role === "designer" && scan.status === "pending_designer_confirm";
    case "matching":
      return (
        role === "client" && scan.status === "pending_designer_confirm"
      );
    case "pending_client_sign":
      return (
        (scan.status === "pending_contract" ||
          scan.status === "pending_prepay") &&
        !scan.signedByClient
      );
    case "pending_designer_sign":
      return (
        (scan.status === "pending_contract" ||
          scan.status === "pending_prepay") &&
        !scan.signedByDesigner
      );
    case "pending_payment":
      return scan.status === "pending_prepay";
    case "in_progress":
      return scan.status === "in_service";
    default:
      return false;
  }
}

export function compareByCreatedAtDesc(
  a: { createdAt: string },
  b: { createdAt: string },
) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}
