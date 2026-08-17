/**
 * 文档 3.1.1.2.6 · 景观按面积 / 按时间计费时的三级专业难度系数展示与取值。
 */

import type { LandscapeTrackDifficultyConfig } from "@/lib/platform-pricing";

export interface LandscapeAreaDifficultyOption {
  value: number;
  label: string;
  /** 文档备注原文 */
  remark: string;
  /** 同系数多档时用于区分选中项（如给排水人工取水 / 自动喷灌） */
  id?: string;
}

export function difficultyOptionKey(opt: LandscapeAreaDifficultyOption): string {
  return opt.id ?? String(opt.value);
}

/** 园建取值范围说明（含简单园林结构的园建档位；不含计算书；大型钢结构、≥3m 挡墙等需另选结构设计） */
export const LANDSCAPE_HARDSCAPE_SCOPE_NOTE =
  "园建专业（含简单园林结构，不含计算书，大型钢结构以及大于等于 3 米挡墙，如有需要额外选择结构设计）：";

export const LANDSCAPE_HARDSCAPE_DIFFICULTY: LandscapeAreaDifficultyOption[] = [
  {
    value: 1.2,
    label: "高",
    remark: "大量设计细节，围墙，大门，景墙，亭廊水景较多",
  },
  {
    value: 1.0,
    label: "中",
    remark: "园建设计元素齐全，常规设计复杂程度",
  },
  {
    value: 0.8,
    label: "低",
    remark: "园建比如围墙、大门、景墙、水景等设计简单，或某一两项没有",
  },
  {
    value: 0.6,
    label: "极低",
    remark: "无围墙大门，少量景墙，无水景",
  },
];

export const LANDSCAPE_SOFTSCAPE_DIFFICULTY: LandscapeAreaDifficultyOption[] = [
  {
    value: 1.2,
    label: "高",
    remark: "大量特色植物空间，花境，植物相对红线面积占比较很高",
  },
  {
    value: 1.0,
    label: "中",
    remark: "常规植物组团，乔灌草，植物相对红线面积占比较适中",
  },
  {
    value: 0.8,
    label: "低",
    remark: "组团简单，草坪空间较多，植物相对红线面积占比较低",
  },
  {
    value: 0.6,
    label: "极低",
    remark: "大面积草坪，少量品种单一地被，零星乔木或者植物相对红线面积占比很低",
  },
];

/** 给排水仅有二档（文档无「高/中/低」四档）· 按面积 */
export const LANDSCAPE_DRAINAGE_DIFFICULTY: LandscapeAreaDifficultyOption[] = [
  {
    id: "manual",
    value: 1.0,
    label: "人工取水",
    remark: "人工取水（系数 100%）",
  },
  {
    id: "irrigation",
    value: 1.3,
    label: "自动喷灌",
    remark: "自动喷灌（系数 130%）",
  },
];

/**
 * 按天 / 按月计费 · 景观施工图三级专业难度（仅园建 / 绿化 / 给排水）。
 * 与按面积四档规则不同，不复用面积侧配置。
 */
export const LANDSCAPE_TIME_HARDSCAPE_DIFFICULTY: LandscapeAreaDifficultyOption[] =
  [
    {
      id: "mid",
      value: 1.0,
      label: "中",
      remark: "仅负责园建专业内容",
    },
    {
      id: "high",
      value: 1.2,
      label: "高",
      remark: "需要懂得并协调绿化、水电专业",
    },
  ];

export const LANDSCAPE_TIME_SOFTSCAPE_DIFFICULTY: LandscapeAreaDifficultyOption[] =
  [
    {
      id: "mid",
      value: 1.0,
      label: "中",
      remark: "常规乔木组合乔灌草",
    },
    {
      id: "high",
      value: 1.2,
      label: "高",
      remark: "大量特色植物空间，水系，热带/沙漠植物或者花境较多",
    },
  ];

export const LANDSCAPE_TIME_DRAINAGE_DIFFICULTY: LandscapeAreaDifficultyOption[] =
  [
    {
      id: "manual",
      value: 1.0,
      label: "人工取水",
      remark: "人工取水（系数 100%）",
    },
    {
      id: "irrigation",
      value: 1.0,
      label: "自动喷灌",
      remark: "自动喷灌（系数 100%）",
    },
  ];

export type AreaLandscapeTrack =
  | "hardscape"
  | "softscape"
  | "drainage"
  | "electrical";

export type TimeLandscapeTrack =
  | "hardscape"
  | "softscape"
  | "drainage"
  | "electrical"
  | "structure";

/** 按时间计费中具备难度系数选项的专业 */
export function hasLandscapeTimeDifficultySelect(
  t: TimeLandscapeTrack,
): boolean {
  return t === "hardscape" || t === "softscape" || t === "drainage";
}

export type LandscapeAreaDifficultyUIMode =
  | { kind: "select"; options: LandscapeAreaDifficultyOption[] }
  | { kind: "fixed"; value: number; note: string };

const DEFAULT_DIFFICULTY: LandscapeTrackDifficultyConfig = {
  hardscapeScopeNote: LANDSCAPE_HARDSCAPE_SCOPE_NOTE,
  hardscape: LANDSCAPE_HARDSCAPE_DIFFICULTY,
  softscape: LANDSCAPE_SOFTSCAPE_DIFFICULTY,
  drainage: LANDSCAPE_DRAINAGE_DIFFICULTY,
  electrical: {
    coefficient: 1,
    note: "电气专业难度系数固定为 100%。",
  },
};

export function landscapeAreaDifficultyUI(
  t: AreaLandscapeTrack,
  cfg: LandscapeTrackDifficultyConfig = DEFAULT_DIFFICULTY,
): LandscapeAreaDifficultyUIMode {
  switch (t) {
    case "hardscape":
      return { kind: "select", options: cfg.hardscape };
    case "softscape":
      return { kind: "select", options: cfg.softscape };
    case "drainage":
      return { kind: "select", options: cfg.drainage };
    default:
      return {
        kind: "fixed",
        value: cfg.electrical.coefficient,
        note: cfg.electrical.note,
      };
  }
}

export function getHardscapeScopeNote(
  cfg: LandscapeTrackDifficultyConfig = DEFAULT_DIFFICULTY,
) {
  return cfg.hardscapeScopeNote;
}

/**
 * 按时间报价难度：
 * - 园建 / 绿化 / 给排水：按天计费专用二档（与按面积四档不同）
 * - 电气：固定 100%
 * - 结构：无独立难度档，固定 100%
 */
export function isTimeLandscapeTrack(t: string): t is TimeLandscapeTrack {
  return (
    t === "hardscape" ||
    t === "softscape" ||
    t === "drainage" ||
    t === "electrical" ||
    t === "structure"
  );
}

export type TimeDifficultyDisplay = {
  label: string;
  value: number;
  percent: string;
  remark?: string;
};

/** 按时间计费：把已选难度还原为展示用的档位名、系数与说明 */
export function resolveTimeDifficultyDisplay(input: {
  track?: TimeLandscapeTrack | string | null;
  difficulty?: number;
  difficultyLabel?: string;
  difficultyKey?: string;
}): TimeDifficultyDisplay | null {
  const track =
    input.track && isTimeLandscapeTrack(input.track) ? input.track : undefined;
  if (track) {
    const ui = landscapeTimeDifficultyUI(track);
    if (ui.kind === "fixed") {
      return {
        label: "固定",
        value: ui.value,
        percent: `${Math.round(ui.value * 100)}%`,
        remark: ui.note,
      };
    }
    const byKey = input.difficultyKey
      ? ui.options.find((o) => difficultyOptionKey(o) === input.difficultyKey)
      : undefined;
    const byLabel = input.difficultyLabel
      ? ui.options.find((o) => o.label === input.difficultyLabel)
      : undefined;
    const byValue =
      input.difficulty != null
        ? ui.options.filter(
            (o) => Math.abs(o.value - input.difficulty!) < 0.001,
          )
        : [];
    const hit =
      byKey ??
      byLabel ??
      (byValue.length === 1
        ? byValue[0]
        : byValue.find((o) => o.label === input.difficultyLabel) ??
          byValue[0]);
    if (hit) {
      return {
        label: hit.label,
        value: hit.value,
        percent: `${Math.round(hit.value * 100)}%`,
        remark: hit.remark,
      };
    }
  }
  if (input.difficulty == null && !input.difficultyLabel) return null;
  const value = input.difficulty ?? 1;
  return {
    label: input.difficultyLabel ?? "",
    value,
    percent: `${Math.round(value * 100)}%`,
  };
}

export function formatTimeDifficultySuffix(
  display: TimeDifficultyDisplay,
): string {
  const head = `难度${display.label} ${display.percent}`.replace(/\s+/g, " ").trim();
  return display.remark ? `${head}（${display.remark}）` : head;
}

export function landscapeTimeDifficultyUI(
  t: TimeLandscapeTrack,
  cfg: LandscapeTrackDifficultyConfig = DEFAULT_DIFFICULTY,
): LandscapeAreaDifficultyUIMode {
  switch (t) {
    case "hardscape":
      return { kind: "select", options: LANDSCAPE_TIME_HARDSCAPE_DIFFICULTY };
    case "softscape":
      return { kind: "select", options: LANDSCAPE_TIME_SOFTSCAPE_DIFFICULTY };
    case "drainage":
      return { kind: "select", options: LANDSCAPE_TIME_DRAINAGE_DIFFICULTY };
    case "electrical":
      return {
        kind: "fixed",
        value: cfg.electrical.coefficient,
        note: cfg.electrical.note,
      };
    default:
      return {
        kind: "fixed",
        value: 1,
        note: "结构专业按时间计费暂无独立难度档位，系数固定 100%。",
      };
  }
}

/** 园建「高 · 120%（协调绿化、水电）」仅驻场可选 */
export function filterTimeDifficultyOptionsByServiceMode(
  track: TimeLandscapeTrack,
  options: LandscapeAreaDifficultyOption[],
  serviceMode: "remote" | "onsite",
): LandscapeAreaDifficultyOption[] {
  if (serviceMode === "onsite" || track !== "hardscape") return options;
  return options.filter((o) => o.id !== "high");
}
