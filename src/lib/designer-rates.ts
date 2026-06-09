import {
  DESIGNER_LEVEL_META,
  LANDSCAPE_DAILY_RATE,
  LANDSCAPE_MONTHLY_RATE,
  REGION_TIER_META,
} from "@/lib/constants";
import type { Designer, DesignerLevel, RegionTier } from "@/lib/types";

/** 与 v1.1 文档中 LANDSCAPE_DAILY_RATE / MONTHLY 表一致的四级专业 key */
export type LandscapeTimeRateTrack = keyof typeof LANDSCAPE_DAILY_RATE.remote;

export const LANDSCAPE_TIME_TRACK_LABELS: Record<LandscapeTimeRateTrack, string> = {
  hardscape: "园建",
  softscape: "绿化",
  drainage: "给排水",
  electrical: "电气",
  structure: "结构",
};

const L3_TO_TRACK: Record<string, LandscapeTimeRateTrack> = {
  ls_garden: "hardscape",
  ls_garden_struct: "hardscape",
  ls_greening: "softscape",
  ls_drainage: "drainage",
  ls_drainage_irrigation: "drainage",
  ls_electrical: "electrical",
  ls_struct: "structure",
};

/**
 * 从设计师主航道推断景观按时间计费的档位（文档表行）。
 * 非景观专业时按文档仍以「园建」档为平台统一展示基准。
 */
export function inferDesignerLandscapeTimeTrack(d: Designer): LandscapeTimeRateTrack {
  const l3 = d.primaryTrack?.l3;
  if (l3 && L3_TO_TRACK[l3]) return L3_TO_TRACK[l3];
  if (d.specialty === "landscape") {
    if (d.subSpecialties.includes("greening")) return "softscape";
    if (d.subSpecialties.includes("drainage")) return "drainage";
    if (d.subSpecialties.includes("electrical")) return "electrical";
    return "hardscape";
  }
  return "hardscape";
}

export interface DesignerV11TimeRates {
  track: LandscapeTimeRateTrack;
  trackLabel: string;
  /** 线上 = 文档 remote；线下 = 文档 onsite（驻场基准，不含绘图加成） */
  remote: { daily: number; monthly: number };
  onsite: { daily: number; monthly: number };
  /** 叠加：等级系数 × 地区梯队系数 */
  multiplier: number;
}

/**
 * v1.1 景观按时间报价：基准单价（文档）× 设计师等级系数 × 地区梯队系数。
 * 与日 / 月费计算器中单价的组合方式一致（不含税额与平台费）。
 */
export function getDesignerV11TimeRates(designer: Designer): DesignerV11TimeRates {
  const track = inferDesignerLandscapeTimeTrack(designer);
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const tier: RegionTier = designer.regionTier ?? "tier6";

  const levelCoeff = DESIGNER_LEVEL_META[level].coefficient;
  const regionCoeff = REGION_TIER_META[tier].coefficient;
  const multiplier = levelCoeff * regionCoeff;

  const rd = LANDSCAPE_DAILY_RATE.remote[track];
  const od = LANDSCAPE_DAILY_RATE.onsite[track];
  const rm = LANDSCAPE_MONTHLY_RATE.remote[track];
  const om = LANDSCAPE_MONTHLY_RATE.onsite[track];

  return {
    track,
    trackLabel: LANDSCAPE_TIME_TRACK_LABELS[track],
    remote: {
      daily: Math.round(rd * multiplier),
      monthly: Math.round(rm * multiplier),
    },
    onsite: {
      daily: Math.round(od * multiplier),
      monthly: Math.round(om * multiplier),
    },
    multiplier,
  };
}
