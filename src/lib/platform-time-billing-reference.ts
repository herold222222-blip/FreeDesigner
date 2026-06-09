import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
} from "@/lib/constants";
import { LANDSCAPE_TIME_TRACK_LABELS } from "@/lib/designer-rates";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import type { ClientLevel, DesignerLevel, RegionTier } from "@/lib/types";

/** 发布委托时平台计费标准示例参数 */
export const PLATFORM_TIME_BILLING_REFERENCE = {
  designerRegion: "tier2" as RegionTier,
  designerLevel: "mid_v1" as DesignerLevel,
  clientLevel: "normal" as ClientLevel,
} as const;

export const PLATFORM_TIME_BILLING_REFERENCE_LABELS = {
  designerRegion: "二线城市",
  designerLevel: "中级设计师",
  clientLevel: "普通客户",
} as const;

export type TimeBillingReferenceTrack =
  | "hardscape"
  | "softscape"
  | "drainage"
  | "electrical";

const REFERENCE_TRACKS: TimeBillingReferenceTrack[] = [
  "hardscape",
  "softscape",
  "drainage",
  "electrical",
];

export interface TimeBillingReferenceRow {
  track: TimeBillingReferenceTrack;
  trackLabel: string;
  remote: number;
  onsite: number;
  onsiteWithDrawing: number;
}

export interface PlatformTimeBillingReference {
  unit: "day" | "month";
  unitSuffix: string;
  rows: TimeBillingReferenceRow[];
  exampleNote: string;
  formulaNote: string;
}

export function getPlatformTimeBillingReference(
  unit: "day" | "month",
  config: PlatformPricingConfig,
  refs: typeof PLATFORM_TIME_BILLING_REFERENCE = PLATFORM_TIME_BILLING_REFERENCE,
): PlatformTimeBillingReference {
  const rateTable =
    unit === "day" ? config.landscapeDailyRate : config.landscapeMonthlyRate;
  const levelCoeff = config.designerLevelCoefficient[refs.designerLevel];
  const regionCoeff = config.regionTierCoefficient[refs.designerRegion];
  const clientCoeff = config.clientLevelCoefficient[refs.clientLevel];
  const mult = levelCoeff * regionCoeff * clientCoeff;
  const drawingCoeff = config.onsiteWithDrawingCoefficient;

  const rows: TimeBillingReferenceRow[] = REFERENCE_TRACKS.map((track) => {
    const remoteBase = rateTable.remote[track];
    const onsiteBase = rateTable.onsite[track];
    const onsite = Math.round(onsiteBase * mult);
    return {
      track,
      trackLabel: LANDSCAPE_TIME_TRACK_LABELS[track],
      remote: Math.round(remoteBase * mult),
      onsite,
      onsiteWithDrawing: Math.round(onsite * drawingCoeff),
    };
  });

  const { designerRegion, designerLevel, clientLevel } =
    PLATFORM_TIME_BILLING_REFERENCE_LABELS;

  return {
    unit,
    unitSuffix: unit === "day" ? "工日" : "月",
    rows,
    exampleNote: `设计师所在地：${designerRegion} · 设计师等级：${designerLevel} · 客户等级：${clientLevel}`,
    formulaNote: `文档基准 × ${DESIGNER_LEVEL_META[refs.designerLevel].label} × ${REGION_TIER_META[refs.designerRegion].label} × ${CLIENT_LEVEL_META[refs.clientLevel].label} · 难度系数默认 100%`,
  };
}
