import { CLIENT_LEVEL_META, DESIGNER_LEVEL_META } from "@/lib/constants";
import type { ClientLevel, DesignerLevel } from "@/lib/types";

export const LEVEL_CATEGORIES = [
  { key: "design_subject", label: "设计主体", kind: "designer" },
  { key: "client", label: "委托人", kind: "client" },
] as const;

export type LevelCategory = (typeof LEVEL_CATEGORIES)[number]["key"];

export type PromotionMode = "auto" | "approval";

export const INTERN_LEVEL_ID = "intern";

export const INTERN_PROMOTION_LABEL = "注册后审核通过";

export interface ManagedLevel {
  id: string;
  name: string;
  /** 达到该等级的条件 */
  condition: string;
  promotionMode: PromotionMode;
  order: number;
  /** 限制条件或权限说明 */
  restrictions: string;
  /** 取费费率百分比（与费用计算器等级系数一致，100 表示 100%） */
  feeRate: number;
  /** 设计主体：提现条件 */
  withdrawCondition?: string;
  /** 委托人：付款条件 */
  paymentCondition?: string;
  /** 委托人：其他特权 */
  privileges?: string;
}

export type LevelManagementConfig = Record<LevelCategory, ManagedLevel[]>;

export interface LevelStatsEntry {
  levelId: string;
  levelName: string;
  count: number;
}

export interface CategoryLevelStats {
  category: LevelCategory;
  categoryLabel: string;
  total: number;
  levels: LevelStatsEntry[];
}

const LEGACY_DESIGNER_CATEGORY_KEYS = [
  "designer_individual",
  "designer_team",
  "designer_company",
] as const;

const LEGACY_CLIENT_CATEGORY_KEYS = [
  "client_individual",
  "client_enterprise",
] as const;

const DESIGNER_LEVEL_NAMES: Record<DesignerLevel, string> = {
  intern: "见习设计师",
  mid_v1: "中级设计师v1",
  senior_v1: "高级设计师v1",
  specialist: "特级设计师",
};

const DESIGNER_CONDITIONS: Record<DesignerLevel, string> = {
  intern: "注册后审核通过即可",
  mid_v1:
    "在该阶段完成至少 5 个订单之后，单个订单评价不低于 4.0，平均评价高于 4.5 方可主动申请，管理员后台审批",
  senior_v1:
    "在该阶段完成至少 5 个订单之后，单个订单评价不低于 4.3，平均评价高于 4.7 方可主动申请，管理员后台审批",
  specialist:
    "在该阶段完成至少 5 个订单之后，单个订单评价不低于 4.3，平均评价高于 4.7 方可主动申请，管理员后台审批",
};

const DESIGNER_WITHDRAW_DEFAULTS: Record<DesignerLevel, string> = {
  intern: "验收后资金冻结 30 天，期满且无异议可申请提现。",
  mid_v1: "分阶段验收通过后冻结期满可申请提现；平台扣 8% 手续费。",
  senior_v1: "同中级；高等级项目可申请缩短冻结周期（需审批）。",
  specialist: "可按协议约定结算节奏提现。",
};

const DESIGNER_RESTRICTIONS: Record<DesignerLevel, string> = {
  intern: "同时仅可承接 1 单；不可参与悬赏抢单优选排序。",
  mid_v1: "可正常接单与报价；标准平台权益。",
  senior_v1: "可承接高难度项目；列表优先展示。",
  specialist: "可自定义报价；平台重点推荐位。",
};

const CLIENT_LEVEL_NAMES: Record<ClientLevel, string> = {
  strategic: "战略客户",
  premium: "优质客户",
  normal: "普通客户",
  secondary: "次级客户",
  graylist: "灰名单",
};

const CLIENT_CONDITIONS: Record<ClientLevel, string> = {
  strategic: "前一年支付 ≥ 50 万",
  premium: "连续 3 次按时付款",
  normal: "初次注册",
  secondary: "2 次延迟 0-1 个月",
  graylist: "订单支付超时 ≥ 3 个月",
};

const CLIENT_PAYMENT_DEFAULTS: Record<ClientLevel, string> = {
  strategic: "延期支付特权 3 个月",
  premium: "延期支付特权 1 个月",
  normal: "无延期特权",
  secondary: "每个付款阶段都需提前支付",
  graylist: "须先结清欠费订单",
};

const CLIENT_PRIVILEGES: Record<ClientLevel, string> = {
  strategic: "可签背靠背合同（费率 +30%）",
  premium: "悬赏委托优先匹配",
  normal: "标准委托与悬赏发布权限",
  secondary: "无延期与背靠背合同权限",
  graylist: "支付欠费后转为次级客户",
};

const CLIENT_RESTRICTIONS: Record<ClientLevel, string> = {
  strategic: "须保持企业认证有效；年消费达标方可续级",
  premium: "须连续按时付款记录；逾期将降级",
  normal: "无特殊限制",
  secondary: "履行完 1 个项目阶段后可转为普通客户",
  graylist: "限制发布高额委托；需人工复核",
};

export function isInternLevel(levelId: string) {
  return levelId === INTERN_LEVEL_ID;
}

export function isApprovalDesignerLevel(levelId: string) {
  return (
    levelId === INTERN_LEVEL_ID ||
    levelId === "mid_v1" ||
    levelId === "senior_v1" ||
    levelId === "specialist"
  );
}

export function getDefaultFeeRatePercent(
  levelId: string,
  category: LevelCategory,
): number {
  if (category === "design_subject" && levelId in DESIGNER_LEVEL_META) {
    return Math.round(
      DESIGNER_LEVEL_META[levelId as DesignerLevel].coefficient * 100,
    );
  }
  if (category === "client" && levelId in CLIENT_LEVEL_META) {
    return Math.round(
      CLIENT_LEVEL_META[levelId as ClientLevel].coefficient * 100,
    );
  }
  return 100;
}

export function parseFeeRatePercent(
  value: string | number | undefined,
  fallback = 100,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(500, Math.round(value)));
  }
  if (typeof value === "string") {
    const parsed = parseInt(value.replace(/%/g, "").trim(), 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(1, Math.min(500, parsed));
    }
  }
  return fallback;
}

function defaultDesignerLevel(id: DesignerLevel, index: number): ManagedLevel {
  return {
    id,
    name: DESIGNER_LEVEL_NAMES[id],
    condition: DESIGNER_CONDITIONS[id],
    promotionMode: isApprovalDesignerLevel(id) ? "approval" : "auto",
    order: index + 1,
    restrictions: DESIGNER_RESTRICTIONS[id],
    feeRate: getDefaultFeeRatePercent(id, "design_subject"),
    withdrawCondition: DESIGNER_WITHDRAW_DEFAULTS[id],
  };
}

function defaultClientLevel(id: ClientLevel, index: number): ManagedLevel {
  return {
    id,
    name: CLIENT_LEVEL_NAMES[id],
    condition: CLIENT_CONDITIONS[id],
    promotionMode: "auto",
    order: index + 1,
    restrictions: CLIENT_RESTRICTIONS[id],
    feeRate: getDefaultFeeRatePercent(id, "client"),
    paymentCondition: CLIENT_PAYMENT_DEFAULTS[id],
    privileges: CLIENT_PRIVILEGES[id],
  };
}

function defaultDesignerLevels(): ManagedLevel[] {
  const ids = Object.keys(DESIGNER_LEVEL_META) as DesignerLevel[];
  return ids.map((id, index) => defaultDesignerLevel(id, index));
}

function defaultClientLevels(): ManagedLevel[] {
  const ids = Object.keys(CLIENT_LEVEL_META) as ClientLevel[];
  return ids.map((id, index) => defaultClientLevel(id, index));
}

export function createEmptyManagedLevel(
  category: LevelCategory,
  order: number,
): ManagedLevel {
  const base = {
    id: `level_${Date.now()}`,
    name: `新等级 ${order}`,
    condition: "",
    promotionMode: "approval" as PromotionMode,
    order,
    restrictions: "",
    feeRate: 100,
  };
  if (category === "design_subject") {
    return {
      ...base,
      withdrawCondition: "",
    };
  }
  return {
    ...base,
    paymentCondition: "",
    privileges: "",
  };
}

export function cloneDefaultLevelManagement(): LevelManagementConfig {
  return {
    design_subject: defaultDesignerLevels(),
    client: defaultClientLevels(),
  };
}

type LegacyManagedLevel = Partial<ManagedLevel> & {
  feeRate?: string | number;
};

function mergeLegacyLevelConfig(
  input?: Partial<LevelManagementConfig> | Record<string, LegacyManagedLevel[] | undefined> | null,
): Partial<LevelManagementConfig> {
  if (!input) return {};
  const raw = input as Record<string, LegacyManagedLevel[] | undefined>;

  if (raw.design_subject?.length || raw.client?.length) {
    return {
      design_subject: raw.design_subject as ManagedLevel[] | undefined,
      client: raw.client as ManagedLevel[] | undefined,
    };
  }

  let design_subject: LegacyManagedLevel[] | undefined;
  for (const key of LEGACY_DESIGNER_CATEGORY_KEYS) {
    if (raw[key]?.length) {
      design_subject = raw[key];
      break;
    }
  }

  let client: LegacyManagedLevel[] | undefined;
  for (const key of LEGACY_CLIENT_CATEGORY_KEYS) {
    if (raw[key]?.length) {
      client = raw[key];
      break;
    }
  }

  return {
    design_subject: design_subject as ManagedLevel[] | undefined,
    client: client as ManagedLevel[] | undefined,
  };
}

function normalizeManagedLevel(
  level: LegacyManagedLevel,
  category: LevelCategory,
  index: number,
): ManagedLevel {
  const defaults = cloneDefaultLevelManagement()[category];
  const fallbackById = defaults.find((item) => item.id === level.id);
  const fallback =
    fallbackById ?? defaults[index] ?? createEmptyManagedLevel(category, index + 1);
  const levelId = level.id?.trim() || fallback.id;
  const defaultFee = getDefaultFeeRatePercent(levelId, category);

  const promotionMode: PromotionMode = isInternLevel(levelId)
    ? "approval"
    : level.promotionMode === "approval"
      ? "approval"
      : level.promotionMode === "auto"
        ? "auto"
        : fallback.promotionMode;

  const base: ManagedLevel = {
    id: levelId,
    name: level.name?.trim() || fallback.name,
    condition: level.condition?.trim() ?? fallback.condition,
    promotionMode,
    order: level.order ?? index + 1,
    restrictions: level.restrictions?.trim() ?? fallback.restrictions,
    feeRate: parseFeeRatePercent(level.feeRate, defaultFee),
  };

  if (category === "design_subject") {
    return {
      ...base,
      withdrawCondition:
        level.withdrawCondition?.trim() ??
        fallback.withdrawCondition ??
        "",
    };
  }

  return {
    ...base,
    paymentCondition:
      level.paymentCondition?.trim() ?? fallback.paymentCondition ?? "",
    privileges: level.privileges?.trim() ?? fallback.privileges ?? "",
  };
}

export function normalizeLevelManagement(
  input?: Partial<LevelManagementConfig> | Record<string, LegacyManagedLevel[] | undefined> | null,
): LevelManagementConfig {
  const defaults = cloneDefaultLevelManagement();
  const merged = mergeLegacyLevelConfig(input);
  const result = { ...defaults };

  for (const category of LEVEL_CATEGORIES) {
    const levels = merged[category.key];
    if (levels?.length) {
      result[category.key] = levels
        .map((level, index) => normalizeManagedLevel(level, category.key, index))
        .sort((a, b) => a.order - b.order);
    }
  }

  return result;
}

export const DEFAULT_DESIGNER_LEVEL: DesignerLevel = "intern";
export const DEFAULT_CLIENT_LEVEL: ClientLevel = "normal";

export const PROMOTION_MODE_LABELS: Record<PromotionMode, string> = {
  auto: "自动晋级",
  approval: "需审批",
};
