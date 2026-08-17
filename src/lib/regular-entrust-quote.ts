import {
  AUDIT_SERVICE_RATE,
  CLIENT_LEVEL_META,
  PROJECT_MANAGEMENT_RATE,
  resolveDesignerRegionTier,
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
  Designer,
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
  /** 重算报价时沿用已落库难度（优先于 difficultyKey） */
  difficulty?: number;
  difficultyLabel?: string;
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
    const difficulty =
      row.difficulty != null && row.difficulty > 0
        ? {
            value: row.difficulty,
            label: row.difficultyLabel ?? "",
          }
        : resolveDifficulty(track, row.difficultyKey, pricingConfig);
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
      note:
        mode === "remote"
          ? `报价按${DESIGNER_LEVEL_META_LABEL[designerLevel] ?? designerLevel}测算；远程服务设计师地区系数统一按 1.0；客户等级按委托人实际等级（${CLIENT_LEVEL_META[clientLevel].label}）；选定该档设计师后按此价格锁定。`
          : `报价按${DESIGNER_LEVEL_META_LABEL[designerLevel] ?? designerLevel}、${designerRegion}、${CLIENT_LEVEL_META[clientLevel].label}测算；选定该档设计师后按此价格锁定。`,
    },
  };
}

const DESIGNER_LEVEL_META_LABEL: Record<string, string> = {
  intern: "见习设计师",
  mid_v1: "中级设计师",
  senior_v1: "高级设计师",
  specialist: "特级设计师",
};

/** 按报价行 + 实际设计师重算该专业工时费用（等级 / 地区用设计师本人） */
export function computeTimeLineBreakdown(
  order: {
    quote?: OrderQuote | null;
  },
  line: OrderQuoteLine,
  designer?: Designer | null,
) {
  const track = line.l3 ? landscapeTimeTrackFromL3(line.l3) : null;
  const assumptions = order.quote?.assumptions;
  if (!track || !assumptions || !(line.quantity > 0)) return null;
  return calculateTimeBasedFee({
    unit: line.unit,
    quantity: line.quantity,
    mode: assumptions.serviceMode,
    track,
    designerLevel: designer?.level ?? assumptions.designerLevel,
    designerRegion: designer
      ? resolveDesignerRegionTier(designer)
      : assumptions.designerRegion,
    clientLevel: assumptions.clientLevel,
    withDrawing: assumptions.withDrawing,
    difficulty: line.difficulty || 1,
    taxCoefficient: 1,
  });
}

function isTimeBilled(billingMode?: string) {
  return billingMode === "daily" || billingMode === "monthly";
}

/** 已委派后：按各专业实际设计师汇总税前 / 含税总额 */
export function computeAssignedTimeOrderTotals(
  order: {
    billingMode?: string;
    quote?: OrderQuote | null;
    trackAssignments?: Array<{ designerId: string; l3: string }>;
    designerId?: string;
    withAuditService?: boolean;
    withProjectManagement?: boolean;
  },
  getDesigner?: (id: string) => Designer | undefined,
) {
  const quote = order.quote;
  if (!quote?.lines?.length || !isTimeBilled(order.billingMode)) return null;

  const slots =
    order.trackAssignments?.length ?
      order.trackAssignments
    : order.designerId
      ? [{ designerId: order.designerId, l3: quote.lines[0]?.l3 ?? "" }]
      : [];
  if (!slots.length || !getDesigner) return null;

  let basicFee = 0;
  let platformFee = 0;
  let used = 0;
  for (const slot of slots) {
    const line =
      quote.lines.find((l) => l.l3 && l.l3 === slot.l3) ??
      (slots.length === 1 ? quote.lines[0] : undefined);
    if (!line) continue;
    const designer = getDesigner(slot.designerId);
    const breakdown = computeTimeLineBreakdown(order, line, designer);
    if (!breakdown) continue;
    basicFee += breakdown.basicFee;
    platformFee += breakdown.platformFee;
    used += 1;
  }
  if (!used) return null;

  const auditFee = order.withAuditService
    ? Math.round(basicFee * AUDIT_SERVICE_RATE)
    : 0;
  const projectManagementFee = order.withProjectManagement
    ? Math.round(basicFee * PROJECT_MANAGEMENT_RATE)
    : 0;
  const preTax = basicFee + platformFee + auditFee + projectManagementFee;
  const tax = quote.taxCoefficient > 0 ? quote.taxCoefficient : 1;
  return {
    basicFee,
    platformFee,
    auditFee,
    projectManagementFee,
    preTax,
    total: Math.round(preTax * tax),
  };
}

export function rebuildTimeQuoteFromAssignments(
  order: {
    quote?: OrderQuote | null;
    trackAssignments?: Array<{ designerId: string; l3: string }>;
    withAuditService?: boolean;
    withProjectManagement?: boolean;
    billingMode?: string;
  },
  getDesigner: (id: string) => Designer | undefined,
): OrderQuote | null {
  const quote = order.quote;
  const totals = computeAssignedTimeOrderTotals(order, getDesigner);
  if (!quote || !totals) return null;

  const assignments = order.trackAssignments ?? [];
  const lines: OrderQuoteLine[] = [];
  for (const slot of assignments) {
    const source = quote.lines.find((l) => l.l3 && l.l3 === slot.l3);
    if (!source) continue;
    const breakdown = computeTimeLineBreakdown(
      order,
      source,
      getDesigner(slot.designerId),
    );
    if (!breakdown) continue;
    lines.push({
      ...source,
      basicFee: breakdown.basicFee,
      platformFee: breakdown.platformFee,
      subtotal: breakdown.subtotal,
    });
  }
  if (!lines.length) return null;

  const primary = getDesigner(assignments[0]?.designerId);
  return {
    ...quote,
    basicFee: totals.basicFee,
    platformFee: totals.platformFee,
    auditFee: totals.auditFee,
    projectManagementFee: totals.projectManagementFee,
    subtotal: totals.preTax,
    total: totals.total,
    lines,
    assumptions: {
      ...quote.assumptions,
      designerLevel: primary?.level ?? quote.assumptions.designerLevel,
      designerRegion: primary
        ? resolveDesignerRegionTier(primary)
        : quote.assumptions.designerRegion,
    },
  };
}

/** 税前合计：基础服务费 + 平台管理费 + 审图费（如有）+ 项目管理费（如有） */
export function getQuotePreTaxTotal(quote: OrderQuote): number {
  const amount =
    quote.basicFee +
    quote.platformFee +
    (quote.auditFee ?? 0) +
    (quote.projectManagementFee ?? 0);
  return amount > 0 ? amount : quote.subtotal;
}

/** 委托人订单总额 = 含税总额 = 税前合计 × 税率系数 */
export function getQuoteOrderTotal(quote: OrderQuote): number {
  const preTax = getQuotePreTaxTotal(quote);
  const tax = quote.taxCoefficient > 0 ? quote.taxCoefficient : 1;
  return Math.round(preTax * tax);
}

export function getClientOrderTotal(
  order: {
    billingMode?: string;
    totalAmount: number;
    quote?: OrderQuote | null;
    trackAssignments?: Array<{ designerId: string; l3: string }>;
    designerId?: string;
    withAuditService?: boolean;
    withProjectManagement?: boolean;
  },
  getDesigner?: (id: string) => Designer | undefined,
): number {
  const assigned = computeAssignedTimeOrderTotals(order, getDesigner);
  if (assigned) return assigned.total;
  if (order.quote && isTimeBilled(order.billingMode)) {
    return getQuoteOrderTotal(order.quote);
  }
  return order.totalAmount;
}

/** 委托人报价卡对应的四个设计师等级 */
export const CLIENT_QUOTE_LEVELS: DesignerLevel[] = [
  "intern",
  "mid_v1",
  "senior_v1",
  "specialist",
];

/** 一次生成见习 / 中级 / 高级 / 特级四档报价卡 */
export function buildRegularTimeQuotesByLevel(
  input: Omit<BuildRegularTimeQuoteInput, "designerLevel">,
): OrderQuote[] {
  return CLIENT_QUOTE_LEVELS.map((designerLevel) =>
    buildRegularTimeQuote({ ...input, designerLevel }),
  );
}

/** 从已有报价单提取工时行，供修改委托后重算四档报价 */
export function extractTimeQuoteLineInputsFromOrder(order: {
  quote?: OrderQuote | null;
  levelQuotes?: OrderQuote[] | null;
}): RegularTimeQuoteLineInput[] {
  const source =
    order.levelQuotes?.find((q) => q.lines?.length) ??
    order.quote ??
    null;
  if (!source?.lines?.length) return [];
  return source.lines
    .filter((line) => line.l3 && line.quantity > 0)
    .map((line) => ({
      l3: line.l3!,
      l3Label: line.l3Label ?? line.trackLabel,
      quantity: line.quantity,
      difficulty: line.difficulty,
      difficultyLabel: line.difficultyLabel,
    }));
}
