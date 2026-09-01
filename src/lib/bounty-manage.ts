import type { Bounty } from "@/lib/types";
import { isBountyValidityExpired } from "@/lib/bounty-validity";

/** 悬赏金额须严格大于此值（元） */
export const BOUNTY_REWARD_MIN_EXCLUSIVE = 100;

export function isBountyRewardValid(amount: number): boolean {
  return Number.isFinite(amount) && amount > BOUNTY_REWARD_MIN_EXCLUSIVE;
}

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
      return "已取消";
    default:
      return status;
  }
}

/** 公开悬赏详情侧栏：仅文字提示，不提供操作按钮 */
export function bountyPublicTodoHint(input: {
  status: Bounty["status"];
  viewerRole: string;
  isPublisher: boolean;
  alreadyApplied: boolean;
  validUntil?: string | null;
}): string {
  if (input.status === "open" && isBountyValidityExpired(input.validUntil)) {
    return "本悬赏有效期已过，暂不可提交新报名。";
  }
  if (input.status === "paused") {
    return "本悬赏已暂停报名，暂不可提交新报名。";
  }
  if (input.status === "awarded") {
    return "委托人已选定设计师，本悬赏报名已结束。";
  }
  if (input.status === "completed" || input.status === "closed") {
    return "本悬赏已结束。";
  }
  if (input.status === "in_review") {
    return "委托人正在查看报名，请耐心等待选定结果。";
  }
  if (input.viewerRole === "client" && input.isPublisher) {
    return "你是本悬赏发布方。请前往委托人工作台查看报名并选择合作设计师。";
  }
  if (input.viewerRole === "client") {
    return "当前为委托人身份。如需报名，请切换为设计师身份后，在左侧报名区提交。";
  }
  if (input.viewerRole === "designer" && input.alreadyApplied) {
    return "你已报名本悬赏，请等待委托人查看并选定合作人选。";
  }
  if (input.viewerRole === "designer") {
    return "本悬赏开放报名。请在左侧填写承接专业与方案后提交报名。";
  }
  if (input.viewerRole === "admin" || input.viewerRole === "super_admin") {
    return "管理员可查看公开详情。报名与选定请在对应工作台完成。";
  }
  return "本悬赏开放报名。请使用设计师身份登录后，在左侧报名区提交报名。";
}

export type BountyStatusFilter =
  | "all"
  | "open"
  | "in_review"
  | "paused"
  | "in_progress"
  | "pending_payment"
  | "pending_client_sign"
  | "pending_designer_sign"
  | "pending_review"
  | "pending_client_review"
  | "in_revision"
  | "completed"
  | "cancelled";

/** 委托人「我的悬赏」：报名阶段 + 与常规订单一致的履约筛选 */
export const BOUNTY_STATUS_FILTER_TABS: {
  value: BountyStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部状态" },
  { value: "open", label: bountyStatusLabel("open") },
  { value: "in_review", label: bountyStatusLabel("in_review") },
  { value: "paused", label: bountyStatusLabel("paused") },
  { value: "in_progress", label: "进行中" },
  { value: "pending_payment", label: "待支付" },
  { value: "pending_client_sign", label: "待签约" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_client_review", label: "待评价" },
  { value: "pending_designer_sign", label: "待设计师签约" },
  { value: "in_revision", label: "返修中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
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
