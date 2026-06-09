import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { updateWithdrawalRequestStatus } from "@/lib/server/repo";
import type { WithdrawalRequestStatus } from "@/lib/withdrawal-requests";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      rejectReason?: string;
    };

    let status: WithdrawalRequestStatus;
    if (body.action === "approve") status = "approved";
    else if (body.action === "reject") status = "rejected";
    else if (body.action === "pay") status = "paid";
    else return fail(400, "无效的操作");

    if (status === "rejected" && !body.rejectReason?.trim()) {
      return fail(400, "请填写驳回理由");
    }

    const updated = await updateWithdrawalRequestStatus(params.id, status, {
      rejectReason: body.rejectReason,
    });
    if (!updated) return fail(404, "提现申请不存在");
    return ok(updated);
  });
}
