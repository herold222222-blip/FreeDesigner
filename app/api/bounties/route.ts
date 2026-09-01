import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { listBounties, createBounty, getClient, getDesignerByCode } from "@/lib/server/repo";
import { getSessionUser, requireSession } from "@/lib/server/auth";
import { applyBountyListPublicPrivacy } from "@/lib/server/bounty-hall-privacy";
import { parseBountyTitleVisibility } from "@/lib/bounty-hall-privacy";
import {
  isSameAccountClientAndDesigner,
  notifyAdminsBountyPublished,
  notifyDesignersBountyInvite,
} from "@/lib/server/inbox";
import { normalizeDesignerCode } from "@/lib/designer-code";
import { isBountyRewardValid } from "@/lib/bounty-manage";
import {
  bountyTaxCoefficient,
  parseBountyInvoiceType,
} from "@/lib/bounty-invoice";
import { parseBountyPaymentStages, resolveBountyPaymentStages } from "@/lib/bounty-payment-stages";
import {
  normalizeBountyDeadline,
  normalizeBountyValidUntil,
} from "@/lib/bounty-validity";
import type { Bounty } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSessionUser();
    const bounties = await listBounties();
    return ok(await applyBountyListPublicPrivacy(bounties, session));
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
    if (!body.projectType?.trim()) return fail(400, "请选择项目类型");
    const reward = Math.round(Number(body.reward ?? 0));
    if (!isBountyRewardValid(reward)) {
      return fail(400, "悬赏金额须大于 100 元");
    }
    const invoiceType = parseBountyInvoiceType(body.invoiceType);
    if (!invoiceType) {
      return fail(400, "请选择发票信息");
    }
    const paymentStages = body.paymentStages
      ? parseBountyPaymentStages(body.paymentStages)
      : resolveBountyPaymentStages({});
    if (body.paymentStages && !paymentStages) {
      return fail(400, "付款阶段比例须合计 100%，且每阶段须填写付款条件说明");
    }
    const validUntilResult = normalizeBountyValidUntil(body.validUntil, {
      requireFuture: true,
    });
    if (!validUntilResult.ok) return fail(400, validUntilResult.error);
    const deadlineResult = normalizeBountyDeadline(body.deadline);
    if (!deadlineResult.ok) return fail(400, deadlineResult.error);

    const preferredDesignerCodes = [
      ...new Set(
        (body.preferredDesignerCodes ?? [])
          .map((c) => normalizeDesignerCode(c))
          .filter(Boolean),
      ),
    ];

    const id = body.id ?? `bounty_${Date.now()}`;
    const code = body.code ?? `XS-${Date.now().toString().slice(-6)}`;
    const bounty: Bounty = {
      id,
      code,
      title: body.title,
      titleVisibility: parseBountyTitleVisibility(body.titleVisibility),
      specialty: body.specialty ?? "architecture",
      primaryTrack: body.primaryTrack ?? { l1: "architecture", l2: [], l3: [] },
      projectType: body.projectType,
      location:
        body.location ?? { provinceCode: "", provinceName: "", label: "" },
      description: body.description ?? "",
      reward,
      rewardModel: body.rewardModel ?? "negotiable",
      invoiceType,
      taxCoefficient: bountyTaxCoefficient(invoiceType),
      paymentStages: paymentStages ?? resolveBountyPaymentStages({}),
      deadline: deadlineResult.value,
      validUntil: validUntilResult.value,
      publishedAt: new Date().toISOString(),
      publisherId: session.identityId,
      status: "open",
      attachments: body.attachments ?? [],
      requirements: body.requirements ?? [],
      applicants: [],
      preferredDesignerCodes: preferredDesignerCodes.length
        ? preferredDesignerCodes
        : undefined,
      subjectFilters: body.subjectFilters,
    };
    await createBounty(bounty);

    const publisher = await getClient(session.identityId);
    await notifyAdminsBountyPublished({
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyCode: bounty.code,
      reward: bounty.reward,
      publisherName: publisher?.name || publisher?.companyName,
    });

    const invitedIds: string[] = [];
    for (const designerCode of preferredDesignerCodes) {
      const designer = await getDesignerByCode(designerCode);
      if (!designer) continue;
      if (
        await isSameAccountClientAndDesigner(session.identityId, designer.id)
      ) {
        continue;
      }
      invitedIds.push(designer.id);
    }
    if (invitedIds.length > 0) {
      await notifyDesignersBountyInvite({
        bountyId: bounty.id,
        bountyTitle: bounty.title,
        bountyCode: bounty.code,
        reward: bounty.reward,
        designerIds: invitedIds,
      });
    }

    return ok(bounty, { status: 201 });
  });
}
