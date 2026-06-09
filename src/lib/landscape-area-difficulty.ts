/**
 * 文档 3.1.1.2.6 · 景观按面积计费时的三级专业难度系数展示与取值。
 */

import type { LandscapeTrackDifficultyConfig } from "@/lib/platform-pricing";

export interface LandscapeAreaDifficultyOption {
  value: number;
  label: string;
  /** 文档备注原文 */
  remark: string;
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

/** 给排水仅有二档（文档无「高/中/低」四档） */
export const LANDSCAPE_DRAINAGE_DIFFICULTY: LandscapeAreaDifficultyOption[] = [
  { value: 1.0, label: "人工取水", remark: "人工取水（系数 100%）" },
  { value: 1.3, label: "自动喷灌", remark: "自动喷灌（系数 130%）" },
];

export type AreaLandscapeTrack = "hardscape" | "softscape" | "drainage" | "electrical";

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

export function getHardscapeScopeNote(cfg: LandscapeTrackDifficultyConfig = DEFAULT_DIFFICULTY) {
  return cfg.hardscapeScopeNote;
}

export type TimeLandscapeTrack =
  | "hardscape"
  | "softscape"
  | "drainage"
  | "electrical"
  | "structure";

/** 按时间报价：绿化/园建/给排水/电气与文档一致；「结构」在 3.1.1.2.6 未单列四档描述，沿用园建四档系数作参考计费。 */
export function landscapeTimeDifficultyUI(
  t: TimeLandscapeTrack,
  cfg: LandscapeTrackDifficultyConfig = DEFAULT_DIFFICULTY,
): LandscapeAreaDifficultyUIMode {
  switch (t) {
    case "hardscape":
      return { kind: "select", options: cfg.hardscape };
    case "softscape":
      return { kind: "select", options: cfg.softscape };
    case "drainage":
      return { kind: "select", options: cfg.drainage };
    case "electrical":
      return {
        kind: "fixed",
        value: cfg.electrical.coefficient,
        note: cfg.electrical.note,
      };
    default:
      return { kind: "select", options: cfg.hardscape };
  }
}
