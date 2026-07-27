import type {
  Bounty,
  BountyAttachment,
  BountyLocation,
  Specialty,
} from "@/lib/types";
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
  /** 二级专业标签 */
  timeL2Labels?: string[];
  /** 各三级专业工时：标签 + 天数/月数 */
  timeL3Units?: Array<{ label: string; units: number; unitLabel: string }>;
  withAudit?: boolean;
  withPM?: boolean;
}): string {
  const timeLines =
    input.timeL3Units?.length ?
      [
        `二级专业：${(input.timeL2Labels ?? []).join("、") || "—"}`,
        ...input.timeL3Units.map(
          (row) => `· ${row.label}：${row.units} ${row.unitLabel}`,
        ),
      ]
    : null;

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
      ? [
          `面积：${input.area} ㎡ · 三级专业：${(input.tracks ?? []).join("、") || "—"}`,
          input.timeL2Labels?.length
            ? `二级专业：${input.timeL2Labels.join("、")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    input.billingMode === "daily" || input.billingMode === "monthly"
      ? timeLines?.length
        ? [`工时明细：`, ...timeLines].join("\n")
        : input.billingMode === "daily"
          ? `工时：${input.days ?? 0} 工日 · ${input.trackKey ?? "—"}`
          : `雇佣：${input.months ?? 0} 个月 · ${input.trackKey ?? "—"}`
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
  attachments?: BountyAttachment[];
  withDrawing?: boolean;
  timeQuoteLines?: Array<{
    l3: string;
    l3Label: string;
    quantity: number;
    difficultyKey?: string;
  }>;
}): CreateOrderBody {
  const budget =
    typeof input.budget === "number" && input.budget > 0 ? input.budget : 0;
  const isTimeBilling =
    input.billingMode === "daily" || input.billingMode === "monthly";
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
    attachments: input.attachments?.length ? input.attachments : undefined,
    timeQuote:
      isTimeBilling && input.timeQuoteLines?.length
        ? {
            unit: input.billingMode === "daily" ? "day" : "month",
            withDrawing: input.withDrawing,
            lines: input.timeQuoteLines,
          }
        : undefined,
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
  attachments: Bounty["attachments"];
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
