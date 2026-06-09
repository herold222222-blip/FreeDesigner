import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { listBounties, createBounty } from "@/lib/server/repo";
import { getSessionUser, requireSession } from "@/lib/server/auth";
import { applyBountyApplicantPrivacy } from "@/lib/bounty-privacy";
import type { Bounty } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSessionUser();
    const bounties = await listBounties();
    return ok(bounties.map((b) => applyBountyApplicantPrivacy(b, session)));
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可发布悬赏");
    }
    const body = (await req.json().catch(() => null)) as Partial<Bounty> | null;
    if (!body || !body.title) return fail(400, "缺少必要字段");

    const id = body.id ?? `bounty_${Date.now()}`;
    const code = body.code ?? `XS-${Date.now().toString().slice(-6)}`;
    const bounty: Bounty = {
      id,
      code,
      title: body.title,
      specialty: body.specialty ?? "architecture",
      primaryTrack: body.primaryTrack ?? { l1: "architecture", l2: [], l3: [] },
      projectType: body.projectType,
      location:
        body.location ?? { provinceCode: "", provinceName: "", label: "" },
      description: body.description ?? "",
      reward: body.reward ?? 0,
      rewardModel: body.rewardModel ?? "negotiable",
      deadline: body.deadline ?? "",
      publishedAt: new Date().toISOString(),
      publisherId: session.identityId,
      status: "open",
      attachments: body.attachments ?? [],
      requirements: body.requirements ?? [],
      applicants: [],
      preferredDesignerCodes: body.preferredDesignerCodes,
      subjectFilters: body.subjectFilters,
    };
    await createBounty(bounty);
    return ok(bounty, { status: 201 });
  });
}
