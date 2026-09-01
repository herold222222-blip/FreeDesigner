import { allOrderStagesPaid } from "@/lib/client-review";
import { isLastDeliverablesConfirmed } from "@/lib/order-payment-stages";
import type { Order, OrderTrackAssignment } from "@/lib/types";

export { isLastDeliverablesConfirmed } from "@/lib/order-payment-stages";

/**
 * 设计师本专业服务已完毕：最后成果已确认，且委托人已支付全部费用。
 */
export function isTrackAssignmentServiceFinished(
  order: Order,
  assignment?: Pick<OrderTrackAssignment, "status">,
): boolean {
  if (assignment?.status === "pending_match") return false;
  if (assignment?.status === "completed") return true;
  if (order.status === "completed") return true;
  return isLastDeliverablesConfirmed(order) && allOrderStagesPaid(order);
}

/** 履约结束后把专业分工从「服务中」落成「服务完毕」 */
export function syncTrackAssignmentStatuses(order: Order): boolean {
  const assignments = order.trackAssignments;
  if (!assignments?.length) return false;
  let changed = false;
  for (const assignment of assignments) {
    if (assignment.status === "pending_match") continue;
    if (
      isTrackAssignmentServiceFinished(order, assignment) &&
      assignment.status !== "completed"
    ) {
      assignment.status = "completed";
      changed = true;
    }
  }
  return changed;
}
