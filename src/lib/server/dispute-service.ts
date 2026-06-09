import "server-only";
import type { Dispute, DisputeResolution, Order } from "@/lib/types";
import { AuthError, type SessionUser } from "./auth";
import {
  createDispute,
  findOpenDisputeForOrder,
  getDispute,
  getOrder,
  saveDispute,
  saveOrder,
} from "./repo";
import {
  platformRefundFrozenStage,
  platformReleaseStage,
  platformSplitFrozenStage,
} from "./order-service";

const DISPUTE_TYPES = [
  "成果质量异议",
  "付款延迟",
  "返修响应慢",
  "沟通纠纷",
  "其他",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return `dp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pickDisputeStage(order: Order, stageId?: string) {
  if (stageId) {
    const stage = order.stages.find((s) => s.id === stageId);
    if (!stage) throw new AuthError(404, "付款阶段不存在");
    return stage;
  }
  const frozen = order.stages.find((s) => s.status === "frozen");
  if (frozen) return frozen;
  const pendingPaid = order.stages.find(
    (s) => s.status === "pending" && (s.deliverables?.length ?? 0) > 0,
  );
  if (pendingPaid) return pendingPaid;
  const pending = order.stages.find((s) => s.status === "pending");
  if (pending) return pending;
  throw new AuthError(409, "当前订单没有可争议的付款阶段");
}

export interface CreateDisputeInput {
  orderId: string;
  type: string;
  description: string;
  evidence?: { name: string }[];
  stageId?: string;
}

/** 委托人 / 设计师发起纠纷 */
export async function fileDispute(
  session: SessionUser,
  input: CreateDisputeInput,
): Promise<Dispute> {
  if (session.role !== "client" && session.role !== "designer") {
    throw new AuthError(403, "仅委托人或设计师可申请平台介入");
  }

  const order = await getOrder(input.orderId);
  if (!order) throw new AuthError(404, "订单不存在");

  const isClient = session.role === "client";
  if (isClient && order.clientId !== session.identityId) {
    throw new AuthError(403, "无权对该订单发起纠纷");
  }
  if (!isClient && order.designerId !== session.identityId) {
    throw new AuthError(403, "无权对该订单发起纠纷");
  }

  if (!["in_progress", "in_revision", "pending_review"].includes(order.status)) {
    throw new AuthError(409, "当前订单状态不可申请平台介入");
  }

  const existing = await findOpenDisputeForOrder(order.id);
  if (existing) {
    throw new AuthError(409, "该订单已有进行中的纠纷工单");
  }

  const type = input.type.trim();
  if (!type) throw new AuthError(400, "请填写纠纷类型");
  const description = input.description.trim();
  if (!description) throw new AuthError(400, "请填写争议描述");

  const stage = pickDisputeStage(order, input.stageId);
  const at = nowIso();

  const dispute: Dispute = {
    id: randomId(),
    orderId: order.id,
    orderCode: order.code,
    title: order.title,
    clientId: order.clientId,
    designerId: order.designerId,
    amount: stage.amount,
    stageId: stage.id,
    raisedBy: isClient ? "client" : "designer",
    raisedById: session.identityId,
    type,
    description,
    raisedAt: at,
    status: "open",
    evidence: input.evidence ?? [],
  };

  await createDispute(dispute);

  order.messages.push({
    id: `msg_${Date.now().toString(36)}`,
    authorId: "system",
    authorRole: "system",
    content: `${isClient ? "委托人" : "设计师"}已申请平台介入（${type}），请等待管理员受理。`,
    createdAt: at,
  });
  await saveOrder(order);

  return dispute;
}

/** 管理员受理：待受理 → 处理中 */
export async function acceptDispute(
  disputeId: string,
  _adminId: string,
): Promise<Dispute> {
  const dispute = await getDispute(disputeId);
  if (!dispute) throw new AuthError(404, "纠纷不存在");
  if (dispute.status !== "open") {
    throw new AuthError(409, "该纠纷已受理或已结案");
  }

  dispute.status = "in_review";
  await saveDispute(dispute);

  const order = await getOrder(dispute.orderId);
  if (order) {
    order.messages.push({
      id: `msg_${Date.now().toString(36)}`,
      authorId: "system",
      authorRole: "system",
      content: `平台已受理纠纷工单，管理员正在处理（${dispute.type}）。`,
      createdAt: nowIso(),
    });
    await saveOrder(order);
  }

  return dispute;
}

export interface ResolveDisputeInput {
  resolution: DisputeResolution;
  clientSharePercent?: number;
  note?: string;
}

/** 管理员裁决纠纷并处理托管资金 */
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  input: ResolveDisputeInput,
): Promise<Dispute> {
  const dispute = await getDispute(disputeId);
  if (!dispute) throw new AuthError(404, "纠纷不存在");
  if (dispute.status === "resolved") {
    throw new AuthError(409, "该纠纷已结案");
  }

  const stageId = dispute.stageId;
  const order = await getOrder(dispute.orderId);
  const stage =
    stageId && order ? order.stages.find((s) => s.id === stageId) : undefined;
  const canMoveFunds = stage?.status === "frozen";

  const at = nowIso();
  let resolutionNote = input.note?.trim() ?? "";

  if (input.resolution === "client") {
    resolutionNote ||= canMoveFunds
      ? "平台裁决：支持委托人，退还托管资金。"
      : "平台裁决：支持委托人。";
    if (canMoveFunds && stageId) {
      await platformRefundFrozenStage(
        dispute.orderId,
        stageId,
        dispute.id,
        dispute.amount,
        resolutionNote,
      );
    } else if (order) {
      order.messages.push({
        id: `msg_${Date.now().toString(36)}`,
        authorId: "system",
        authorRole: "system",
        content: resolutionNote,
        createdAt: at,
      });
      await saveOrder(order);
    }
  } else if (input.resolution === "designer") {
    resolutionNote ||= canMoveFunds
      ? "平台裁决：支持设计师，解冻托管款项。"
      : "平台裁决：支持设计师。";
    if (canMoveFunds && stageId) {
      await platformReleaseStage(dispute.orderId, stageId, resolutionNote);
    } else if (order) {
      order.messages.push({
        id: `msg_${Date.now().toString(36)}`,
        authorId: "system",
        authorRole: "system",
        content: resolutionNote,
        createdAt: at,
      });
      await saveOrder(order);
    }
  } else if (input.resolution === "split") {
    const pct = input.clientSharePercent ?? 50;
    resolutionNote ||= `平台部分裁决：委托人承担 ${pct}%，设计师承担 ${100 - pct}%。`;
    if (canMoveFunds && stageId) {
      await platformSplitFrozenStage(
        dispute.orderId,
        stageId,
        dispute.id,
        pct,
        resolutionNote,
      );
    } else if (order) {
      order.messages.push({
        id: `msg_${Date.now().toString(36)}`,
        authorId: "system",
        authorRole: "system",
        content: resolutionNote,
        createdAt: at,
      });
      await saveOrder(order);
    }
    dispute.clientSharePercent = pct;
  } else {
    throw new AuthError(400, "无效的裁决类型");
  }

  dispute.status = "resolved";
  dispute.resolution = input.resolution;
  dispute.resolutionNote = resolutionNote;
  dispute.resolvedAt = at;
  dispute.resolvedByAdminId = adminId;
  await saveDispute(dispute);

  return dispute;
}

export { DISPUTE_TYPES };
