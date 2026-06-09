import type { Bounty } from "@/lib/types";

/** 签约前委托人可管理悬赏的状态 */
export const BOUNTY_MANAGEABLE_STATUSES = [
  "open",
  "paused",
  "in_review",
] as const;

export function canManageBountyBeforeContract(bounty: Bounty): boolean {
  return (BOUNTY_MANAGEABLE_STATUSES as readonly string[]).includes(
    bounty.status,
  );
}

export function bountyStatusLabel(status: Bounty["status"]): string {
  switch (status) {
    case "open":
      return "开放报名";
    case "paused":
      return "已暂停";
    case "in_review":
      return "报名审核中";
    case "awarded":
      return "已选定设计师";
    case "completed":
      return "已完成";
    case "closed":
      return "已关闭";
    default:
      return status;
  }
}

export type BountyStatusFilter = Bounty["status"] | "all";

export const BOUNTY_STATUS_FILTER_TABS: {
  value: BountyStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "open", label: bountyStatusLabel("open") },
  { value: "in_review", label: bountyStatusLabel("in_review") },
  { value: "awarded", label: bountyStatusLabel("awarded") },
  { value: "paused", label: bountyStatusLabel("paused") },
  { value: "completed", label: bountyStatusLabel("completed") },
  { value: "closed", label: bountyStatusLabel("closed") },
];

export function bountyStatusBadgeVariant(
  status: Bounty["status"],
): "emerald" | "amber" | "muted" | "blue" {
  switch (status) {
    case "open":
      return "emerald";
    case "paused":
    case "in_review":
      return "amber";
    case "awarded":
      return "blue";
    case "completed":
      return "emerald";
    default:
      return "muted";
  }
}
