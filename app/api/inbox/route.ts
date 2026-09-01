import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import {
  createInboxMessage,
  deleteAllInboxMessages,
  listInboxMessages,
  markAllInboxRead,
} from "@/lib/server/inbox";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const messages = await listInboxMessages(session.userId);
    return ok({ messages });
  });
}

const postSchema = z.object({
  /** 发送给指定用户；仅管理员可发系统广播以外的定向消息 */
  toUserId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  linkHref: z.string().max(500).optional(),
});

/** 用户互发 / 管理员代发站内信 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.toUserId },
      select: { id: true },
    });
    if (!target) return fail(404, "收件人不存在");

    const isAdmin =
      session.role === "admin" || session.role === "super_admin";
    const message = await createInboxMessage({
      userId: target.id,
      kind: isAdmin ? "system" : "user",
      fromName: isAdmin ? "乐自由" : session.name || "用户",
      fromUserId: isAdmin ? null : session.userId,
      title: parsed.data.title,
      body: parsed.data.body,
      linkHref: parsed.data.linkHref,
    });
    return ok({ message });
  });
}

/** 全部标为已读 */
export async function PATCH() {
  return handle(async () => {
    const session = await requireSession();
    const updated = await markAllInboxRead(session.userId);
    return ok({ updated });
  });
}

/** 清空当前用户全部消息 */
export async function DELETE() {
  return handle(async () => {
    const session = await requireSession();
    const deleted = await deleteAllInboxMessages(session.userId);
    return ok({ deleted });
  });
}
