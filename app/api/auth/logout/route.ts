import { handle, ok } from "@/lib/server/api";
import { destroySession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    await destroySession();
    return ok({ loggedOut: true });
  });
}
