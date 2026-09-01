import type {
  DesignerPricingBaseLine,
  DesignerPricingBaseSnapshot,
} from "@/lib/designer-pricing-base";
import { formatPricePerSqm } from "@/lib/designer-pricing-base";
import {
  getDesignerV11TimeRates,
  LANDSCAPE_TIME_TRACK_LABELS,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import type { Designer } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export const DEFAULT_DESIGNER_RATE_PERCENT = 100;
/** 自定义费率百分比无上限；仅拒绝负数与非数字 */
export const MIN_DESIGNER_RATE_PERCENT = 0;
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
  if (!Number.isFinite(value)) return DEFAULT_DESIGNER_RATE_PERCENT;
  return Math.max(MIN_DESIGNER_RATE_PERCENT, Math.round(value));
}

const LANDSCAPE_AREA_TRACK_L3: Record<
  "hardscape" | "softscape" | "drainage" | "electrical",
  string[]
> = {
  hardscape: ["ls_garden", "ls_garden_struct"],
  softscape: ["ls_greening"],
  drainage: ["ls_drainage", "ls_drainage_irrigation"],
  electrical: ["ls_electrical"],
};

/** 扫码 / 定向下单按面积：套用设计师本人费率百分比（相对综合基数） */
export function designerLandscapeAreaTrackFactor(
  track: "hardscape" | "softscape" | "drainage" | "electrical",
  selectedL2: string[],
  percents: DesignerRatePercents | undefined,
): number {
  const map = percents ?? {};
  const schemeOnly =
    selectedL2.length > 0 && selectedL2.every((l2) => l2 === "scheme");
  const prefix = schemeOnly
    ? "scheme"
    : selectedL2.includes("construction_doc")
      ? "cd"
      : selectedL2.includes("preliminary")
        ? "pre"
        : "cd";
  const l3s = LANDSCAPE_AREA_TRACK_L3[track] ?? [];
  for (const l3 of l3s) {
    const key = `${prefix}-${l3}`;
    if (map[key] != null && !Number.isNaN(map[key])) {
      return getLineRatePercent(key, map) / 100;
    }
  }
  return getLineRatePercent(`${prefix}-${l3s[0] ?? ""}`, map) / 100;
}

/** 扫码 / 定向下单按工时：平台综合基数 × 设计师本人时间费率百分比 */
export function designerAppliedTimeRates(
  designer: Designer,
  track: LandscapeTimeRateTrack,
  percents: DesignerRatePercents | undefined,
  config?: PlatformPricingConfig,
) {
  const base = getDesignerV11TimeRates(designer, { track, config });
  const lineId = `time-${track}`;
  const map = percents ?? {};
  const factor = (sub: TimeRateSubKey) =>
    getTimeSubRatePercent(lineId, sub, map) / 100;
  return {
    track,
    trackLabel: LANDSCAPE_TIME_TRACK_LABELS[track],
    remoteDaily: Math.round(base.remote.daily * factor("remoteDaily")),
    remoteMonthly: Math.round(base.remote.monthly * factor("remoteMonthly")),
    onsiteDaily: Math.round(base.onsite.daily * factor("onsiteDaily")),
    onsiteMonthly: Math.round(base.onsite.monthly * factor("onsiteMonthly")),
  };
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
