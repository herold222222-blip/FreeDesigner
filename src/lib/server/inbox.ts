import "server-only";
import { prisma } from "@/lib/server/db";
import { formatCurrency } from "@/lib/utils";
import type { Order } from "@/lib/types";

export type InboxMessageKind = "system" | "user";

export interface InboxMessageDTO {
  id: string;
  kind: InboxMessageKind;
  fromName: string;
  fromUserId?: string | null;
  title: string;
  body: string;
  linkHref?: string | null;
  readAt?: string | null;
  createdAt: string;
  unread: boolean;
}

function toDTO(row: {
  id: string;
  kind: string;
  fromName: string;
  fromUserId: string | null;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
}): InboxMessageDTO {
  return {
    id: row.id,
    kind: (row.kind === "user" ? "user" : "system") as InboxMessageKind,
    fromName: row.fromName,
    fromUserId: row.fromUserId,
    title: row.title,
    body: row.body,
    linkHref: row.linkHref,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    unread: !row.readAt,
  };
}

export async function createInboxMessage(input: {
  userId: string;
  kind?: InboxMessageKind;
  fromName?: string;
  fromUserId?: string | null;
  title: string;
  body: string;
  linkHref?: string | null;
}): Promise<InboxMessageDTO> {
  const row = await prisma.inboxMessage.create({
    data: {
      userId: input.userId,
      kind: input.kind ?? "system",
      fromName: input.fromName ?? "乐自由",
      fromUserId: input.fromUserId ?? null,
      title: input.title,
      body: input.body,
      linkHref: input.linkHref ?? null,
    },
  });
  return toDTO(row);
}

export async function listInboxMessages(
  userId: string,
  limit = 100,
): Promise<InboxMessageDTO[]> {
  const rows = await prisma.inboxMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map(toDTO);
}

export async function countUnreadInbox(userId: string): Promise<number> {
  return prisma.inboxMessage.count({
    where: { userId, readAt: null },
  });
}

export async function markInboxMessageRead(
  userId: string,
  messageId: string,
): Promise<InboxMessageDTO | null> {
  const existing = await prisma.inboxMessage.findFirst({
    where: { id: messageId, userId },
  });
  if (!existing) return null;
  if (existing.readAt) return toDTO(existing);
  const row = await prisma.inboxMessage.update({
    where: { id: messageId },
    data: { readAt: new Date() },
  });
  return toDTO(row);
}

export async function markAllInboxRead(userId: string): Promise<number> {
  const result = await prisma.inboxMessage.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** 欢迎消息：入驻成功后发送 */
export async function sendWelcomeInboxMessage(
  userId: string,
  roleLabel: string,
) {
  return createInboxMessage({
    userId,
    kind: "system",
    title: "欢迎加入乐自由",
    body: `您已成功以「${roleLabel}」身份入驻。可在工作台管理项目、订单与账号信息；系统通知与其他用户消息也会在此汇总。`,
  });
}

export async function userIdForClient(
  clientId: string,
): Promise<string | null> {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

export async function userIdForDesigner(
  designerId: string,
): Promise<string | null> {
  const row = await prisma.designer.findUnique({
    where: { id: designerId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

async function notifySafe(
  userId: string | null | undefined,
  input: Omit<Parameters<typeof createInboxMessage>[0], "userId">,
) {
  if (!userId) return;
  try {
    await createInboxMessage({ userId, ...input });
  } catch {
    /* 站内信失败不阻断主流程 */
  }
}

/** 委托人支付成功 → 通知双方 */
export async function notifyStagePaid(order: Order, stageName: string, amount: number) {
  const [clientUserId, designerUserId] = await Promise.all([
    userIdForClient(order.clientId),
    userIdForDesigner(order.designerId),
  ]);
  const money = formatCurrency(amount);
  await Promise.all([
    notifySafe(clientUserId, {
      title: "支付成功",
      body: `订单「${order.title}」（${order.code}）的「${stageName}」已支付 ${money}，资金已进入平台托管。`,
      linkHref: `/client/orders/${order.id}`,
    }),
    notifySafe(designerUserId, {
      title: "收到阶段付款",
      body: `订单「${order.title}」（${order.code}）委托人已支付「${stageName}」${money}，款项已托管冻结，验收通过后解冻可提现。`,
      linkHref: `/designer/orders/${order.id}`,
    }),
  ]);
}

/** 设计师上传成果 → 通知委托人 */
export async function notifyDeliverablesSubmitted(
  order: Order,
  stageName: string,
) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "项目成果待确认",
    body: `设计师已上传订单「${order.title}」的「${stageName}」成果，请预览确认；付款后可解锁下载 CAD 等完整文件。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 委托人提交返修 → 通知设计师 */
export async function notifyRevisionRequested(
  order: Order,
  stageName: string,
  description: string,
) {
  const designerUserId = await userIdForDesigner(order.designerId);
  const detail = description.trim() || "请按沟通记录优化本阶段成果。";
  await notifySafe(designerUserId, {
    title: "收到返修需求",
    body: `订单「${order.title}」的「${stageName}」被要求返修：${detail}`,
    linkHref: `/designer/orders/${order.id}`,
  });
}

/** 阶段验收通过（含自动验收）→ 通知双方 */
export async function notifyStageReleased(
  order: Order,
  stageName: string,
  amount: number,
  auto = false,
) {
  const [clientUserId, designerUserId] = await Promise.all([
    userIdForClient(order.clientId),
    userIdForDesigner(order.designerId),
  ]);
  const money = formatCurrency(amount);
  const autoNote = auto ? "（超时系统自动确认）" : "";
  await Promise.all([
    notifySafe(clientUserId, {
      title: "成果确认完成",
      body: `订单「${order.title}」的「${stageName}」成果已确认验收${autoNote}，对应款项 ${money} 已解冻至设计师账户。`,
      linkHref: `/client/orders/${order.id}`,
    }),
    notifySafe(designerUserId, {
      title: "阶段验收通过",
      body: `订单「${order.title}」的「${stageName}」已通过验收${autoNote}，托管款 ${money} 已解冻可提现（已扣平台手续费）。`,
      linkHref: `/designer/orders/${order.id}`,
    }),
  ]);
}

/** 设计师申请结算 → 通知委托人 */
export async function notifySettlementRequested(order: Order) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "请确认最终服务完成",
    body: `设计师已就订单「${order.title}」申请项目结算，请确认最终服务完成后项目将结案并可评价。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 委托人确认最终完成 → 通知设计师 */
export async function notifyFinalSettlementConfirmed(order: Order) {
  const designerUserId = await userIdForDesigner(order.designerId);
  await notifySafe(designerUserId, {
    title: "项目已结案",
    body: `委托人已确认订单「${order.title}」最终服务完成，项目结案。可前往钱包查看可提现余额。`,
    linkHref: `/designer/orders/${order.id}`,
  });
}

/** 等级提升通知 */
export async function notifyLevelUpgraded(input: {
  userId: string | null | undefined;
  subjectLabel: string;
  levelLabel: string;
  linkHref: string;
}) {
  await notifySafe(input.userId, {
    title: "等级已提升",
    body: `恭喜，您的${input.subjectLabel}等级已更新为「${input.levelLabel}」。新等级将影响展示与取费系数，可在个人主页查看详情。`,
    linkHref: input.linkHref,
  });
}

/** 管理员取消订单 → 通知委托人 */
export async function notifyOrderCancelledByAdmin(order: Order, reason?: string) {
  const clientUserId = await userIdForClient(order.clientId);
  const reasonNote = reason?.trim() ? `原因：${reason.trim()}` : "如有疑问请联系平台客服。";
  await notifySafe(clientUserId, {
    title: "订单已取消",
    body: `平台已取消订单「${order.title}」（${order.code}）。${reasonNote}`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 委托人确认报价后 → 通知全部管理员 / 超级管理员去分配设计师 */
export async function notifyAdminsMatchingOrder(order: Order) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] }, status: "active" },
    select: { id: true, role: true },
  });
  const money = formatCurrency(order.totalAmount);
  await Promise.all(
    admins.map((admin) =>
      notifySafe(admin.id, {
        title: "待分配设计师",
        body: `委托人已确认订单「${order.title}」（${order.code}）报价 ${money}，请尽快匹配并委派设计师。`,
        linkHref:
          admin.role === "super_admin"
            ? `/super-admin/orders/${order.id}`
            : `/admin/orders/${order.id}`,
      }),
    ),
  );
}
