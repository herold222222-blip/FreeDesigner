import {
  LANDSCAPE_DAILY_RATE,
  resolveDesignerRegionTier,
} from "@/lib/constants";
import {
  calculateTimeBasedFee,
  timeDesignerRegionCoefficient,
} from "@/lib/fee-calculator";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";
import {
  DEFAULT_PLATFORM_PRICING_CONFIG,
  type PlatformPricingConfig,
} from "@/lib/platform-pricing";
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

/** 景观三级专业 → 按时间取费档位（园建 / 绿化 / …） */
export function landscapeTimeTrackFromL3(
  l3: string,
): LandscapeTimeRateTrack | null {
  return L3_TO_TRACK[l3] ?? null;
}

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
  /** 远程：等级 × 客户等级（地区系数固定 1.0） */
  remoteMultiplier: number;
  /** 驻场：等级 × 地区梯队 × 客户等级 */
  onsiteMultiplier: number;
}

/**
 * 景观按时间参考价：与 `calculateTimeBasedFee` 基础服务费口径一致。
 * 远程地区系数统一 1.0；驻场按设计师所在梯队；按普通客户、难度 100%、不含税与驻场含绘图加成。
 */
export function getDesignerV11TimeRates(
  designer: Designer,
  options?: {
    track?: LandscapeTimeRateTrack;
    config?: PlatformPricingConfig;
  },
): DesignerV11TimeRates {
  const track = options?.track ?? inferDesignerLandscapeTimeTrack(designer);
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const tier: RegionTier = resolveDesignerRegionTier(designer);
  const config = options?.config ?? DEFAULT_PLATFORM_PRICING_CONFIG;
  const levelCoeff = config.designerLevelCoefficient[level];
  const clientCoeff = config.clientLevelCoefficient[DEFAULT_CLIENT_LEVEL];
  const remoteMultiplier =
    levelCoeff * timeDesignerRegionCoefficient("remote", tier, config) * clientCoeff;
  const onsiteMultiplier =
    levelCoeff * timeDesignerRegionCoefficient("onsite", tier, config) * clientCoeff;

  const unitOf = (mode: "remote" | "onsite", unit: "day" | "month") =>
    calculateTimeBasedFee(
      {
        unit,
        quantity: 1,
        mode,
        track,
        designerLevel: level,
        designerRegion: tier,
        clientLevel: DEFAULT_CLIENT_LEVEL,
        withDrawing: false,
        difficulty: 1,
        taxCoefficient: 1,
      },
      config,
    ).basicFee;

  return {
    track,
    trackLabel: LANDSCAPE_TIME_TRACK_LABELS[track],
    remote: {
      daily: unitOf("remote", "day"),
      monthly: unitOf("remote", "month"),
    },
    onsite: {
      daily: unitOf("onsite", "day"),
      monthly: unitOf("onsite", "month"),
    },
    remoteMultiplier,
    onsiteMultiplier,
  };
}

export function formatDesignerTimeRateNote(rates: DesignerV11TimeRates): string {
  return `远程系数 ${Math.round(rates.remoteMultiplier * 100)}%（等级，地区 1.0）；驻场系数 ${Math.round(rates.onsiteMultiplier * 100)}%（等级 × 地区）。按普通客户测算，不含税与驻场含绘图加成。`;
}
