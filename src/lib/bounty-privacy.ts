import type { SessionUser } from "@/lib/server/auth";
import type { Bounty } from "@/lib/types";
import {
  isBountyTitlePublic,
  maskBountyHallDescription,
  maskBountyHallTitle,
} from "@/lib/bounty-hall-privacy";

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
  const mine =
    session?.role === "designer"
      ? bounty.applicants.find((a) => a.designerId === session.identityId)
      : undefined;
  return {
    ...redactBountyApplicants(bounty),
    applicants: mine ? [mine] : [],
  };
}

/** 发布方、管理员始终可见；中标设计师须双方签约后才可见全文 */
export function canViewBountyHallFullInfo(
  session: SessionUser | null,
  bounty: Bounty,
  contractSigned = false,
): boolean {
  if (!session) return false;
  if (session.role === "admin" || session.role === "super_admin") return true;
  if (session.role === "client" && session.identityId === bounty.publisherId) {
    return true;
  }
  if (
    session.role === "designer" &&
    bounty.awardedDesignerId === session.identityId &&
    contractSigned
  ) {
    return true;
  }
  return false;
}

export function applyBountyHallFieldPrivacy(
  bounty: Bounty,
  session: SessionUser | null,
  contractSigned = false,
): Bounty {
  if (canViewBountyHallFullInfo(session, bounty, contractSigned)) return bounty;
  return {
    ...bounty,
    title: isBountyTitlePublic(bounty)
      ? bounty.title
      : maskBountyHallTitle(bounty.title, bounty),
    description: maskBountyHallDescription(bounty.description),
  };
}

/** 大厅列表 / 公开详情：报名明细 + 项目名 / 联系人脱敏 */
export function applyBountyPublicPrivacy(
  bounty: Bounty,
  session: SessionUser | null,
  options?: { contractSigned?: boolean },
): Bounty {
  return applyBountyHallFieldPrivacy(
    applyBountyApplicantPrivacy(bounty, session),
    session,
    options?.contractSigned ?? false,
  );
}
