import {
  DESIGNER_LEVEL_META,
  LANDSCAPE_DAILY_RATE,
  LANDSCAPE_MONTHLY_RATE,
  LANDSCAPE_PRELIMINARY_RATE,
  type LandscapeBasePricing,
  REGION_TIER_META,
  resolveDesignerRegionTier,
  SPECIALTIES,
  SPECIALTY_TRACKS,
} from "@/lib/constants";
import {
  getLandscapeBaseFees,
  getLandscapeSchemeBaseFee,
} from "@/lib/fee-calculator";
import {
  LANDSCAPE_TIME_TRACK_LABELS,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import { resolveDesignerTrackPairs } from "@/lib/designer-track-resolve";
import type { Designer, DesignerLevel, RegionTier, Specialty } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export const PRICING_BASE_EXAMPLE_AREA = 20000;
export const PRICING_BASE_EXAMPLE_PROJECT_TYPE = "高层住宅";

const L3_TO_LANDSCAPE_TRACK: Record<string, LandscapeTimeRateTrack> = {
  ls_garden: "hardscape",
  ls_garden_struct: "hardscape",
  ls_greening: "softscape",
  ls_drainage: "drainage",
  ls_drainage_irrigation: "drainage",
  ls_electrical: "electrical",
  ls_struct: "structure",
};

export type PricingBasePhase = "施工图" | "扩初" | "方案" | "按时间";

export type PricingLineRateKind = "area_unit" | "time_bundle";

export interface DesignerPricingBaseLine {
  id: string;
  phase: PricingBasePhase;
  /** 三级专业 / 档位名称 */
  trackLabel: string;
  amountLabel: string;
  subLabel?: string;
  hint?: string;
  /** 平台基数类型（已叠加等级 × 地区 × 项目类型） */
  rateKind: PricingLineRateKind;
  /** 面积类：元/㎡；时间类：线上工日基准 */
  baseValue: number;
  /** 按时间计费时的分项基数 */
  timeBundle?: {
    remoteDaily: number;
    remoteMonthly: number;
    onsiteDaily: number;
    onsiteMonthly: number;
  };
  /** 应用自定义系数后的按时间费率 */
  appliedTimeRates?: {
    remoteDaily: number;
    remoteMonthly: number;
    onsiteDaily: number;
    onsiteMonthly: number;
  };
  /** 按时间分项自定义系数 */
  timeCustomPercents?: Partial<
    Record<"remoteDaily" | "remoteMonthly" | "onsiteDaily" | "onsiteMonthly", number>
  >;
  /** 设计师自定义系数（100 = 平台基数，面积类使用） */
  customPercent?: number;
}

export interface DesignerPricingBaseSnapshot {
  /** 仅景观专业已接入平台取费规则 */
  available: boolean;
  subjectLabel: string;
  specialtyLabel: string;
  exampleTitle: string;
  multiplierNote: string;
  lines: DesignerPricingBaseLine[];
}

/** 是否已开放实时取费基数（当前仅景观） */
export function isDesignerPricingBaseAvailable(designer: Designer) {
  return designer.specialty === "landscape";
}

/** 设计单价展示（元/㎡） */
export function formatPricePerSqm(yuanPerSqm: number) {
  const digits = yuanPerSqm < 10 ? 2 : yuanPerSqm < 100 ? 1 : 0;
  const amount = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(yuanPerSqm);
  return `${amount}/㎡`;
}

function landscapeUnitPricePerSqm(
  tier: { isUnitPrice: boolean; pricing: LandscapeBasePricing },
  trackKey: keyof LandscapeBasePricing,
  area: number,
  sharedMult: number,
) {
  const base = tier.pricing[trackKey] ?? 0;
  const unit = tier.isUnitPrice ? base : base / Math.max(area, 1);
  return unit * sharedMult;
}

function schemeUnitPricePerSqm(
  tier: { isUnitPrice: boolean; amount: number },
  area: number,
  sharedMult: number,
) {
  const unit = tier.isUnitPrice ? tier.amount : tier.amount / Math.max(area, 1);
  return unit * sharedMult;
}

const SUBJECT_LABEL = {
  individual: "设计师",
  team: "设计团队",
  company: "设计公司",
} as const;

function findL3Label(specialty: Specialty, l2: string, l3: string) {
  const l1 = SPECIALTY_TRACKS.find((t) => t.value === specialty);
  return l1?.l2.find((x) => x.value === l2)?.l3.find((x) => x.value === l3)?.label ?? l3;
}

function getRelevantTracks(designer: Designer) {
  return resolveDesignerTrackPairs(designer);
}

/** platform_initial：平台阶梯原始基数；designer_composite：叠加等级×地区×项目类型 */
export type PricingBaseMultiplierMode = "platform_initial" | "designer_composite";

function timeRatesForTrack(
  track: LandscapeTimeRateTrack,
  mult: number,
): { remote: { daily: number; monthly: number }; onsite: { daily: number; monthly: number } } {
  return {
    remote: {
      daily: Math.round(LANDSCAPE_DAILY_RATE.remote[track] * mult),
      monthly: Math.round(LANDSCAPE_MONTHLY_RATE.remote[track] * mult),
    },
    onsite: {
      daily: Math.round(LANDSCAPE_DAILY_RATE.onsite[track] * mult),
      monthly: Math.round(LANDSCAPE_MONTHLY_RATE.onsite[track] * mult),
    },
  };
}

export function getDesignerPricingMultipliers(
  designer: Designer,
  config: PlatformPricingConfig,
) {
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const region: RegionTier = resolveDesignerRegionTier(designer);
  const projectTypeCoeff =
    config.landscapeProjectTypeCoefficient[PRICING_BASE_EXAMPLE_PROJECT_TYPE] ?? 1;
  const levelCoeff = config.designerLevelCoefficient[level] ?? 1;
  const regionCoeff = config.regionTierCoefficient[region] ?? 1;
  return {
    level,
    region,
    levelCoeff,
    regionCoeff,
    projectTypeCoeff,
    sharedMult: levelCoeff * regionCoeff * projectTypeCoeff,
    levelLabel: DESIGNER_LEVEL_META[level].label,
    regionLabel: REGION_TIER_META[region].label,
  };
}

export function getDesignerPricingBaseSnapshot(
  designer: Designer,
  config: PlatformPricingConfig,
  options?: { mode?: PricingBaseMultiplierMode },
): DesignerPricingBaseSnapshot {
  const mode = options?.mode ?? "designer_composite";
  const specialtyMeta = SPECIALTIES.find((s) => s.value === designer.specialty)!;
  const subjectLabel =
    SUBJECT_LABEL[designer.subjectType ?? "individual"] ?? "设计师";
  const factors = getDesignerPricingMultipliers(designer, config);
  const sharedMult = mode === "platform_initial" ? 1 : factors.sharedMult;

  const available = isDesignerPricingBaseAvailable(designer);
  const lines: DesignerPricingBaseLine[] = [];
  const tracks = getRelevantTracks(designer);

  if (available) {
    const { tier: cdTier } = getLandscapeBaseFees(PRICING_BASE_EXAMPLE_AREA, config);
    const schemeTierInfo = getLandscapeSchemeBaseFee(PRICING_BASE_EXAMPLE_AREA, config);
    const timeTracksAdded = new Set<LandscapeTimeRateTrack>();
    const areaHint =
      mode === "platform_initial"
        ? `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ ${PRICING_BASE_EXAMPLE_PROJECT_TYPE} 阶梯「${cdTier.label}」为例，平台初始基数（未叠加个人系数）`
        : `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ ${PRICING_BASE_EXAMPLE_PROJECT_TYPE} 阶梯「${cdTier.label}」为例，已叠加等级×地区×项目类型`;

    for (const t of tracks) {
      const l3Label = findL3Label(designer.specialty, t.l2, t.l3);

      if (t.l2 === "construction_doc" || t.l2 === "preliminary") {
        const trackKey = L3_TO_LANDSCAPE_TRACK[t.l3];
        const isPreliminary = t.l2 === "preliminary";
        if (trackKey) {
          if (trackKey in cdTier.pricing) {
            const unitPrice =
              landscapeUnitPricePerSqm(
                cdTier,
                trackKey as keyof typeof cdTier.pricing,
                PRICING_BASE_EXAMPLE_AREA,
                sharedMult,
              ) * (isPreliminary ? LANDSCAPE_PRELIMINARY_RATE : 1);
            lines.push({
              id: `${isPreliminary ? "pre" : "cd"}-${t.l3}`,
              phase: isPreliminary ? "扩初" : "施工图",
              trackLabel: l3Label,
              amountLabel: formatPricePerSqm(unitPrice),
              subLabel: isPreliminary
                ? `设计单价 · ${LANDSCAPE_TIME_TRACK_LABELS[trackKey]}（扩初按施工图 ${Math.round(LANDSCAPE_PRELIMINARY_RATE * 100)}%）`
                : `设计单价 · ${LANDSCAPE_TIME_TRACK_LABELS[trackKey]}`,
              hint: areaHint,
              rateKind: "area_unit",
              baseValue: unitPrice,
            });
          }
          if (!timeTracksAdded.has(trackKey)) {
            timeTracksAdded.add(trackKey);
            const tr = timeRatesForTrack(trackKey, sharedMult);
            lines.push({
              id: `time-${trackKey}`,
              phase: "按时间",
              trackLabel: `${l3Label}（${LANDSCAPE_TIME_TRACK_LABELS[trackKey]}）`,
              amountLabel: `${formatCurrency(tr.remote.daily)}/工日`,
              subLabel: `线上 ${formatCurrency(tr.remote.monthly)}/月 · 驻场 ${formatCurrency(tr.onsite.daily)}/工日`,
              hint:
                trackKey === "structure"
                  ? mode === "platform_initial"
                    ? "结构专业仅按时间计费 · 平台初始基数"
                    : "结构专业仅按时间计费 · 已叠加等级×地区×项目类型"
                  : mode === "platform_initial"
                    ? "v1.1 文档基准 · 平台初始基数"
                    : "v1.1 文档基准 × 等级 × 地区 × 项目类型",
              rateKind: "time_bundle",
              baseValue: tr.remote.daily,
              timeBundle: {
                remoteDaily: tr.remote.daily,
                remoteMonthly: tr.remote.monthly,
                onsiteDaily: tr.onsite.daily,
                onsiteMonthly: tr.onsite.monthly,
              },
            });
          }
        }
      }

      if (t.l2 === "scheme") {
        const schemeUnit = schemeUnitPricePerSqm(
          schemeTierInfo.tier,
          PRICING_BASE_EXAMPLE_AREA,
          sharedMult,
        );
        lines.push({
          id: `scheme-${t.l3}`,
          phase: "方案",
          trackLabel: l3Label,
          amountLabel: formatPricePerSqm(schemeUnit),
          subLabel: "设计单价（方案按面积）",
          hint:
            mode === "platform_initial"
              ? `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ 阶梯「${schemeTierInfo.tier.label}」为例，平台初始基数（未叠加个人系数）`
              : `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ 阶梯「${schemeTierInfo.tier.label}」为例，已叠加等级×地区×项目类型`,
          rateKind: "area_unit",
          baseValue: schemeUnit,
        });
      }
    }

    lines.sort((a, b) => {
      const order: Record<PricingBasePhase, number> = {
        施工图: 0,
        扩初: 1,
        方案: 2,
        按时间: 3,
      };
      return order[a.phase] - order[b.phase];
    });
  }

  const multiplierNote = !available
    ? "当前专业取费规则尚未接入"
    : mode === "platform_initial"
      ? "平台阶梯初始基数（未叠加等级 / 地区 / 项目类型）"
      : `综合基数：${factors.levelLabel} × ${factors.regionLabel} × ${PRICING_BASE_EXAMPLE_PROJECT_TYPE}（约 ${Math.round(factors.sharedMult * 100)}%）`;

  return {
    available,
    subjectLabel,
    specialtyLabel: specialtyMeta.label,
    exampleTitle: `${(PRICING_BASE_EXAMPLE_AREA / 10000).toFixed(0)}万㎡ ${PRICING_BASE_EXAMPLE_PROJECT_TYPE}项目`,
    multiplierNote,
    lines,
  };
}

/** 同时返回平台初始基数与当前设计师综合基数 */
export function getDesignerPlatformPricingBases(
  designer: Designer,
  config: PlatformPricingConfig,
) {
  return {
    platformInitial: getDesignerPricingBaseSnapshot(designer, config, {
      mode: "platform_initial",
    }),
    designerComposite: getDesignerPricingBaseSnapshot(designer, config, {
      mode: "designer_composite",
    }),
    factors: getDesignerPricingMultipliers(designer, config),
  };
}

export type DesignerPricingFactors = ReturnType<typeof getDesignerPricingMultipliers>;

function formatCoeffPercent(value: number) {
  const pct = value * 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  const fixed = pct.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}%`;
}

function formatPlainAmount(value: number, kind: "area_unit" | "currency") {
  if (kind === "area_unit") {
    const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
    return `¥${value.toFixed(digits)}`;
  }
  return formatCurrency(value);
}

/** 综合基数计算式：初始 × 等级 × 地区 × 项目类型 = 结果 */
export function buildCompositeRateFormula(
  initialAmount: number,
  resultAmount: number,
  factors: DesignerPricingFactors,
  kind: "area_unit" | "currency",
  resultSuffix = "",
) {
  const left = [
    `${formatPlainAmount(initialAmount, kind)}（初始）`,
    `${formatCoeffPercent(factors.levelCoeff)}（${factors.levelLabel}）`,
    `${formatCoeffPercent(factors.regionCoeff)}（${factors.regionLabel}）`,
    `${formatCoeffPercent(factors.projectTypeCoeff)}（${PRICING_BASE_EXAMPLE_PROJECT_TYPE}）`,
  ].join(" × ");
  return `${left} = ${formatPlainAmount(resultAmount, kind)}${resultSuffix}`;
}

export function buildCompositeLineFormulas(
  initial: DesignerPricingBaseLine,
  composite: DesignerPricingBaseLine,
  factors: DesignerPricingFactors,
): string[] {
  if (
    initial.rateKind === "time_bundle" &&
    initial.timeBundle &&
    composite.timeBundle
  ) {
    const rows: { label: string; unit: string; from: number; to: number }[] = [
      {
        label: "线上工日",
        unit: "/工日",
        from: initial.timeBundle.remoteDaily,
        to: composite.timeBundle.remoteDaily,
      },
      {
        label: "线上月费",
        unit: "/月",
        from: initial.timeBundle.remoteMonthly,
        to: composite.timeBundle.remoteMonthly,
      },
      {
        label: "驻场工日",
        unit: "/工日",
        from: initial.timeBundle.onsiteDaily,
        to: composite.timeBundle.onsiteDaily,
      },
      {
        label: "驻场月费",
        unit: "/月",
        from: initial.timeBundle.onsiteMonthly,
        to: composite.timeBundle.onsiteMonthly,
      },
    ];
    return rows.map(
      (row) =>
        `${row.label}：${buildCompositeRateFormula(row.from, row.to, factors, "currency", row.unit)}`,
    );
  }

  return [
    buildCompositeRateFormula(
      initial.baseValue,
      composite.baseValue,
      factors,
      "area_unit",
      composite.rateKind === "area_unit" ? "/㎡" : "",
    ),
  ];
}
