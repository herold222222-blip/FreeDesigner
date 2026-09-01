import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { deleteInboxMessage } from "@/lib/server/inbox";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const deleted = await deleteInboxMessage(session.userId, params.id);
    if (!deleted) return fail(404, "消息不存在");
    return ok({ deleted: true });
  });
}
