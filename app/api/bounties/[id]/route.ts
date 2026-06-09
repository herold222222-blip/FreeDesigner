import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getBounty, saveBounty, deleteBounty } from "@/lib/server/repo";
import { getSessionUser, requireSession } from "@/lib/server/auth";
import { applyBountyApplicantPrivacy } from "@/lib/bounty-privacy";
import { canManageBountyBeforeContract } from "@/lib/bounty-manage";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await getSessionUser();
    const bounty = await getBounty(params.id);
    if (!bounty) return fail(404, "悬赏不存在");
    return ok(applyBountyApplicantPrivacy(bounty, session));
  });
}

type ManageBody =
  | { action: "pause" }
  | { action: "resume" }
  | {
      action: "update";
      title?: string;
      description?: string;
      reward?: number;
      deadline?: string;
      requirements?: string[];
    };

/** 委托人签约前：暂停 / 恢复 / 修改悬赏 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可管理悬赏");

    const bounty = await getBounty(params.id);
    if (!bounty) return fail(404, "悬赏不存在");
    if (bounty.publisherId !== session.identityId) {
      return fail(403, "无权操作该悬赏");
    }
    if (!canManageBountyBeforeContract(bounty)) {
      return fail(409, "已选定设计师或已结案，无法修改悬赏");
    }

    const body = (await req.json()) as ManageBody;

    if (body.action === "pause") {
      if (bounty.status === "paused") return ok(bounty);
      bounty.status = "paused";
    } else if (body.action === "resume") {
      if (bounty.status !== "paused") return fail(400, "仅已暂停的悬赏可恢复");
      bounty.status = "open";
    } else if (body.action === "update") {
      if (body.title?.trim()) bounty.title = body.title.trim();
      if (body.description !== undefined) {
        bounty.description = body.description.trim();
      }
      if (body.reward !== undefined) {
        if (body.reward <= 0) return fail(400, "悬赏金额须大于 0");
        bounty.reward = Math.round(body.reward);
      }
      if (body.deadline) bounty.deadline = body.deadline;
      if (body.requirements) {
        bounty.requirements = body.requirements
          .map((r) => r.trim())
          .filter(Boolean);
      }
    } else {
      return fail(400, "未知操作");
    }

    await saveBounty(bounty);
    return ok(applyBountyApplicantPrivacy(bounty, session));
  });
}

/** 委托人签约前：删除悬赏 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可删除悬赏");

    const bounty = await getBounty(params.id);
    if (!bounty) return fail(404, "悬赏不存在");
    if (bounty.publisherId !== session.identityId) {
      return fail(403, "无权操作该悬赏");
    }
    if (!canManageBountyBeforeContract(bounty)) {
      return fail(409, "已选定设计师或已结案，无法删除悬赏");
    }

    await deleteBounty(params.id);
    return ok({ deleted: true });
  });
}
