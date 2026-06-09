import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { confirmSchedule } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师确认档期：pending_schedule → pending_contract */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await confirmSchedule(params.id, session.identityId);
    return ok(order);
  });
}
