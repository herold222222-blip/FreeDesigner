import { handle, ok } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { touchDesignerPresence } from "@/lib/server/designer-presence";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (user?.role === "designer") {
      await touchDesignerPresence(user.userId);
    }
    return ok({ user });
  });
}
