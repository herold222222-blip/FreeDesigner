import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getBounty, getDesigner, saveBounty } from "@/lib/server/repo";
import {
  designerHasL3,
  normalizeBountyTrack,
} from "@/lib/bounty-tracks";
import type { BountyApplicant } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 设计师报名悬赏：写入报名记录 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可报名悬赏");

    const bounty = await getBounty(params.id);
    if (!bounty) return fail(404, "悬赏不存在");
    if (bounty.status !== "open") return fail(409, "该悬赏已停止报名");
    if (bounty.applicants.some((a) => a.designerId === session.identityId)) {
      return fail(409, "你已报名该悬赏");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<BountyApplicant>;
    const appliedL3 = body.appliedL3?.trim();
    if (!appliedL3) return fail(400, "请选择承接的三级专业");

    const track = normalizeBountyTrack(bounty.primaryTrack);
    if (!track.l3.includes(appliedL3)) {
      return fail(400, "所选三级专业不在悬赏要求范围内");
    }

    const designer = await getDesigner(session.identityId);
    if (!designer) return fail(404, "设计师资料不存在");
    if (!designerHasL3(designer, appliedL3)) {
      return fail(403, "您的注册专业与所选三级专业不匹配");
    }

    const applicant: BountyApplicant = {
      designerId: session.identityId,
      appliedL3,
      proposal: body.proposal ?? "",
      quotedAmount: body.quotedAmount ?? bounty.reward,
      estimatedDays: body.estimatedDays ?? 0,
      appliedAt: new Date().toISOString(),
    };
    bounty.applicants = [...bounty.applicants, applicant];
    await saveBounty(bounty);
    return ok(bounty);
  });
}
