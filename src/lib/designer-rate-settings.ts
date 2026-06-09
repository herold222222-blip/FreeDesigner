import type {
  DesignerPricingBaseLine,
  DesignerPricingBaseSnapshot,
} from "@/lib/designer-pricing-base";
import { formatPricePerSqm } from "@/lib/designer-pricing-base";
import { formatCurrency } from "@/lib/utils";

export const DEFAULT_DESIGNER_RATE_PERCENT = 100;
export const MIN_DESIGNER_RATE_PERCENT = 50;
export const MAX_DESIGNER_RATE_PERCENT = 200;
export const DESIGNER_RATE_PERCENT_STEP = 5;

export type DesignerRatePercents = Record<string, number>;

export type TimeRateSubKey =
  | "remoteDaily"
  | "remoteMonthly"
  | "onsiteDaily"
  | "onsiteMonthly";

export const TIME_RATE_SUB_KEYS: TimeRateSubKey[] = [
  "remoteDaily",
  "remoteMonthly",
  "onsiteDaily",
  "onsiteMonthly",
];

export const TIME_RATE_SUB_META: Record<
  TimeRateSubKey,
  { group: "线上" | "驻场"; unit: "工日" | "月" }
> = {
  remoteDaily: { group: "线上", unit: "工日" },
  remoteMonthly: { group: "线上", unit: "月" },
  onsiteDaily: { group: "驻场", unit: "工日" },
  onsiteMonthly: { group: "驻场", unit: "月" },
};

export function getTimeRatePercentKey(lineId: string, subKey: TimeRateSubKey) {
  return `${lineId}:${subKey}`;
}

export function clampDesignerRatePercent(value: number): number {
  return Math.min(
    MAX_DESIGNER_RATE_PERCENT,
    Math.max(MIN_DESIGNER_RATE_PERCENT, Math.round(value)),
  );
}

export function getLineRatePercent(
  lineId: string,
  percents: DesignerRatePercents,
): number {
  const raw = percents[lineId];
  if (raw == null || Number.isNaN(raw)) return DEFAULT_DESIGNER_RATE_PERCENT;
  return clampDesignerRatePercent(raw);
}

export function getTimeSubRatePercent(
  lineId: string,
  subKey: TimeRateSubKey,
  percents: DesignerRatePercents,
): number {
  const subId = getTimeRatePercentKey(lineId, subKey);
  if (percents[subId] != null && !Number.isNaN(percents[subId])) {
    return clampDesignerRatePercent(percents[subId]);
  }
  return getLineRatePercent(lineId, percents);
}

function formatTimeBundleLabel(rates: {
  remoteDaily: number;
  remoteMonthly: number;
  onsiteDaily: number;
  onsiteMonthly: number;
}) {
  return `线上 ${formatCurrency(rates.remoteDaily)}/工日 · ${formatCurrency(rates.remoteMonthly)}/月 · 驻场 ${formatCurrency(rates.onsiteDaily)}/工日 · ${formatCurrency(rates.onsiteMonthly)}/月`;
}

export function applyRatePercentToLine(
  line: DesignerPricingBaseLine,
  percents: DesignerRatePercents,
): DesignerPricingBaseLine {
  if (line.rateKind === "area_unit") {
    const p = getLineRatePercent(line.id, percents);
    const factor = p / 100;
    return {
      ...line,
      amountLabel: formatPricePerSqm(line.baseValue * factor),
      customPercent: p,
    };
  }

  if (line.rateKind === "time_bundle" && line.timeBundle) {
    const tb = line.timeBundle;
    const timeCustomPercents = {
      remoteDaily: getTimeSubRatePercent(line.id, "remoteDaily", percents),
      remoteMonthly: getTimeSubRatePercent(line.id, "remoteMonthly", percents),
      onsiteDaily: getTimeSubRatePercent(line.id, "onsiteDaily", percents),
      onsiteMonthly: getTimeSubRatePercent(line.id, "onsiteMonthly", percents),
    };
    const appliedTimeRates = {
      remoteDaily: Math.round(tb.remoteDaily * (timeCustomPercents.remoteDaily / 100)),
      remoteMonthly: Math.round(
        tb.remoteMonthly * (timeCustomPercents.remoteMonthly / 100),
      ),
      onsiteDaily: Math.round(tb.onsiteDaily * (timeCustomPercents.onsiteDaily / 100)),
      onsiteMonthly: Math.round(
        tb.onsiteMonthly * (timeCustomPercents.onsiteMonthly / 100),
      ),
    };
    return {
      ...line,
      amountLabel: `${formatCurrency(appliedTimeRates.remoteDaily)}/工日`,
      subLabel: formatTimeBundleLabel(appliedTimeRates),
      timeCustomPercents,
      appliedTimeRates,
    };
  }

  return line;
}

export function applyRateSettingsToSnapshot(
  snapshot: DesignerPricingBaseSnapshot,
  percents: DesignerRatePercents,
): DesignerPricingBaseSnapshot {
  return {
    ...snapshot,
    lines: snapshot.lines.map((line) => applyRatePercentToLine(line, percents)),
  };
}

export function buildDefaultPercents(
  snapshot: DesignerPricingBaseSnapshot,
): DesignerRatePercents {
  const out: DesignerRatePercents = {};
  for (const line of snapshot.lines) {
    if (line.rateKind === "time_bundle") {
      for (const subKey of TIME_RATE_SUB_KEYS) {
        out[getTimeRatePercentKey(line.id, subKey)] = DEFAULT_DESIGNER_RATE_PERCENT;
      }
    } else {
      out[line.id] = DEFAULT_DESIGNER_RATE_PERCENT;
    }
  }
  return out;
}

export function mergePercentsWithDefaults(
  snapshot: DesignerPricingBaseSnapshot,
  saved: DesignerRatePercents,
): DesignerRatePercents {
  const merged = buildDefaultPercents(snapshot);
  for (const line of snapshot.lines) {
    if (line.rateKind === "time_bundle") {
      const legacy = saved[line.id];
      for (const subKey of TIME_RATE_SUB_KEYS) {
        const subId = getTimeRatePercentKey(line.id, subKey);
        if (saved[subId] != null) {
          merged[subId] = clampDesignerRatePercent(saved[subId]);
        } else if (legacy != null) {
          merged[subId] = clampDesignerRatePercent(legacy);
        }
      }
    } else if (saved[line.id] != null) {
      merged[line.id] = getLineRatePercent(line.id, saved);
    }
  }
  return merged;
}

export function hasCustomRateSettings(percents: DesignerRatePercents): boolean {
  return Object.values(percents).some(
    (p) => clampDesignerRatePercent(p) !== DEFAULT_DESIGNER_RATE_PERCENT,
  );
}

export function hasCustomTimeRateSettings(
  lineId: string,
  percents: DesignerRatePercents,
): boolean {
  return TIME_RATE_SUB_KEYS.some(
    (subKey) =>
      getTimeSubRatePercent(lineId, subKey, percents) !==
      DEFAULT_DESIGNER_RATE_PERCENT,
  );
}
