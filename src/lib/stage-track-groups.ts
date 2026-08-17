import { resolveTrackLabels } from "@/lib/constants";
import type { DeliverableFile, Order, OrderTrackAssignment, PaymentStage } from "@/lib/types";

export interface StageTrackDeliverableGroup {
  /** 验收分组 id：trackAssignmentId 或 `${stageId}:other` */
  groupId: string;
  assignment?: OrderTrackAssignment;
  deliverables: DeliverableFile[];
  /** 无关联分工时的展示名 */
  fallbackLabel?: string;
}

export function getStageTrackDeliverableGroups(
  order: Order,
  stage: PaymentStage,
): StageTrackDeliverableGroup[] {
  const files = stage.deliverables ?? [];
  if (files.length === 0) return [];

  const assignments =
    order.trackAssignments?.filter(
      (a) => a.stageId === stage.id && (a.deliverableIds?.length ?? 0) > 0,
    ) ?? [];

  const groups: StageTrackDeliverableGroup[] = [];
  const assigned = new Set<string>();

  for (const assignment of assignments) {
    const deliverables = files.filter((d) =>
      assignment.deliverableIds!.includes(d.id),
    );
    if (deliverables.length === 0) continue;
    deliverables.forEach((d) => assigned.add(d.id));
    groups.push({
      groupId: assignment.id,
      assignment,
      deliverables,
    });
  }

  const unassigned = files.filter((d) => !assigned.has(d.id));
  if (unassigned.length > 0) {
    groups.push({
      groupId: `${stage.id}:other`,
      deliverables: unassigned,
      fallbackLabel: "综合成果",
    });
  }

  return groups;
}

export function stageAcceptanceKey(orderId: string, stageId: string) {
  return `${orderId}:${stageId}`;
}

export type StageParticipantRole = "designer" | "auditor" | "project_manager";

export interface StageParticipantGroup {
  id: string;
  role: StageParticipantRole;
  personId: string;
  label: string;
  deliverables: DeliverableFile[];
}

function filesForIds(files: DeliverableFile[], ids?: string[]) {
  if (!ids?.length) return [];
  return files.filter((d) => ids.includes(d.id));
}

/** 委托人视角：本阶段涉及的设计师 / 审图师 / 项目管理员及其成果 */
export function getStageParticipantGroups(
  order: Order,
  stage: PaymentStage,
): StageParticipantGroup[] {
  const files = stage.deliverables ?? [];
  const groups: StageParticipantGroup[] = [];
  const used = new Set<string>();

  const assignments = order.trackAssignments ?? [];
  if (assignments.length > 0) {
    for (const assignment of assignments) {
      const labels = resolveTrackLabels(
        assignment.l1,
        assignment.l2,
        assignment.l3,
      );
      const byIds = filesForIds(files, assignment.deliverableIds);
      const byDesigner = files.filter(
        (d) => d.designerId === assignment.designerId && !used.has(d.id),
      );
      const deliverables = byIds.length > 0 ? byIds : byDesigner;
      deliverables.forEach((d) => used.add(d.id));
      groups.push({
        id: assignment.id,
        role: "designer",
        personId: assignment.designerId,
        label: labels.l3Label,
        deliverables,
      });
    }
  } else if (order.designerId) {
    const deliverables = files.filter(
      (d) => !d.designerId || d.designerId === order.designerId,
    );
    deliverables.forEach((d) => used.add(d.id));
    groups.push({
      id: `designer:${order.designerId}`,
      role: "designer",
      personId: order.designerId,
      label: "设计师",
      deliverables,
    });
  }

  for (const audit of order.auditAssignments ?? []) {
    const labels = resolveTrackLabels(audit.l1, audit.l2, audit.l3);
    const byIds = filesForIds(files, audit.deliverableIds);
    groups.push({
      id: audit.id,
      role: "auditor",
      personId: audit.auditorId,
      label: `${labels.l3Label} · 审图`,
      deliverables: byIds,
    });
    byIds.forEach((d) => used.add(d.id));
  }

  if (order.projectManagement) {
    const pm = order.projectManagement;
    const byIds = filesForIds(files, pm.deliverableIds);
    groups.push({
      id: pm.id,
      role: "project_manager",
      personId: pm.projectManagerId,
      label: "施工图项目管理",
      deliverables: byIds,
    });
  }

  const leftover = files.filter((d) => !used.has(d.id));
  if (leftover.length > 0) {
    groups.push({
      id: `${stage.id}:other`,
      role: "designer",
      personId: leftover[0]?.designerId ?? order.designerId ?? "other",
      label: "其他成果",
      deliverables: leftover,
    });
  }

  return groups;
}
