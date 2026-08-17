import { SPECIALTY_TRACKS } from "@/lib/constants";
import type { BountyTrack, Designer, Specialty } from "@/lib/types";

/** 兼容旧版单值 l2/l3 存库格式 */
export function normalizeBountyTrack(
  track: BountyTrack | { l1: Specialty; l2: string | string[]; l3: string | string[] },
): BountyTrack {
  return {
    l1: track.l1,
    l2: Array.isArray(track.l2) ? track.l2 : track.l2 ? [track.l2] : [],
    l3: Array.isArray(track.l3) ? track.l3 : track.l3 ? [track.l3] : [],
  };
}

export function getL2Label(l1: Specialty, l2: string) {
  return SPECIALTY_TRACKS.find((t) => t.value === l1)?.l2.find((x) => x.value === l2)?.label ?? l2;
}

export function getL3Label(l1: Specialty, l3: string) {
  const legacy: Record<string, string> = {
    ls_garden_struct: "景观园建专业（含简单结构）",
    ls_drainage_irrigation: "景观给排水 + 自动喷灌",
  };
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return legacy[l3] ?? l3;
  for (const l2 of root.l2) {
    const hit = l2.l3.find((x) => x.value === l3);
    if (hit) return hit.label;
  }
  return legacy[l3] ?? l3;
}

export function getL2Labels(l1: Specialty, values: string[]) {
  return values.map((v) => getL2Label(l1, v));
}

export function getL3Labels(l1: Specialty, values: string[]) {
  return values.map((v) => getL3Label(l1, v));
}

export function getL3OptionsForL2s(
  l1: Specialty,
  l2Values: string[],
): { value: string; label: string; group?: string }[] {
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return [];
  const seen = new Set<string>();
  const out: { value: string; label: string; group?: string }[] = [];
  for (const l2 of l2Values) {
    const l2Node = root.l2.find((x) => x.value === l2);
    if (!l2Node) continue;
    for (const l3 of l2Node.l3) {
      if (seen.has(l3.value)) continue;
      seen.add(l3.value);
      out.push({ value: l3.value, label: l3.label, group: l2Node.label });
    }
  }
  return out;
}

export function pruneL3ForL2s(l1: Specialty, l2Values: string[], l3Values: string[]) {
  const allowed = new Set(getL3OptionsForL2s(l1, l2Values).map((o) => o.value));
  return l3Values.filter((v) => allowed.has(v));
}

/**
 * 景观二级专业互斥：施工图已包含扩初，不可同时勾选。
 * 若同时出现，保留本次新勾选的一项。
 */
export function reconcileLandscapeL2Selection(
  prev: string[],
  next: string[],
): string[] {
  const hasPre = next.includes("preliminary");
  const hasCd = next.includes("construction_doc");
  if (!hasPre || !hasCd) return next;

  const addedPre = !prev.includes("preliminary") && hasPre;
  const addedCd = !prev.includes("construction_doc") && hasCd;
  if (addedCd) return next.filter((v) => v !== "preliminary");
  if (addedPre) return next.filter((v) => v !== "construction_doc");
  // 无新增时默认保留施工图
  return next.filter((v) => v !== "preliminary");
}

/** 景观三级专业互斥对：园建 / 园建含结构；给排水 / 给排水+喷灌 */
const LANDSCAPE_L3_EXCLUSIVE_PAIRS: Array<[string, string]> = [
  ["ls_garden", "ls_garden_struct"],
  ["ls_drainage", "ls_drainage_irrigation"],
];

/**
 * 景观三级专业互斥。若某对同时出现，保留本次新勾选的一项。
 */
export function reconcileLandscapeL3Selection(
  prev: string[],
  next: string[],
): string[] {
  let resolved = next;
  for (const [a, b] of LANDSCAPE_L3_EXCLUSIVE_PAIRS) {
    const hasA = resolved.includes(a);
    const hasB = resolved.includes(b);
    if (!hasA || !hasB) continue;
    const addedA = !prev.includes(a) && hasA;
    const addedB = !prev.includes(b) && hasB;
    if (addedB) resolved = resolved.filter((v) => v !== a);
    else if (addedA) resolved = resolved.filter((v) => v !== b);
    else resolved = resolved.filter((v) => v !== b);
  }
  return resolved;
}

export function landscapeL3SelectionConflict(
  prev: string[],
  next: string[],
): string | null {
  for (const [a, b] of LANDSCAPE_L3_EXCLUSIVE_PAIRS) {
    if (next.includes(a) && next.includes(b)) {
      if (a === "ls_garden") {
        return "「景观园建专业」与「景观园建专业（含简单结构）」不可同时选择，请二选一。";
      }
      return "「景观给排水专业」与「景观给排水 + 自动喷灌」不可同时选择，请二选一。";
    }
  }
  void prev;
  return null;
}

export function designerHasL3(designer: Designer, l3: string) {
  if (designer.primaryTrack?.l3 === l3) return true;
  return (designer.secondaryTracks ?? []).some((t) => t.l3 === l3);
}

export function designerEligibleL3s(designer: Designer, bountyL3s: string[]) {
  return bountyL3s.filter((l3) => designerHasL3(designer, l3));
}
