import type { TeamSizeOption } from "@/lib/types";

export type OnlineMeetingTimeOption =
  | "anytime"
  | "work_hours"
  | "off_hours"
  | "advance_notice";

export type TravelDurationOption = "short" | "long";

/** 团队 / 公司人数区间选项 */
export const TEAM_SIZE_OPTIONS: { value: TeamSizeOption; label: string }[] = [
  { value: "1-10", label: "1-10 人" },
  { value: "11-20", label: "11-20 人" },
  { value: "21-50", label: "21-50 人" },
  { value: "51-100", label: "51-100 人" },
  { value: "101-200", label: "101-200 人" },
  { value: "200+", label: "200 人以上" },
];

export function getTeamSizeLabel(value?: TeamSizeOption) {
  if (!value) return "未设置";
  return TEAM_SIZE_OPTIONS.find((o) => o.value === value)?.label ?? "未设置";
}

export const ONLINE_MEETING_TIME_OPTIONS: {
  value: OnlineMeetingTimeOption;
  label: string;
}[] = [
  { value: "anytime", label: "a. 随时可以" },
  { value: "work_hours", label: "b. 工作时间" },
  { value: "off_hours", label: "c. 非工作时间" },
  { value: "advance_notice", label: "d. 需提前沟通" },
];

export const TRAVEL_DURATION_OPTIONS: {
  value: TravelDurationOption;
  label: string;
}[] = [
  { value: "short", label: "短期出差（一周内）" },
  { value: "long", label: "长期出差" },
];

/** 境外项目国家 / 地区（可多选） */
export const OVERSEAS_COUNTRY_OPTIONS = [
  "美国",
  "加拿大",
  "英国",
  "法国",
  "德国",
  "日本",
  "韩国",
  "新加坡",
  "马来西亚",
  "泰国",
  "阿联酋",
  "沙特阿拉伯",
  "澳大利亚",
  "新西兰",
  "其他",
] as const;

export function getOnlineMeetingTimeLabel(value?: OnlineMeetingTimeOption) {
  return (
    ONLINE_MEETING_TIME_OPTIONS.find((o) => o.value === value)?.label ??
    "未设置"
  );
}

export function getTravelDurationLabel(value?: TravelDurationOption | null) {
  if (!value) return "";
  return TRAVEL_DURATION_OPTIONS.find((o) => o.value === value)?.label ?? "";
}

export const BACK_TO_BACK_CONTRACT_NOTE =
  "选择接受背靠背可能提高项目匹配率。目前背靠背仅对平台战略客户开放，可靠性高。";

export const PORTFOLIO_PROJECT_TYPE_NOTE =
  "入驻时不可直接填写；主页展示的项目类型根据您上传的案例分类自动生成。";
