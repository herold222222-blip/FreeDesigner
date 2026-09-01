import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import { maskPhoneDigits } from "@/lib/designer-contact-privacy";
import {
  getClient,
  getClientWithAccountPhone,
  hasSignedOrderBetweenClientAndDesigner,
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
    const isSignedCounterpart =
      session?.role === "designer" &&
      Boolean(session.identityId) &&
      (await hasSignedOrderBetweenClientAndDesigner(
        client.id,
        session.identityId,
      ));

    const withPhone = await getClientWithAccountPhone(params.id);
    const source = withPhone ?? client;
    if (isSelf || isAdmin || isSignedCounterpart) {
      return ok(source);
    }

    return ok({
      ...source,
      phone: source.phone
        ? maskPhoneDigits(source.phone.replace(/\s/g, ""))
        : undefined,
    });
  });
}
