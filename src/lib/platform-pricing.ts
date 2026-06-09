import {
  AUDIT_SERVICE_RATE,
  BUSINESS_FEE_RATE,
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  GARDEN_COORDINATION_COEFFICIENT,
  LANDSCAPE_DAILY_RATE,
  LANDSCAPE_MONTHLY_RATE,
  LANDSCAPE_PRICING_TIERS,
  LANDSCAPE_PROJECT_TYPE_COEFFICIENT,
  LANDSCAPE_SCHEME_DIFFICULTY,
  LANDSCAPE_SCHEME_PRICING_TIERS,
  type LandscapeSchemeDifficultyKey,
  PLATFORM_MANAGEMENT_RATE,
  PROJECT_MANAGEMENT_RATE,
  REGION_TIER_META,
  TAX_OPTIONS,
} from "@/lib/constants";
import {
  LANDSCAPE_DRAINAGE_DIFFICULTY,
  LANDSCAPE_HARDSCAPE_DIFFICULTY,
  LANDSCAPE_HARDSCAPE_SCOPE_NOTE,
  LANDSCAPE_SOFTSCAPE_DIFFICULTY,
  type LandscapeAreaDifficultyOption,
} from "@/lib/landscape-area-difficulty";
import type { ClientLevel, DesignerLevel, RegionTier } from "@/lib/types";
import {
  DEFAULT_CALCULATOR_QUOTE_REMARKS,
  normalizeCalculatorQuoteRemarks,
  type CalculatorQuoteRemarksConfig,
} from "@/lib/calculator-quote-remarks";

export type { LandscapeAreaDifficultyOption };

export interface LandscapeSchemeDifficultyOption {
  key: LandscapeSchemeDifficultyKey;
  label: string;
  coefficient: number;
  minCostPerSqm?: number;
  maxCostPerSqm?: number;
  remark: string;
}

export interface LandscapeTrackDifficultyConfig {
  hardscapeScopeNote: string;
  hardscape: LandscapeAreaDifficultyOption[];
  softscape: LandscapeAreaDifficultyOption[];
  drainage: LandscapeAreaDifficultyOption[];
  electrical: { coefficient: number; note: string };
}

export interface PlatformPricingConfig {
  auditServiceRate: number;
  projectManagementRate: number;
  platformManagementRate: number;
  businessFeeRate: number;
  gardenCoordinationCoefficient: number;
  renovationCoefficient: number;
  onsiteWithDrawingCoefficient: number;
  designerLevelCoefficient: Record<DesignerLevel, number>;
  clientLevelCoefficient: Record<ClientLevel, number>;
  regionTierCoefficient: Record<RegionTier, number>;
  landscapeProjectTypeCoefficient: Record<string, number>;
  landscapePricingTiers: {
    upperBound: number;
    isUnitPrice: boolean;
    pricing: { hardscape: number; softscape: number; drainage: number; electrical: number };
    label: string;
  }[];
  /** 景观方案设计费面积阶梯（7.2.2 §4） */
  landscapeSchemePricingTiers: {
    upperBound: number;
    isUnitPrice: boolean;
    amount: number;
    label: string;
  }[];
  /** 方案难度系数（按单方造价 元/㎡） */
  landscapeSchemeDifficulty: LandscapeSchemeDifficultyOption[];
  landscapeDailyRate: typeof LANDSCAPE_DAILY_RATE;
  landscapeMonthlyRate: typeof LANDSCAPE_MONTHLY_RATE;
  taxOptions: { value: string; label: string; coefficient: number }[];
  /** 三级专业难度系数与说明（文档 3.1.1.2.6） */
  landscapeDifficulty: LandscapeTrackDifficultyConfig;
  /** 费用计算器 · 合计页备注（按计费范围三套文案） */
  calculatorQuoteRemarks: CalculatorQuoteRemarksConfig;
}

export const DEFAULT_PLATFORM_PRICING_CONFIG: PlatformPricingConfig = {
  auditServiceRate: AUDIT_SERVICE_RATE,
  projectManagementRate: PROJECT_MANAGEMENT_RATE,
  platformManagementRate: PLATFORM_MANAGEMENT_RATE,
  businessFeeRate: BUSINESS_FEE_RATE,
  gardenCoordinationCoefficient: GARDEN_COORDINATION_COEFFICIENT,
  renovationCoefficient: 1.1,
  onsiteWithDrawingCoefficient: 1.1,
  designerLevelCoefficient: {
    intern: DESIGNER_LEVEL_META.intern.coefficient,
    mid_v1: DESIGNER_LEVEL_META.mid_v1.coefficient,
    senior_v1: DESIGNER_LEVEL_META.senior_v1.coefficient,
    specialist: DESIGNER_LEVEL_META.specialist.coefficient,
  },
  clientLevelCoefficient: {
    strategic: CLIENT_LEVEL_META.strategic.coefficient,
    premium: CLIENT_LEVEL_META.premium.coefficient,
    normal: CLIENT_LEVEL_META.normal.coefficient,
    secondary: CLIENT_LEVEL_META.secondary.coefficient,
    graylist: CLIENT_LEVEL_META.graylist.coefficient,
  },
  regionTierCoefficient: {
    tier1: REGION_TIER_META.tier1.coefficient,
    tier2: REGION_TIER_META.tier2.coefficient,
    tier3: REGION_TIER_META.tier3.coefficient,
    tier4: REGION_TIER_META.tier4.coefficient,
    tier5: REGION_TIER_META.tier5.coefficient,
    tier6: REGION_TIER_META.tier6.coefficient,
  },
  landscapeProjectTypeCoefficient: LANDSCAPE_PROJECT_TYPE_COEFFICIENT,
  landscapePricingTiers: LANDSCAPE_PRICING_TIERS,
  landscapeSchemePricingTiers: LANDSCAPE_SCHEME_PRICING_TIERS,
  landscapeSchemeDifficulty: LANDSCAPE_SCHEME_DIFFICULTY.map((o) => ({ ...o })),
  landscapeDailyRate: LANDSCAPE_DAILY_RATE,
  landscapeMonthlyRate: LANDSCAPE_MONTHLY_RATE,
  taxOptions: TAX_OPTIONS,
  landscapeDifficulty: {
    hardscapeScopeNote: LANDSCAPE_HARDSCAPE_SCOPE_NOTE,
    hardscape: LANDSCAPE_HARDSCAPE_DIFFICULTY,
    softscape: LANDSCAPE_SOFTSCAPE_DIFFICULTY,
    drainage: LANDSCAPE_DRAINAGE_DIFFICULTY,
    electrical: {
      coefficient: 1,
      note: "电气专业难度系数固定为 100%。",
    },
  },
  calculatorQuoteRemarks: DEFAULT_CALCULATOR_QUOTE_REMARKS,
};

export function cloneDefaultPricingConfig(): PlatformPricingConfig {
  return JSON.parse(JSON.stringify(DEFAULT_PLATFORM_PRICING_CONFIG)) as PlatformPricingConfig;
}

/** 合并旧版持久化配置，补齐新增字段（如难度系数） */
export function normalizePricingConfig(
  input: Partial<PlatformPricingConfig> | PlatformPricingConfig,
): PlatformPricingConfig {
  const base = cloneDefaultPricingConfig();
  const diff = input.landscapeDifficulty;
  return {
    ...base,
    ...input,
    designerLevelCoefficient: {
      ...base.designerLevelCoefficient,
      ...input.designerLevelCoefficient,
    },
    clientLevelCoefficient: {
      ...base.clientLevelCoefficient,
      ...input.clientLevelCoefficient,
    },
    regionTierCoefficient: {
      ...base.regionTierCoefficient,
      ...input.regionTierCoefficient,
    },
    landscapeProjectTypeCoefficient: {
      ...base.landscapeProjectTypeCoefficient,
      ...input.landscapeProjectTypeCoefficient,
    },
    landscapePricingTiers: input.landscapePricingTiers ?? base.landscapePricingTiers,
    landscapeSchemePricingTiers:
      input.landscapeSchemePricingTiers ?? base.landscapeSchemePricingTiers,
    landscapeSchemeDifficulty: input.landscapeSchemeDifficulty?.length
      ? input.landscapeSchemeDifficulty.map((o) => ({ ...o }))
      : base.landscapeSchemeDifficulty,
    landscapeDailyRate: input.landscapeDailyRate ?? base.landscapeDailyRate,
    landscapeMonthlyRate: input.landscapeMonthlyRate ?? base.landscapeMonthlyRate,
    taxOptions: input.taxOptions ?? base.taxOptions,
    landscapeDifficulty: {
      hardscapeScopeNote:
        diff?.hardscapeScopeNote ?? base.landscapeDifficulty.hardscapeScopeNote,
      hardscape: diff?.hardscape?.length
        ? diff.hardscape
        : base.landscapeDifficulty.hardscape,
      softscape: diff?.softscape?.length
        ? diff.softscape
        : base.landscapeDifficulty.softscape,
      drainage: diff?.drainage?.length
        ? diff.drainage
        : base.landscapeDifficulty.drainage,
      electrical: {
        ...base.landscapeDifficulty.electrical,
        ...diff?.electrical,
      },
    },
    calculatorQuoteRemarks: normalizeCalculatorQuoteRemarks(
      input.calculatorQuoteRemarks ?? base.calculatorQuoteRemarks,
    ),
  };
}
