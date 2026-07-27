import { handle, ok } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { countUnreadInbox } from "@/lib/server/inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSessionUser();
    if (!session) return ok({ count: 0 });
    const count = await countUnreadInbox(session.userId);
    return ok({ count });
  });
}
