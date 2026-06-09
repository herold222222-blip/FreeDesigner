import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { createFeedbackMessage, listFeedbackMessages } from "@/lib/server/repo";
import { requireRole, requireSession } from "@/lib/server/auth";
import type { FeedbackMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    return ok(await listFeedbackMessages());
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client" && session.role !== "designer") {
      throw new Error("仅委托人或设计师可提交留言");
    }
    const body = (await req.json()) as {
      message: string;
      userName?: string;
      phone?: string;
      identityId?: string;
    };
    const message = body.message?.trim();
    if (!message) throw new Error("请填写留言内容");

    const item = await createFeedbackMessage({
      audience: session.role,
      userId: session.userId,
      identityId: body.identityId ?? session.identityId,
      userName: body.userName?.trim() || session.name,
      phone: body.phone?.trim() || session.phone,
      message,
    });
    return ok(item satisfies FeedbackMessage);
  });
}
