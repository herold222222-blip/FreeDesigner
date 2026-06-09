import type { Bounty, BountyLocation, Specialty } from "@/lib/types";
import type { CreateOrderBody } from "@/lib/api-client";
import type { BillingMode } from "@/lib/types";

export function buildRegularEntrustDescription(input: {
  description: string;
  contactName: string;
  contactPhone: string;
  projectCity: string;
  committerName?: string;
  billingMode: string;
  area?: number;
  days?: number;
  months?: number;
  tracks?: string[];
  trackKey?: string;
  withAudit?: boolean;
  withPM?: boolean;
}): string {
  const lines = [
    input.description.trim(),
    "",
    "--- 委托联系信息 ---",
    input.committerName ? `委托方：${input.committerName}` : null,
    `联系人：${input.contactName}`,
    `电话：${input.contactPhone}`,
    input.projectCity ? `项目城市：${input.projectCity}` : null,
    "",
    "--- 计费摘要 ---",
    `计费方式：${input.billingMode}`,
    input.billingMode === "area" && input.area
      ? `面积：${input.area} ㎡ · 专业：${(input.tracks ?? []).join("、") || "—"}`
      : null,
    input.billingMode === "daily"
      ? `工时：${input.days ?? 0} 工日 · ${input.trackKey ?? "—"}`
      : null,
    input.billingMode === "monthly"
      ? `雇佣：${input.months ?? 0} 个月 · ${input.trackKey ?? "—"}`
      : null,
    input.withAudit ? "增值服务：第三方审图" : null,
    input.withPM ? "增值服务：项目管理" : null,
    "",
    "平台将匹配设计师并确认最终费用后进入签约。",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildRegularEntrustOrderBody(input: {
  title: string;
  specialty: Specialty;
  projectType: string;
  billingMode: BillingMode;
  serviceMode: "online" | "onsite";
  description: string;
  area?: number;
  budget?: number | "";
  withAudit?: boolean;
  withPM?: boolean;
}): CreateOrderBody {
  const budget =
    typeof input.budget === "number" && input.budget > 0 ? input.budget : 0;
  return {
    title: input.title.trim(),
    specialty: input.specialty,
    projectType: input.projectType,
    serviceMode: input.serviceMode,
    billingMode: input.billingMode,
    orderSource: "regular",
    totalAmount: budget > 0 ? budget : 1,
    description: input.description,
    projectAreaSqm: input.billingMode === "area" ? input.area : undefined,
    withAuditService: input.withAudit,
    withProjectManagement: input.withPM,
  };
}

export function buildBountyCreateBody(input: {
  title: string;
  specialty: Specialty;
  primaryTrack: Bounty["primaryTrack"];
  projectType?: string;
  location: BountyLocation;
  description: string;
  reward: number;
  deadline: string;
  requirements: string[];
  attachments: { name: string }[];
  preferredDesignerCodes?: string[];
  subjectFilters?: Bounty["subjectFilters"];
  contactName: string;
  contactPhone: string;
  projectCity?: string;
}): Partial<Bounty> {
  const desc = [
    input.description.trim(),
    "",
    `联系人：${input.contactName}`,
    `电话：${input.contactPhone}`,
    input.projectCity ? `项目城市：${input.projectCity}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: input.title.trim(),
    specialty: input.specialty,
    primaryTrack: input.primaryTrack,
    projectType: input.projectType,
    location: input.location,
    description: desc,
    reward: input.reward,
    rewardModel: "fixed",
    deadline: input.deadline,
    requirements: input.requirements,
    attachments: input.attachments,
    preferredDesignerCodes: input.preferredDesignerCodes,
    subjectFilters: input.subjectFilters,
  };
}
