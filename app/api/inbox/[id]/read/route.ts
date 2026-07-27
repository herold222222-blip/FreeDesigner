import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { markInboxMessageRead } from "@/lib/server/inbox";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const message = await markInboxMessageRead(session.userId, params.id);
    if (!message) return fail(404, "消息不存在");
    return ok({ message });
  });
}
