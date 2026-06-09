import {
  DESIGNER_LEVEL_META,
  LANDSCAPE_DAILY_RATE,
  LANDSCAPE_MONTHLY_RATE,
  type LandscapeBasePricing,
  REGION_TIER_META,
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

export type PricingBasePhase = "施工图" | "方案" | "按时间";

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
  const out: { l2: string; l3: string }[] = [];
  if (designer.primaryTrack?.l1 === designer.specialty) {
    out.push({ l2: designer.primaryTrack.l2, l3: designer.primaryTrack.l3 });
  }
  for (const t of designer.secondaryTracks ?? []) {
    if (t.l1 !== designer.specialty) continue;
    if (!out.some((x) => x.l2 === t.l2 && x.l3 === t.l3)) {
      out.push({ l2: t.l2, l3: t.l3 });
    }
  }
  return out;
}

function timeRatesForTrack(
  designer: Designer,
  track: LandscapeTimeRateTrack,
): { remote: { daily: number; monthly: number }; onsite: { daily: number; monthly: number } } {
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const region: RegionTier = designer.regionTier ?? "tier6";
  const mult =
    DESIGNER_LEVEL_META[level].coefficient * REGION_TIER_META[region].coefficient;
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

export function getDesignerPricingBaseSnapshot(
  designer: Designer,
  config: PlatformPricingConfig,
): DesignerPricingBaseSnapshot {
  const specialtyMeta = SPECIALTIES.find((s) => s.value === designer.specialty)!;
  const subjectLabel =
    SUBJECT_LABEL[designer.subjectType ?? "individual"] ?? "设计师";
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const region: RegionTier = designer.regionTier ?? "tier6";
  const projectTypeCoeff =
    config.landscapeProjectTypeCoefficient[PRICING_BASE_EXAMPLE_PROJECT_TYPE] ?? 1;
  const sharedMult =
    config.designerLevelCoefficient[level] *
    config.regionTierCoefficient[region] *
    projectTypeCoeff;

  const available = isDesignerPricingBaseAvailable(designer);
  const lines: DesignerPricingBaseLine[] = [];
  const tracks = getRelevantTracks(designer);

  if (available) {
    const { tier: cdTier } = getLandscapeBaseFees(PRICING_BASE_EXAMPLE_AREA, config);
    const schemeTierInfo = getLandscapeSchemeBaseFee(PRICING_BASE_EXAMPLE_AREA, config);
    const timeTracksAdded = new Set<LandscapeTimeRateTrack>();

    for (const t of tracks) {
      const l3Label = findL3Label(designer.specialty, t.l2, t.l3);

      if (t.l2 === "construction_doc") {
        const trackKey = L3_TO_LANDSCAPE_TRACK[t.l3];
        if (trackKey) {
          if (trackKey in cdTier.pricing) {
            const unitPrice = landscapeUnitPricePerSqm(
              cdTier,
              trackKey as keyof typeof cdTier.pricing,
              PRICING_BASE_EXAMPLE_AREA,
              sharedMult,
            );
            lines.push({
              id: `cd-${t.l3}`,
              phase: "施工图",
              trackLabel: l3Label,
              amountLabel: formatPricePerSqm(unitPrice),
              subLabel: `设计单价 · ${LANDSCAPE_TIME_TRACK_LABELS[trackKey]}`,
              hint: `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ ${PRICING_BASE_EXAMPLE_PROJECT_TYPE} 阶梯「${cdTier.label}」为例，已叠加等级×地区×项目类型`,
              rateKind: "area_unit",
              baseValue: unitPrice,
            });
          }
          if (!timeTracksAdded.has(trackKey)) {
            timeTracksAdded.add(trackKey);
            const tr = timeRatesForTrack(designer, trackKey);
            lines.push({
              id: `time-${trackKey}`,
              phase: "按时间",
              trackLabel: `${l3Label}（${LANDSCAPE_TIME_TRACK_LABELS[trackKey]}）`,
              amountLabel: `${formatCurrency(tr.remote.daily)}/工日`,
              subLabel: `线上 ${formatCurrency(tr.remote.monthly)}/月 · 驻场 ${formatCurrency(tr.onsite.daily)}/工日`,
              hint:
                trackKey === "structure"
                  ? "结构专业仅按时间计费（文档表）"
                  : "v1.1 文档基准 × 等级 × 地区",
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
          hint: `以 ${PRICING_BASE_EXAMPLE_AREA.toLocaleString()}㎡ 阶梯「${schemeTierInfo.tier.label}」为例，已叠加等级×地区×项目类型`,
          rateKind: "area_unit",
          baseValue: schemeUnit,
        });
      }
    }

    lines.sort((a, b) => {
      const order: Record<PricingBasePhase, number> = { 施工图: 0, 方案: 1, 按时间: 2 };
      return order[a.phase] - order[b.phase];
    });
  }

  return {
    available,
    subjectLabel,
    specialtyLabel: specialtyMeta.label,
    exampleTitle: `${(PRICING_BASE_EXAMPLE_AREA / 10000).toFixed(0)}万㎡ ${PRICING_BASE_EXAMPLE_PROJECT_TYPE}项目`,
    multiplierNote: available
      ? `已叠加等级 × 地区 × 项目类型（约 ${Math.round(sharedMult * 100)}%）`
      : "当前专业取费规则尚未接入",
    lines,
  };
}
