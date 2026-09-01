import { SPECIALTIES, SPECIALTY_TRACKS } from "@/lib/constants";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import type { Bounty, BountyTitleVisibility } from "@/lib/types";

export function parseBountyTitleVisibility(
  input: unknown,
): BountyTitleVisibility {
  return input === "public" ? "public" : "masked";
}

/** 未设置时按脱敏处理，避免旧数据意外公开项目名 */
export function isBountyTitlePublic(
  bounty: Pick<Bounty, "titleVisibility">,
): boolean {
  return bounty.titleVisibility === "public";
}

/** 大厅第一组：仍在报名 / 审核 / 暂停 */
export function isBountyHallOpenGroup(bounty: Pick<Bounty, "status" | "awardedDesignerId">) {
  if (bounty.awardedDesignerId) return false;
  return (
    bounty.status === "open" ||
    bounty.status === "in_review" ||
    bounty.status === "paused"
  );
}

/** 大厅第二组：已选定设计师（或已结案），灰色且不可报名 */
export function isBountyHallAwardedGroup(
  bounty: Pick<Bounty, "status" | "awardedDesignerId">,
) {
  return !isBountyHallOpenGroup(bounty);
}

function normalizePhrase(raw: string): string {
  return raw
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/专业$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function collectSpecialtyPhrases(): string[] {
  const set = new Set<string>();
  const add = (raw: string) => {
    const n = normalizePhrase(raw);
    if (n.length >= 2) set.add(n);
  };
  for (const s of SPECIALTIES) add(s.label);
  for (const l1 of SPECIALTY_TRACKS) {
    add(l1.label);
    for (const l2 of l1.l2) {
      add(l2.label);
      for (const l3 of l2.l3) add(l3.label);
    }
  }
  for (const extra of [
    "景观园建",
    "景观绿化",
    "景观给排水",
    "景观电气",
    "景观结构",
    "园建",
    "绿化",
    "给排水",
    "电气",
    "结构",
    "施工图设计",
    "施工图",
    "扩初设计",
    "扩初",
    "方案设计",
    "全过程设计",
    "景观",
    "建筑",
    "室内",
    "效果图",
    "造价",
  ]) {
    add(extra);
  }
  return [...set].sort((a, b) => b.length - a.length);
}

const SPECIALTY_PHRASES = collectSpecialtyPhrases();

function extraPhrasesFromBounty(bounty?: Pick<Bounty, "primaryTrack">): string[] {
  if (!bounty?.primaryTrack) return [];
  const parts = getTrackLabelParts(bounty.primaryTrack);
  return [parts.l1, ...parts.l2List, ...parts.l3List]
    .map(normalizePhrase)
    .filter((p) => p.length >= 2);
}

/**
 * 项目名称只保留首字，以及后面关于专业的内容。
 * 例：「广州御龙湾府景观园建施工图设计」→「广*****景观园建施工图设计」
 */
export function maskBountyHallTitle(
  title: string,
  bounty?: Pick<Bounty, "primaryTrack">,
): string {
  const chars = Array.from(title.trim());
  if (chars.length <= 1) return chars.join("");
  const phrases = [...extraPhrasesFromBounty(bounty), ...SPECIALTY_PHRASES].sort(
    (a, b) => b.length - a.length,
  );
  const full = chars.join("");
  let specialtyAt = -1;
  for (let i = 0; i < full.length; i++) {
    const slice = full.slice(i);
    if (phrases.some((p) => slice.startsWith(p))) {
      specialtyAt = i;
      break;
    }
  }
  if (specialtyAt <= 0) {
    if (specialtyAt === 0) return full;
    return chars[0] + "*".repeat(chars.length - 1);
  }
  const hiddenLen = specialtyAt - 1;
  return chars[0] + "*".repeat(hiddenLen) + full.slice(specialtyAt);
}

/** 发布方 / 联系人：只留第一个字，其余 * */
export function maskPersonName(name: string): string {
  const chars = Array.from(name.trim());
  if (!chars.length) return "*";
  if (chars.length === 1) return chars[0];
  return chars[0] + "*".repeat(chars.length - 1);
}

export function maskBountyHallDescription(description: string): string {
  return description
    .split("\n")
    .map((line) => {
      const nameLine = line.match(/^(\s*(?:联系人|委托方)[：:])(.*)$/);
      if (nameLine) {
        return `${nameLine[1]}${maskPersonName(nameLine[2] ?? "")}`;
      }
      const phone = line.match(/^(\s*电话[：:])(.*)$/);
      if (phone) {
        const value = phone[2] ?? "";
        const digits = value.replace(/\D/g, "");
        const starCount = Math.max(
          digits.length || Array.from(value.trim()).length,
          11,
        );
        return `${phone[1]}${"*".repeat(starCount)}`;
      }
      return line;
    })
    .join("\n");
}

export function splitBountiesForHall<T extends Pick<Bounty, "status" | "awardedDesignerId">>(
  list: T[],
): { open: T[]; awarded: T[] } {
  const open: T[] = [];
  const awarded: T[] = [];
  for (const item of list) {
    if (isBountyHallOpenGroup(item)) open.push(item);
    else awarded.push(item);
  }
  return { open, awarded };
}
