import { handle, ok } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    return ok({ user });
  });
}
