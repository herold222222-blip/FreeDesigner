import type { SessionUser } from "@/lib/server/auth";
import type { Bounty } from "@/lib/types";

/** 管理员或悬赏发布方（委托人工作台）可查看报名详情 */
export function canViewBountyApplicantDetails(
  session: SessionUser | null,
  bounty: Bounty,
): boolean {
  if (!session) return false;
  if (session.role === "admin" || session.role === "super_admin") return true;
  if (session.role === "client" && session.identityId === bounty.publisherId) {
    return true;
  }
  return false;
}

/** 悬赏大厅公开详情页：仅管理员可查看报名设计师明细 */
export function canViewBountyApplicantDetailsInPublicHall(
  session: SessionUser | null,
): boolean {
  if (!session) return false;
  return session.role === "admin" || session.role === "super_admin";
}

export function bountyApplicantCount(bounty: Bounty): number {
  return bounty.applicantCount ?? bounty.applicants.length;
}

export function redactBountyApplicants(bounty: Bounty): Bounty {
  return {
    ...bounty,
    applicantCount: bountyApplicantCount(bounty),
    applicants: [],
  };
}

export function applyBountyApplicantPrivacy(
  bounty: Bounty,
  session: SessionUser | null,
): Bounty {
  if (canViewBountyApplicantDetails(session, bounty)) return bounty;
  return redactBountyApplicants(bounty);
}
