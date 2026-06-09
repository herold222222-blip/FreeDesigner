import type {
  Order,
  PaymentStage,
  StageCollaboratorService,
  StageDesignerPaymentSplit,
} from "@/lib/types";
import { resolveTrackLabels } from "@/lib/constants";
import { getMergedStageCollaborators } from "@/lib/stage-collaborator";

const AUDIT_FEE_RATIO = 0.08;
const PM_FEE_RATIO = 0.2;
/** 出图 + 审图 8% + 项目管理 20% */
const VALUE_ADDED_MULTIPLIER = 1 + AUDIT_FEE_RATIO + PM_FEE_RATIO;

/** 解析某付款阶段的费用拆分（含配合费、审图、项目管理） */
export function resolveStagePaymentSplits(
  order: Order,
  stage: PaymentStage,
): StageDesignerPaymentSplit[] {
  let base: StageDesignerPaymentSplit[];

  if (stage.designerPaymentSplits?.length) {
    base = stage.designerPaymentSplits.map((s) => ({ ...s }));
  } else {
    const assignments =
      order.trackAssignments?.filter((a) => a.stageId === stage.id) ?? [];
    if (assignments.length === 0) {
      base = [];
    } else {
      const perTrack = stage.ratio / assignments.length;
      base = assignments.map((a) => ({
        designerId: a.designerId,
        orderRatio: perTrack,
        amount: Math.round(order.totalAmount * perTrack),
        label: `${a.l3} · 本阶段服务`,
        trackAssignmentId: a.id,
        role: "unchanged" as const,
      }));
    }
  }

  const collaborators = getMergedStageCollaborators(order, stage.id).filter(
    (c) => c.status === "confirmed",
  );
  const withCollaborators = applyCollaboratorDeductions(order, base, collaborators);
  return appendValueAddedServiceSplits(order, stage, withCollaborators);
}

function getDrawingBase(order: Order) {
  if (order.withAuditService || order.withProjectManagement) {
    return Math.round(order.totalAmount / VALUE_ADDED_MULTIPLIER);
  }
  return order.totalAmount;
}

function appendValueAddedServiceSplits(
  order: Order,
  stage: PaymentStage,
  splits: StageDesignerPaymentSplit[],
): StageDesignerPaymentSplit[] {
  const hasAuditor = splits.some((s) => s.role === "auditor");
  const hasPm = splits.some((s) => s.role === "project_manager");
  if (hasAuditor && hasPm) return splits;
  if (!order.withAuditService && !order.withProjectManagement) return splits;

  const result = [...splits];
  const drawingBase = getDrawingBase(order);

  if (order.withAuditService && order.auditAssignments?.length && !hasAuditor) {
    const auditTotal = Math.round(drawingBase * AUDIT_FEE_RATIO);
    const perAuditorTotal = Math.round(auditTotal / order.auditAssignments.length);
    const stageAuditAmount = Math.round(perAuditorTotal * stage.ratio);

    for (const audit of order.auditAssignments) {
      const labels = resolveTrackLabels(audit.l1, audit.l2, audit.l3);
      result.push({
        serviceProviderId: audit.auditorId,
        orderRatio: stageAuditAmount / order.totalAmount,
        amount: stageAuditAmount,
        label: `${labels.l3Label} · 审图服务`,
        trackAssignmentId: audit.trackAssignmentId,
        role: "auditor",
        auditAssignmentId: audit.id,
      });
    }
  }

  if (order.withProjectManagement && order.projectManagement && !hasPm) {
    const pmTotal = Math.round(drawingBase * PM_FEE_RATIO);
    const stagePmAmount = Math.round(pmTotal * stage.ratio);
    result.push({
      serviceProviderId: order.projectManagement.projectManagerId,
      orderRatio: stagePmAmount / order.totalAmount,
      amount: stagePmAmount,
      label: "施工图项目管理 · 整体协调",
      role: "project_manager",
    });
  }

  return result;
}

function applyCollaboratorDeductions(
  order: Order,
  splits: StageDesignerPaymentSplit[],
  confirmed: StageCollaboratorService[],
): StageDesignerPaymentSplit[] {
  if (confirmed.length === 0) return splits;

  const result = splits.map((s) => ({ ...s }));

  for (const collab of confirmed) {
    const primaryIdx = result.findIndex(
      (s) =>
        s.designerId === collab.primaryDesignerId &&
        s.role !== "collaborator" &&
        (!collab.trackAssignmentId ||
          s.trackAssignmentId === collab.trackAssignmentId),
    );

    if (primaryIdx >= 0) {
      const primary = result[primaryIdx];
      result[primaryIdx] = {
        ...primary,
        amount: primary.amount - collab.totalFee,
        orderRatio: primary.orderRatio - collab.totalFee / order.totalAmount,
        label: primary.label.includes("已扣除配合费") ?
          primary.label
        : `${primary.label}（已扣除配合费）`,
      };
    }

    result.push({
      designerId: collab.collaboratorDesignerId,
      orderRatio: collab.totalFee / order.totalAmount,
      amount: collab.totalFee,
      label: `配合服务 · ${collab.workDays} 天 × ¥${collab.dailyRate}/天`,
      trackAssignmentId: collab.trackAssignmentId,
      role: "collaborator",
      collaboratorServiceId: collab.id,
      workDays: collab.workDays,
      dailyRate: collab.dailyRate,
    });
  }

  return result;
}

export function stageHasReplacementSplits(splits: StageDesignerPaymentSplit[]) {
  return splits.some((s) => s.fromReplacement || s.role === "previous");
}

export function stageHasCollaboratorSplits(splits: StageDesignerPaymentSplit[]) {
  return splits.some((s) => s.role === "collaborator");
}

export function stageHasAuditorSplits(splits: StageDesignerPaymentSplit[]) {
  return splits.some((s) => s.role === "auditor");
}

export function stageHasProjectManagerSplits(splits: StageDesignerPaymentSplit[]) {
  return splits.some((s) => s.role === "project_manager");
}
