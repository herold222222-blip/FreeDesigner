import { resolveTrackLabels } from "@/lib/constants";
import { getMergedStageCollaborators } from "@/lib/stage-collaborator";
import { resolveStagePaymentSplits } from "@/lib/stage-payment-splits";
import type {
  DeliverableFile,
  Order,
  OrderAuditAssignment,
  OrderTrackAssignment,
  PaymentStage,
  StageDesignerPaymentSplit,
} from "@/lib/types";

export type DesignerStagePaymentStatus =
  | "settled"
  | "client_paid"
  | "client_pending";

export const DESIGNER_STAGE_PAYMENT_META: Record<
  DesignerStagePaymentStatus,
  { label: string; tone: string }
> = {
  settled: { label: "已结算", tone: "bg-emerald-100 text-emerald-800" },
  client_paid: { label: "委托方已支付", tone: "bg-blue-100 text-blue-800" },
  client_pending: { label: "委托方待支付", tone: "bg-amber-100 text-amber-800" },
};

export function getDesignerStagePaymentStatus(
  stage: PaymentStage,
): DesignerStagePaymentStatus {
  if (stage.status === "released") return "settled";
  if (stage.status === "frozen" || stage.status === "paid") return "client_paid";
  return "client_pending";
}

/** 当前设计师负责的专业分工条目 */
export function getDesignerTrackAssignments(
  order: Order,
  designerId: string,
): OrderTrackAssignment[] {
  const assignments = order.trackAssignments ?? [];
  if (assignments.length === 0 && order.designerId === designerId) {
    return [];
  }
  return assignments.filter((a) => a.designerId === designerId);
}

export function getDesignerTrackIds(order: Order, designerId: string) {
  return new Set(getDesignerTrackAssignments(order, designerId).map((a) => a.id));
}

export function getDesignerSplitsForStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
): StageDesignerPaymentSplit[] {
  return resolveStagePaymentSplits(order, stage).filter(
    (s) => s.designerId === designerId && s.role !== "auditor" && s.role !== "project_manager",
  );
}

export function getDesignerGrossForStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  return getDesignerSplitsForStage(order, stage, designerId).reduce(
    (sum, s) => sum + s.amount,
    0,
  );
}

/** 扣平台手续费后设计师实收 */
export function getDesignerNetAmount(gross: number, feeRate: number) {
  return Math.round(gross * (1 - (feeRate ?? 0.08)));
}

export function designerInvolvedInStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  if (getDesignerSplitsForStage(order, stage, designerId).length > 0) {
    return true;
  }

  const trackIds = getDesignerTrackIds(order, designerId);
  const onStage = (order.trackAssignments ?? []).some(
    (a) => a.designerId === designerId && a.stageId === stage.id,
  );
  if (onStage) return true;

  const collaborators = getMergedStageCollaborators(order, stage.id);
  if (
    collaborators.some(
      (c) =>
        c.primaryDesignerId === designerId ||
        c.collaboratorDesignerId === designerId,
    )
  ) {
    return true;
  }

  if ((order.trackAssignments ?? []).length === 0 && order.designerId === designerId) {
    return true;
  }

  return false;
}

export function getAssignmentDeliverables(
  order: Order,
  assignment: OrderTrackAssignment,
): DeliverableFile[] {
  const stage = order.stages.find((s) => s.id === assignment.stageId);
  if (!stage?.deliverables?.length) return [];
  if (!assignment.deliverableIds?.length) {
    return stage.deliverables.filter(
      (d) => d.designerId === assignment.designerId,
    );
  }
  return stage.deliverables.filter((d) =>
    assignment.deliverableIds!.includes(d.id),
  );
}

export function getDesignerOwnDeliverables(
  order: Order,
  stage: PaymentStage,
  designerId: string,
): DeliverableFile[] {
  const assignments = getDesignerTrackAssignments(order, designerId).filter(
    (a) => a.stageId === stage.id,
  );
  const allowedIds = new Set(
    assignments.flatMap((a) => a.deliverableIds ?? []),
  );

  return (stage.deliverables ?? []).filter(
    (f) =>
      f.designerId === designerId ||
      allowedIds.has(f.id) ||
      ((order.trackAssignments ?? []).length === 0 &&
        order.designerId === designerId),
  );
}

/** 仅本人作为原设计师时保留的历史成果 */
export function getDesignerOwnHistoricalDeliverables(
  order: Order,
  designerId: string,
  trackAssignmentId?: string,
): DeliverableFile[] {
  const seen = new Set<string>();
  const files: DeliverableFile[] = [];
  for (const record of order.designerReplacements ?? []) {
    if (record.previousDesignerId !== designerId) continue;
    if (trackAssignmentId && record.trackAssignmentId !== trackAssignmentId) {
      continue;
    }
    for (const file of record.previousDeliverables ?? []) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      files.push(file);
    }
  }
  return files.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

export function getAuditsForDesignerTracks(
  order: Order,
  designerId: string,
): OrderAuditAssignment[] {
  const trackIds = getDesignerTrackIds(order, designerId);
  if (trackIds.size === 0) return [];
  return (order.auditAssignments ?? []).filter((a) =>
    trackIds.has(a.trackAssignmentId),
  );
}

export function designerHasProjectManagement(order: Order, designerId: string) {
  if (!order.withProjectManagement || !order.projectManagement) return false;
  return getDesignerTrackAssignments(order, designerId).length > 0;
}

/** 同项目其他专业的当前服务设计师（仅展示身份，不含金额与成果） */
export function getPeerTrackAssignments(
  order: Order,
  designerId: string,
): OrderTrackAssignment[] {
  const mine = getDesignerTrackIds(order, designerId);
  return (order.trackAssignments ?? []).filter(
    (a) => a.designerId !== designerId && !mine.has(a.id),
  );
}

export function sumDesignerOrderNetEarnings(order: Order, designerId: string) {
  return order.stages.reduce((sum, stage) => {
    if (!designerInvolvedInStage(order, stage, designerId)) return sum;
    const gross = getDesignerGrossForStage(order, stage, designerId);
    return sum + getDesignerNetAmount(gross, order.feeRate);
  }, 0);
}

export function canDesignerRequestWithdraw(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  const status = getDesignerStagePaymentStatus(stage);
  if (status !== "settled" && status !== "client_paid") return false;
  return getDesignerGrossForStage(order, stage, designerId) > 0;
}

export function trackLabel(assignment: OrderTrackAssignment) {
  const labels = resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3);
  return `${labels.l1Label} · ${labels.l3Label}`;
}
