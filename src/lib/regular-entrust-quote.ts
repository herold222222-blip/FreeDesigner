import {
  AUDIT_SERVICE_RATE,
  PROJECT_MANAGEMENT_RATE,
} from "@/lib/constants";
import { calculateTimeBasedFee } from "@/lib/fee-calculator";
import {
  LANDSCAPE_TIME_TRACK_LABELS,
  landscapeTimeTrackFromL3,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import {
  difficultyOptionKey,
  landscapeTimeDifficultyUI,
} from "@/lib/landscape-area-difficulty";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import { DEFAULT_PLATFORM_PRICING_CONFIG } from "@/lib/platform-pricing";
import type {
  ClientLevel,
  DesignerLevel,
  OrderQuote,
  OrderQuoteLine,
  RegionTier,
} from "@/lib/types";

export interface RegularTimeQuoteLineInput {
  l3: string;
  l3Label: string;
  quantity: number;
  /** difficultyOptionKey，缺省取该专业第一档 */
  difficultyKey?: string;
}

export interface BuildRegularTimeQuoteInput {
  unit: "day" | "month";
  serviceMode: "remote" | "onsite";
  withDrawing?: boolean;
  withAudit?: boolean;
  withPM?: boolean;
  lines: RegularTimeQuoteLineInput[];
  /** 报价测算假设；未指定时用平台默认中位档 */
  designerLevel?: DesignerLevel;
  designerRegion?: RegionTier;
  clientLevel?: ClientLevel;
  taxCoefficient?: number;
  pricingConfig?: PlatformPricingConfig;
}

function resolveDifficulty(
  track: LandscapeTimeRateTrack,
  difficultyKey: string | undefined,
  pricingConfig: PlatformPricingConfig,
): { value: number; label: string } {
  const ui = landscapeTimeDifficultyUI(track, pricingConfig.landscapeDifficulty);
  if (ui.kind === "fixed") {
    return { value: ui.value, label: "固定" };
  }
  const hit =
    (difficultyKey
      ? ui.options.find((o) => difficultyOptionKey(o) === difficultyKey)
      : null) ?? ui.options[0];
  return {
    value: hit?.value ?? 1,
    label: hit?.label ?? "中",
  };
}

/**
 * 按天 / 按月常规委托：根据三级专业工时生成系统报价单。
 * 尚未指定设计师时，按中级设计师 + 三线城市 + 普通客户测算。
 */
export function buildRegularTimeQuote(
  input: BuildRegularTimeQuoteInput,
): OrderQuote {
  const pricingConfig = input.pricingConfig ?? DEFAULT_PLATFORM_PRICING_CONFIG;
  const designerLevel = input.designerLevel ?? "mid_v1";
  const designerRegion = input.designerRegion ?? "tier3";
  const clientLevel = input.clientLevel ?? "normal";
  const taxCoefficient =
    input.taxCoefficient ?? pricingConfig.taxOptions[0]?.coefficient ?? 1.06;
  const mode = input.serviceMode;
  const withDrawing = Boolean(input.withDrawing);

  const lines: OrderQuoteLine[] = [];
  let basicFee = 0;
  let platformFee = 0;

  for (const row of input.lines) {
    if (!(row.quantity > 0)) continue;
    const track = landscapeTimeTrackFromL3(row.l3);
    if (!track) continue;
    const difficulty = resolveDifficulty(
      track,
      row.difficultyKey,
      pricingConfig,
    );
    const breakdown = calculateTimeBasedFee(
      {
        unit: input.unit,
        quantity: row.quantity,
        mode,
        track,
        designerLevel,
        designerRegion,
        clientLevel,
        withDrawing,
        difficulty: difficulty.value,
        taxCoefficient: 1,
      },
      pricingConfig,
    );
    basicFee += breakdown.basicFee;
    platformFee += breakdown.platformFee;
    lines.push({
      track,
      trackLabel: LANDSCAPE_TIME_TRACK_LABELS[track],
      l3: row.l3,
      l3Label: row.l3Label,
      quantity: row.quantity,
      unit: input.unit,
      difficulty: difficulty.value,
      difficultyLabel: difficulty.label,
      basicFee: breakdown.basicFee,
      platformFee: breakdown.platformFee,
      subtotal: breakdown.subtotal,
    });
  }

  if (!lines.length) {
    throw new Error("请至少填写一个有效工时专业后再生成报价");
  }

  const auditFee = input.withAudit
    ? Math.round(basicFee * AUDIT_SERVICE_RATE)
    : 0;
  const projectManagementFee = input.withPM
    ? Math.round(basicFee * PROJECT_MANAGEMENT_RATE)
    : 0;
  const subtotal = basicFee + platformFee + auditFee + projectManagementFee;
  const total = Math.round(subtotal * taxCoefficient);

  return {
    status: "pending",
    generatedAt: new Date().toISOString(),
    basicFee,
    platformFee,
    auditFee,
    projectManagementFee,
    subtotal,
    taxCoefficient,
    total,
    lines,
    assumptions: {
      designerLevel,
      designerRegion,
      clientLevel,
      serviceMode: mode,
      withDrawing,
      note: "报价按中级设计师、三线城市、普通客户等级测算；平台匹配具体设计师后费用可能微调。",
    },
  };
}
