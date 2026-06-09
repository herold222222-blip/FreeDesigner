/**
 * v1.1 景观施工图费用计算器
 *
 * 公式（按面积）：
 *   出图费 = 设计费基数 × 项目区域系数 × 项目类型系数 × 设计师等级系数
 *           × 设计师区域系数 × 客户等级系数 × 三级专业难度系数 × 园建协调附加系数 × 建造系数
 *   审图费 = 出图费 × 8%
 *   项目管理费 = 出图费 × 20%
 *   平台管理费 = 出图费 × 10% + 商务费（商务费 = 出图费 × 3% / 97%）
 *   总设计费 = (出图费 + 审图费 + 项目管理费 + 平台管理费) × 税率系数
 *
 * 公式（按时间）：
 *   基础服务费 = 设计费基数 × 项目区域系数 × 项目类型系数 × 设计师等级系数
 *               × 设计师区域系数 × 服务范围系数 × 三级专业难度系数 × 客户等级系数
 *   平台管理费 = 基础服务费 × 10% + 商务费（商务费 = 服务费 × 3% / 97%）
 *   总服务费 = (基础服务费 + 平台管理费) × 税率系数
 */

import { LANDSCAPE_PRICING_TIERS, LANDSCAPE_SCHEME_PRICING_TIERS } from "./constants";
import { getSchemeDifficultyCoefficient } from "./landscape-scheme-difficulty";
import { DEFAULT_PLATFORM_PRICING_CONFIG, type PlatformPricingConfig } from "./platform-pricing";
import type { LandscapeSchemeDifficultyKey } from "./constants";
import type {
  ClientLevel,
  DesignerLevel,
  RegionTier,
} from "./types";

export interface AreaBasedFeeInput {
  /** 景观面积（㎡） */
  area: number;
  /** 项目类型（用于查项目类型系数） */
  projectType: string;
  /** 设计师等级 */
  designerLevel: DesignerLevel;
  /** 设计师所在地梯队 */
  designerRegion: RegionTier;
  /** 客户等级 */
  clientLevel: ClientLevel;
  /** 选择了哪些三级专业（选项 key 与 LandscapeBasePricing 字段一致） */
  selectedTracks: ("hardscape" | "softscape" | "drainage" | "electrical")[];
  /** 三级专业难度系数：园建/绿化为高1.2~极低0.6；给排水为人工取水1或自动喷灌1.3；电气固定1 */
  difficulty: Record<string, number>;
  /** 是否新建（new）或改扩建（renovation） */
  buildType: "new" | "renovation";
  /** 税率系数 */
  taxCoefficient: number;
}

export interface AreaBasedFeeBreakdown {
  /** 各专业出图费 */
  byTrack: Record<string, number>;
  /** 出图费总额 */
  drawingFee: number;
  /** 审图费 */
  auditFee: number;
  /** 项目管理费 */
  projectManagementFee: number;
  /** 平台管理费（含商务费） */
  platformFee: number;
  /** 商务费（包含在平台管理费中，单独展示） */
  businessFee: number;
  /** 税前合计 */
  subtotal: number;
  /** 税后总价 */
  total: number;
  /** 应用的所有系数明细 */
  coefficients: {
    region: number;
    projectType: number;
    designerLevel: number;
    designerRegion: number;
    clientLevel: number;
    coordinator: number; // 园建协调
    build: number;
    tax: number;
  };
}

function findTier(area: number, config?: PlatformPricingConfig) {
  const tiers = config?.landscapePricingTiers ?? LANDSCAPE_PRICING_TIERS;
  return tiers.find((t) => area <= t.upperBound) ?? tiers[tiers.length - 1];
}

/** 取得每个专业的设计费基数（一口价 或 单位价 × 面积） */
export function getLandscapeBaseFees(area: number, config?: PlatformPricingConfig) {
  const tier = findTier(Math.max(area, 1), config);
  const fees = {
    hardscape: tier.isUnitPrice ? tier.pricing.hardscape * area : tier.pricing.hardscape,
    softscape: tier.isUnitPrice ? tier.pricing.softscape * area : tier.pricing.softscape,
    drainage: tier.isUnitPrice ? tier.pricing.drainage * area : tier.pricing.drainage,
    electrical: tier.isUnitPrice ? tier.pricing.electrical * area : tier.pricing.electrical,
  };
  return { tier, fees };
}

export function calculateAreaBasedFee(
  input: AreaBasedFeeInput,
  config: PlatformPricingConfig = DEFAULT_PLATFORM_PRICING_CONFIG,
): AreaBasedFeeBreakdown {
  const projectTypeCoeff = config.landscapeProjectTypeCoefficient[input.projectType] ?? 1.0;
  const designerLevelCoeff = config.designerLevelCoefficient[input.designerLevel];
  const designerRegionCoeff = config.regionTierCoefficient[input.designerRegion];
  const clientLevelCoeff = config.clientLevelCoefficient[input.clientLevel];
  const buildCoeff = input.buildType === "renovation" ? config.renovationCoefficient : 1.0;
  const includesGarden = input.selectedTracks.includes("hardscape");
  const hasOtherTrack = input.selectedTracks.some((t) => t !== "hardscape");
  const coordinatorCoeff =
    includesGarden && hasOtherTrack ? config.gardenCoordinationCoefficient : 1.0;

  const { fees: baseFees } = getLandscapeBaseFees(input.area, config);

  const baseMultiplier =
    1.0 * // 项目区域系数（按面积报价固定 100%）
    projectTypeCoeff *
    designerLevelCoeff *
    designerRegionCoeff *
    clientLevelCoeff *
    coordinatorCoeff *
    buildCoeff;

  const byTrack: Record<string, number> = {};
  for (const track of input.selectedTracks) {
    const trackBase = baseFees[track];
    const difficulty = input.difficulty[track] ?? 1.0;
    byTrack[track] = Math.round(trackBase * baseMultiplier * difficulty);
  }

  const drawingFee = Object.values(byTrack).reduce((s, n) => s + n, 0);
  const auditFee = Math.round(drawingFee * config.auditServiceRate);
  const projectManagementFee = Math.round(drawingFee * config.projectManagementRate);
  const businessFee = Math.round(drawingFee * config.businessFeeRate);
  const platformFee = Math.round(drawingFee * config.platformManagementRate) + businessFee;

  const subtotal = drawingFee + auditFee + projectManagementFee + platformFee;
  const total = Math.round(subtotal * input.taxCoefficient);

  return {
    byTrack,
    drawingFee,
    auditFee,
    projectManagementFee,
    platformFee,
    businessFee,
    subtotal,
    total,
    coefficients: {
      region: 1.0,
      projectType: projectTypeCoeff,
      designerLevel: designerLevelCoeff,
      designerRegion: designerRegionCoeff,
      clientLevel: clientLevelCoeff,
      coordinator: coordinatorCoeff,
      build: buildCoeff,
      tax: input.taxCoefficient,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 按时间计费                                                            */
/* ------------------------------------------------------------------ */

export interface TimeBasedFeeInput {
  /** 计费单位：天 / 月 */
  unit: "day" | "month";
  /** 数量（天数或月数） */
  quantity: number;
  /** 服务模式 */
  mode: "remote" | "onsite";
  /** 选择的专业 */
  track: "hardscape" | "softscape" | "drainage" | "electrical" | "structure";
  /** 设计师等级 */
  designerLevel: DesignerLevel;
  /** 设计师所在地梯队 */
  designerRegion: RegionTier;
  /** 客户等级 */
  clientLevel: ClientLevel;
  /** 是否含绘图（onsite 时影响服务范围系数） */
  withDrawing: boolean;
  /** 三级专业难度系数 */
  difficulty: number;
  /** 税率系数 */
  taxCoefficient: number;
}

export interface TimeBasedFeeBreakdown {
  basicFee: number;
  platformFee: number;
  businessFee: number;
  subtotal: number;
  total: number;
  perUnit: number;
}

/* ------------------------------------------------------------------ */
/* 景观方案设计费（按面积 · 7.2.2）                                      */
/* ------------------------------------------------------------------ */

export interface SchemeAreaBasedFeeInput {
  area: number;
  projectType: string;
  designerLevel: DesignerLevel;
  designerRegion: RegionTier;
  clientLevel: ClientLevel;
  schemeDifficulty: LandscapeSchemeDifficultyKey;
  buildType: "new" | "renovation";
  taxCoefficient: number;
}

export interface SchemeAreaBasedFeeBreakdown {
  baseFee: number;
  drawingFee: number;
  platformFee: number;
  businessFee: number;
  subtotal: number;
  total: number;
  tierLabel: string;
  coefficients: {
    region: number;
    projectType: number;
    designerLevel: number;
    designerRegion: number;
    clientLevel: number;
    schemeDifficulty: number;
    build: number;
    tax: number;
  };
}

function findSchemeTier(area: number, config?: PlatformPricingConfig) {
  const tiers = config?.landscapeSchemePricingTiers ?? LANDSCAPE_SCHEME_PRICING_TIERS;
  return tiers.find((t) => area <= t.upperBound) ?? tiers[tiers.length - 1]!;
}

export function getLandscapeSchemeBaseFee(area: number, config?: PlatformPricingConfig) {
  const tier = findSchemeTier(Math.max(area, 1), config);
  const baseFee = tier.isUnitPrice ? tier.amount * area : tier.amount;
  return { tier, baseFee };
}

export function calculateSchemeAreaBasedFee(
  input: SchemeAreaBasedFeeInput,
  config: PlatformPricingConfig = DEFAULT_PLATFORM_PRICING_CONFIG,
): SchemeAreaBasedFeeBreakdown {
  const { tier, baseFee } = getLandscapeSchemeBaseFee(input.area, config);
  const projectTypeCoeff = config.landscapeProjectTypeCoefficient[input.projectType] ?? 1.0;
  const designerLevelCoeff = config.designerLevelCoefficient[input.designerLevel];
  const designerRegionCoeff = config.regionTierCoefficient[input.designerRegion];
  const clientLevelCoeff = config.clientLevelCoefficient[input.clientLevel];
  const schemeDifficultyCoeff = getSchemeDifficultyCoefficient(input.schemeDifficulty, config);
  const buildCoeff = input.buildType === "renovation" ? config.renovationCoefficient : 1.0;

  const multiplier =
    1.0 *
    projectTypeCoeff *
    designerLevelCoeff *
    designerRegionCoeff *
    clientLevelCoeff *
    schemeDifficultyCoeff *
    buildCoeff;

  const drawingFee = Math.round(baseFee * multiplier);
  const businessFee = Math.round(drawingFee * config.businessFeeRate);
  const platformFee = Math.round(drawingFee * config.platformManagementRate) + businessFee;
  const subtotal = drawingFee + platformFee;
  const total = Math.round(subtotal * input.taxCoefficient);

  return {
    baseFee,
    drawingFee,
    platformFee,
    businessFee,
    subtotal,
    total,
    tierLabel: tier.label,
    coefficients: {
      region: 1.0,
      projectType: projectTypeCoeff,
      designerLevel: designerLevelCoeff,
      designerRegion: designerRegionCoeff,
      clientLevel: clientLevelCoeff,
      schemeDifficulty: schemeDifficultyCoeff,
      build: buildCoeff,
      tax: input.taxCoefficient,
    },
  };
}

export function calculateTimeBasedFee(
  input: TimeBasedFeeInput,
  config: PlatformPricingConfig = DEFAULT_PLATFORM_PRICING_CONFIG,
): TimeBasedFeeBreakdown {
  const rateTable =
    input.unit === "day" ? config.landscapeDailyRate : config.landscapeMonthlyRate;
  const perUnitBase = rateTable[input.mode][input.track];
  const designerLevelCoeff = config.designerLevelCoefficient[input.designerLevel];
  const designerRegionCoeff = config.regionTierCoefficient[input.designerRegion];
  const clientLevelCoeff = config.clientLevelCoefficient[input.clientLevel];
  // 服务范围系数：远程 100% / 驻场不含图 100% / 驻场含图 110%
  const serviceRangeCoeff =
    input.mode === "remote"
      ? 1.0
      : input.withDrawing
        ? config.onsiteWithDrawingCoefficient
        : 1.0;

  const basicFee = Math.round(
    perUnitBase *
      input.quantity *
      1.0 * // 项目区域系数固定 100%
      1.0 * // 项目类型系数固定 100%
      designerLevelCoeff *
      designerRegionCoeff *
      serviceRangeCoeff *
      input.difficulty *
      clientLevelCoeff,
  );
  const businessFee = Math.round(basicFee * config.businessFeeRate);
  const platformFee = Math.round(basicFee * config.platformManagementRate) + businessFee;
  const subtotal = basicFee + platformFee;
  const total = Math.round(subtotal * input.taxCoefficient);
  return {
    basicFee,
    platformFee,
    businessFee,
    subtotal,
    total,
    perUnit: perUnitBase,
  };
}
