import type { Order, StageCollaboratorService, StageCollaboratorStatus } from "@/lib/types";
import { getOrderById } from "@/mocks/orders";
import { useCollaboratorStore } from "@/store/collaborator-store";

export const COLLABORATOR_STATUS_META: Record<
  StageCollaboratorStatus,
  { label: string; tone: string; description: string }
> = {
  in_progress: {
    label: "配合中",
    tone: "bg-blue-100 text-blue-800",
    description: "配合设计师正在服务，完成后可发起确认单",
  },
  pending_confirm: {
    label: "待原设计师确认",
    tone: "bg-amber-100 text-amber-800",
    description: "配合方已提交确认单，等待原设计师审核",
  },
  confirmed: {
    label: "已生效",
    tone: "bg-emerald-100 text-emerald-800",
    description: "原设计师已确认，费用已计入本阶段分配",
  },
  rejected: {
    label: "已驳回",
    tone: "bg-rose-100 text-rose-800",
    description: "原设计师驳回了本次配合费确认单",
  },
};

export function calcCollaboratorFee(workDays: number, dailyRate: number) {
  return workDays * dailyRate;
}

/** 合并 mock 订单数据与运行时 store 中的配合服务记录 */
export function getMergedStageCollaborators(
  order: Order,
  stageId: string,
): StageCollaboratorService[] {
  const mock = order.stageCollaborators?.filter((c) => c.stageId === stageId) ?? [];
  const runtime = useCollaboratorStore
    .getState()
    .services.filter((c) => c.orderId === order.id && c.stageId === stageId);

  const byId = new Map<string, StageCollaboratorService>();
  for (const item of mock) byId.set(item.id, item);
  for (const item of runtime) byId.set(item.id, item);
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getMergedOrderCollaborators(orderId: string): StageCollaboratorService[] {
  const order = getOrderById(orderId);
  if (!order) return [];
  const stageIds = order.stages.map((s) => s.id);
  return stageIds.flatMap((stageId) => getMergedStageCollaborators(order, stageId));
}
