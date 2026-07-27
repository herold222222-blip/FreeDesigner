import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { updateFeedbackMessage } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import { createInboxMessage } from "@/lib/server/inbox";
import type { FeedbackMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json()) as {
      status?: FeedbackMessage["status"];
      replyNote?: string;
    };
    const updated = await updateFeedbackMessage(params.id, body);
    if (!updated) throw new Error("留言不存在");

    if (
      updated.userId &&
      (body.status === "replied" || Boolean(body.replyNote?.trim()))
    ) {
      const reply = body.replyNote?.trim();
      await createInboxMessage({
        userId: updated.userId,
        kind: "system",
        title: "客服已回复您的留言",
        body: reply
          ? `客服回复：${reply}`
          : "客服已处理您的留言，如需继续沟通请再次联系客服。",
        linkHref:
          updated.audience === "designer" ? "/designer/messages" : "/client/messages",
      }).catch(() => {
        /* ignore */
      });
    }

    return ok(updated);
  });
}
