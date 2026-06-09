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
