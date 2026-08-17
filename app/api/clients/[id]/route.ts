import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import {
  getClient,
  getClientWithAccountPhone,
  hasOrderBetweenClientAndDesigner,
} from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await getSessionUser();
    const client = await getClient(params.id);
    if (!client) return fail(404, "委托人不存在");

    const isSelf =
      session?.role === "client" && session.identityId === client.id;
    const isAdmin =
      session?.role === "admin" || session?.role === "super_admin";
    const isOrderCounterpart =
      session?.role === "designer" &&
      Boolean(session.identityId) &&
      (await hasOrderBetweenClientAndDesigner(client.id, session.identityId));

    if (isSelf || isAdmin || isOrderCounterpart) {
      const withPhone = await getClientWithAccountPhone(params.id);
      return ok(withPhone ?? client);
    }

    return ok({ ...client, phone: undefined });
  });
}
