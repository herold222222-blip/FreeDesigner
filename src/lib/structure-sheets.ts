import type { OrderQuote, OrderQuoteLine } from "@/lib/types";

/** 景观结构专业按张计价：450 元/张 */
export const STRUCTURE_SHEET_UNIT_PRICE = 450;
export const STRUCTURE_L3 = "ls_struct";
export const STRUCTURE_TRACK = "structure";
export const STRUCTURE_L3_LABEL = "景观结构专业";
export const STRUCTURE_TRACK_LABEL = "结构";

export type StructureSheetsMode = "pending" | "estimate";

export type StructureSheetsInput = {
  mode: StructureSheetsMode;
  /** 预估或已确认张数；待系统评估时可省略 */
  sheets?: number;
};

export function isStructureL3(l3?: string | null): boolean {
  return l3 === STRUCTURE_L3;
}

export function isStructureQuoteLine(
  line: Pick<OrderQuoteLine, "l3" | "track" | "unit">,
): boolean {
  return (
    isStructureL3(line.l3) ||
    line.track === STRUCTURE_TRACK ||
    line.unit === "sheet"
  );
}

export function parsePositiveIntSheets(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function structureFeeFromSheets(sheets: number): number {
  const n = Math.max(0, Math.floor(sheets));
  return n * STRUCTURE_SHEET_UNIT_PRICE;
}

export function findStructureQuoteLine(
  lines?: OrderQuoteLine[] | null,
): OrderQuoteLine | undefined {
  return lines?.find(isStructureQuoteLine);
}

export function getStructureSheetsFromQuote(
  quote?: Pick<OrderQuote, "lines"> | null,
): number {
  const line = findStructureQuoteLine(quote?.lines);
  if (!line || line.quantityPending) return 0;
  return Math.max(0, Math.floor(line.quantity || 0));
}

export function getStructureSheetsFromOrder(order: {
  quote?: OrderQuote | null;
  levelQuotes?: OrderQuote[] | null;
}): number {
  const source =
    order.quote ??
    order.levelQuotes?.find((q) => q.lines?.some(isStructureQuoteLine)) ??
    order.levelQuotes?.find((q) => q.lines?.length) ??
    null;
  return getStructureSheetsFromQuote(source);
}

export function isStructureQuantityPending(order: {
  quote?: OrderQuote | null;
  levelQuotes?: OrderQuote[] | null;
}): boolean {
  const source =
    order.quote ??
    order.levelQuotes?.find((q) => q.lines?.some(isStructureQuoteLine)) ??
    null;
  const line = findStructureQuoteLine(source?.lines);
  if (!line) return false;
  return Boolean(line.quantityPending) || !(line.quantity > 0);
}

export function hasStructureQuoteLine(order: {
  quote?: OrderQuote | null;
  levelQuotes?: OrderQuote[] | null;
}): boolean {
  return Boolean(
    findStructureQuoteLine(order.quote?.lines) ||
      order.levelQuotes?.some((q) => findStructureQuoteLine(q.lines)),
  );
}

export function normalizeStructureSheetsInput(
  input?: StructureSheetsInput | null,
): { pending: boolean; sheets: number } | null {
  if (!input) return null;
  if (input.mode === "pending") {
    return { pending: true, sheets: 0 };
  }
  const sheets = parsePositiveIntSheets(input.sheets);
  if (sheets == null) return null;
  return { pending: false, sheets };
}

export function buildStructureQuoteLine(input: {
  sheets: number;
  pending?: boolean;
}): OrderQuoteLine {
  const pending = Boolean(input.pending) || !(input.sheets > 0);
  const sheets = pending ? 0 : Math.floor(input.sheets);
  const fee = structureFeeFromSheets(sheets);
  return {
    track: STRUCTURE_TRACK,
    trackLabel: STRUCTURE_TRACK_LABEL,
    l3: STRUCTURE_L3,
    l3Label: STRUCTURE_L3_LABEL,
    quantity: sheets,
    unit: "sheet",
    difficulty: 1,
    difficultyLabel: pending ? "待系统评估" : "按张计价",
    basicFee: fee,
    platformFee: 0,
    subtotal: fee,
    quantityPending: pending,
  };
}

export function structureSheetsInputFromLine(
  line?: OrderQuoteLine | null,
): StructureSheetsInput | undefined {
  if (!line || !isStructureQuoteLine(line)) return undefined;
  if (line.quantityPending || !(line.quantity > 0)) {
    return { mode: "pending" };
  }
  return { mode: "estimate", sheets: Math.floor(line.quantity) };
}

/**
 * 写入 / 更新报价单中的结构行。
 * retax=true：按新税前合计重算含税总额（发布 / 匹配期重算）。
 * retax=false：结构差额按 450×Δ张 直接加到总额（履约中增补，不再叠税）。
 */
export function applyStructureLineToQuote(
  quote: OrderQuote,
  input: { sheets: number; pending?: boolean },
  options?: { retax?: boolean },
): OrderQuote {
  const prev = findStructureQuoteLine(quote.lines);
  const next = buildStructureQuoteLine(input);
  const lines = [
    ...quote.lines.filter((line) => !isStructureQuoteLine(line)),
    next,
  ];
  const basicDelta = next.basicFee - (prev?.basicFee ?? 0);
  const basicFee = quote.basicFee + basicDelta;
  const subtotal = quote.subtotal + basicDelta;
  const tax = quote.taxCoefficient > 0 ? quote.taxCoefficient : 1;
  const total =
    options?.retax === false
      ? quote.total + basicDelta
      : Math.round(subtotal * tax);
  return {
    ...quote,
    lines,
    basicFee,
    subtotal,
    total,
  };
}

export function applyStructureLineToQuotes<
  T extends { quote?: OrderQuote | null; levelQuotes?: OrderQuote[] | null },
>(order: T, input: { sheets: number; pending?: boolean }, options?: { retax?: boolean }): T {
  const quote = order.quote
    ? applyStructureLineToQuote(order.quote, input, options)
    : order.quote;
  const levelQuotes = order.levelQuotes?.length
    ? order.levelQuotes.map((q) => applyStructureLineToQuote(q, input, options))
    : order.levelQuotes;
  return { ...order, quote, levelQuotes };
}

export function formatStructureSheetsLabel(
  sheets: number,
  pending?: boolean,
): string {
  if (pending || !(sheets > 0)) return "待系统评估";
  return `${Math.floor(sheets)} 张`;
}

export function structureFeeHint(sheets: number): string {
  const n = Math.max(0, Math.floor(sheets));
  return `¥${STRUCTURE_SHEET_UNIT_PRICE} × ${n} 张 = ¥${structureFeeFromSheets(n).toLocaleString("zh-CN")}`;
}
