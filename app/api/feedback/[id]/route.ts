import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { updateFeedbackMessage } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
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
    return ok(updated);
  });
}
