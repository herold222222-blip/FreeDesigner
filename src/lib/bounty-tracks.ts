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
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return l3;
  for (const l2 of root.l2) {
    const hit = l2.l3.find((x) => x.value === l3);
    if (hit) return hit.label;
  }
  return l3;
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

export function designerHasL3(designer: Designer, l3: string) {
  if (designer.primaryTrack?.l3 === l3) return true;
  return (designer.secondaryTracks ?? []).some((t) => t.l3 === l3);
}

export function designerEligibleL3s(designer: Designer, bountyL3s: string[]) {
  return bountyL3s.filter((l3) => designerHasL3(designer, l3));
}
