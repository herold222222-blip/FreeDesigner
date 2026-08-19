import "server-only";
import { prisma } from "@/lib/server/db";
import { sumDesignerOrderNetEarnings } from "@/lib/designer-order-scope";
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
  if (!clientId) return null;
  const byId = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });
  if (byId?.userId) return byId.userId;

  const byUserId = await prisma.client.findUnique({
    where: { userId: clientId },
    select: { userId: true },
  });
  if (byUserId?.userId) return byUserId.userId;

  if (clientId.startsWith("client_")) {
    const maybeUserId = clientId.slice("client_".length);
    const user = await prisma.user.findUnique({
      where: { id: maybeUserId },
      select: { id: true },
    });
    if (user) return user.id;
  }

  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function designerIdForSameAccountAsClient(
  clientId: string,
): Promise<string | null> {
  const userId = await userIdForClient(clientId);
  if (!userId) return null;
  const row = await prisma.designer.findUnique({
    where: { userId },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function isSameAccountClientAndDesigner(
  clientId: string,
  designerId: string,
): Promise<boolean> {
  if (!clientId || !designerId) return false;
  const [clientUserId, designerUserId] = await Promise.all([
    userIdForClient(clientId),
    userIdForDesigner(designerId),
  ]);
  return Boolean(
    clientUserId && designerUserId && clientUserId === designerUserId,
  );
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
  if (!userId) {
    console.warn("[inbox] 跳过站内信：收件人 userId 为空", input.title);
    return;
  }
  try {
    await createInboxMessage({ userId, ...input });
  } catch (err) {
    console.error("[inbox] 发送站内信失败", input.title, err);
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

/** 最后一笔费用支付完成 → 通知委托人评价（30 天内） */
export async function notifyClientReviewOpened(order: Order) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "可以对项目评价了",
    body: `订单「${order.title}」最后一笔费用已支付。请在 30 天内对设计师评分并填写评论，逾期评论将关闭。`,
    linkHref: `/client/orders/${order.id}`,
  });
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

/** 委托人确认成果 → 通知设计师等待付款 */
export async function notifyDeliverablesConfirmed(
  order: Order,
  stageName: string,
) {
  const designerIds = new Set<string>();
  if (order.designerId) designerIds.add(order.designerId);
  for (const assignment of order.trackAssignments ?? []) {
    if (assignment.designerId) designerIds.add(assignment.designerId);
  }
  await Promise.all(
    [...designerIds].map(async (designerId) => {
      const designerUserId = await userIdForDesigner(designerId);
      await notifySafe(designerUserId, {
        title: "委托人已确认成果，等待付款",
        body: `委托人已确认订单「${order.title}」的「${stageName}」成果，请等待委托人付款。`,
        linkHref: `/designer/orders/${order.id}`,
      });
    }),
  );
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
    body: `设计师已就订单「${order.title}」申请项目结算，请确认最终服务完成后项目将结案。`,
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

/** 管理员委派设计师 → 通知设计师确认 */
export async function notifyDesignerAssignmentOffer(
  order: Order,
  designerId: string,
  opts?: { designerName?: string; trackLabels?: string },
) {
  const designerUserId = await userIdForDesigner(designerId);
  const net = sumDesignerOrderNetEarnings(order, designerId);
  const money = net > 0 ? formatCurrency(net) : "";
  const trackNote = opts?.trackLabels
    ? `负责专业：${opts.trackLabels}。`
    : "";
  const feeNote = money
    ? `您本专业预计实收 ${money}（不含平台管理费与税费）。`
    : "";
  await notifySafe(designerUserId, {
    title: "收到订单委派",
    body: `平台向您委派订单「${order.title}」（${order.code}），${feeNote}${trackNote}请尽快同意或拒绝接单。`,
    linkHref: `/designer/orders/${order.id}`,
  });
}

/** 设计师拒绝后系统自动改派 → 通知委托人 */
export async function notifyClientDesignerRematch(
  order: Order,
  rejectedName: string,
  nextName?: string,
) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: nextName ? "设计师已改派" : "设计师已拒绝",
    body: nextName
      ? `设计师「${rejectedName}」拒绝了订单「${order.title}」。系统已自动改派「${nextName}」，请等待对方确认。`
      : `设计师「${rejectedName}」拒绝了订单「${order.title}」。暂无更多同等级可接单设计师，请重新选择备选或换档匹配。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 设计师拒绝委派 → 通知管理员重新匹配 */
export async function notifyAdminsAssignmentRejected(
  order: Order,
  designerName: string,
  reason?: string,
) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] }, status: "active" },
    select: { id: true, role: true },
  });
  const reasonNote = reason?.trim() ? `原因：${reason.trim()}` : "未填写原因。";
  await Promise.all(
    admins.map((admin) =>
      notifySafe(admin.id, {
        title: "设计师已拒绝委派",
        body: `设计师「${designerName}」已拒绝订单「${order.title}」（${order.code}）。${reasonNote}请重新委派其他设计师。`,
        linkHref:
          admin.role === "super_admin"
            ? `/super-admin/orders/${order.id}`
            : `/admin/orders/${order.id}`,
      }),
    ),
  );
}

/** 常规委托生成等级报价卡后 → 通知管理员二次确认需求 */
export async function notifyAdminsPendingCsQuote(order: Order) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "super_admin"] }, status: "active" },
    select: { id: true, role: true },
  });
  await Promise.all(
    admins.map((admin) =>
      notifySafe(admin.id, {
        title: "待确认委托需求",
        body: `委托人已提交「${order.title}」（${order.code}）。请核对项目信息与附件后二次确认，确认后方可开放委托人选卡匹配。`,
        linkHref:
          admin.role === "super_admin"
            ? `/super-admin/orders/${order.id}`
            : `/admin/orders/${order.id}`,
      }),
    ),
  );
}

/** 管理员 / 超级管理员修改委托信息后 → 通知委托人查看最新详情 */
export async function notifyClientEntrustUpdatedByAdmin(
  order: Order,
  changes: string[],
) {
  const clientUserId = await userIdForClient(order.clientId);
  const detail =
    changes.length > 0
      ? `修改内容如下：\n${changes.join("\n")}`
      : "请打开订单查看最新委托信息。";
  await notifySafe(clientUserId, {
    title: "委托信息已更新",
    body: `客服已更新您的订单「${order.title}」（${order.code}）。\n\n${detail}\n\n请点击查看最新订单详情。报价卡如有调整，需客服再次确认后方可匹配设计师。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 客服确认报价卡后 → 通知委托人可以选卡匹配 */
export async function notifyClientCsQuoteConfirmed(order: Order) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "报价已更新",
    body: `客服已根据您的委托需求更新「${order.title}」（${order.code}）报价。请打开项目查看等级报价卡，并匹配设计师。`,
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

/** 设计师确认接单 → 通知委托人去签约 */
export async function notifyClientDesignerAccepted(
  order: Order,
  designerName: string,
) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "设计师已确认接单",
    body: `设计师「${designerName}」已确认承接「${order.title}」（${order.code}）。请尽快签署电子合同。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 一方签署合同 → 通知对方 */
export async function notifyCounterpartyContractSigned(
  order: Order,
  signer: "client" | "designer",
) {
  if (signer === "client") {
    const designerUserId = await userIdForDesigner(order.designerId);
    await notifySafe(designerUserId, {
      title: "委托人已签署合同",
      body: `订单「${order.title}」（${order.code}）委托人已签署电子合同，请尽快完成设计师签署。`,
      linkHref: `/designer/orders/${order.id}`,
    });
    return;
  }
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "设计师已签署合同",
    body: `订单「${order.title}」（${order.code}）设计师已签署电子合同，请尽快完成委托人签署。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 双方签约完成 → 通知委托人支付预付款，并告知设计师 */
export async function notifyContractFullySigned(order: Order) {
  const [clientUserId, designerUserId] = await Promise.all([
    userIdForClient(order.clientId),
    userIdForDesigner(order.designerId),
  ]);
  await Promise.all([
    notifySafe(clientUserId, {
      title: "双方已签约，请支付预付款",
      body: `订单「${order.title}」（${order.code}）电子合同已完成签署。请支付预付款，支付后项目即可开工。`,
      linkHref: `/client/orders/${order.id}`,
    }),
    notifySafe(designerUserId, {
      title: "双方已签约",
      body: `订单「${order.title}」（${order.code}）电子合同已完成签署，等待委托人支付预付款后即可开工。`,
      linkHref: `/designer/orders/${order.id}`,
    }),
  ]);
}

/** 委托人扫码提交需求 → 通知设计师填写费用与付款阶段 */
export async function notifyDesignerScanOrderSubmitted(order: Order) {
  const designerUserId = await userIdForDesigner(order.designerId);
  await notifySafe(designerUserId, {
    title: "收到扫码下单",
    body: `委托人已通过扫码提交「${order.title}」（${order.code}）。请按平台收费标准或自行报价，设置付款阶段后发给委托人确认。`,
    linkHref: `/designer/orders/${order.id}`,
  });
}

/** 设计师提交扫码费用方案 → 通知委托人确认 */
export async function notifyClientScanQuoteProposed(order: Order) {
  const clientUserId = await userIdForClient(order.clientId);
  await notifySafe(clientUserId, {
    title: "请确认费用与付款阶段",
    body: `设计师已为订单「${order.title}」（${order.code}）提交费用 ${formatCurrency(order.totalAmount)} 与付款阶段，请确认后进入签约。`,
    linkHref: `/client/orders/${order.id}`,
  });
}

/** 委托人确认扫码费用 → 通知设计师签约 */
export async function notifyDesignerScanQuoteConfirmed(order: Order) {
  const designerUserId = await userIdForDesigner(order.designerId);
  await notifySafe(designerUserId, {
    title: "委托人已确认费用",
    body: `委托人已确认订单「${order.title}」（${order.code}）的费用与付款阶段，请双方签署电子合同。`,
    linkHref: `/designer/orders/${order.id}`,
  });
}

/** 委托人提交项目评价 → 通知设计师；结案时一并告知 */
export async function notifyDesignerReviewSubmitted(
  order: Order,
  completed: boolean,
) {
  const designerUserId = await userIdForDesigner(order.designerId);
  await notifySafe(designerUserId, {
    title: completed ? "项目已结案" : "收到项目评价",
    body: completed
      ? `委托人已评价订单「${order.title}」（${order.code}），项目已结案。可在历史评价中查看评分。`
      : `委托人已评价订单「${order.title}」（${order.code}）。可在历史评价中查看评分。`,
    linkHref: `/designer/orders/${order.id}`,
  });
}
