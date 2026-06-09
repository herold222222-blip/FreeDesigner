import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getClient } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const client = await getClient(params.id);
    if (!client) return fail(404, "委托人不存在");
    return ok(client);
  });
}
