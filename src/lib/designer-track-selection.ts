import { SPECIALTIES } from "@/lib/constants";
import { getL2Options, getL3Options } from "@/lib/bounty-filters";
import type { Specialty } from "@/lib/types";

export type DesignerTrackTriple = { l1: Specialty; l2: string; l3: string };

const L2_SEP = "::";
const L3_SEP = ":::";

export function trackL2Key(l1: Specialty, l2: string) {
  return `${l1}${L2_SEP}${l2}`;
}

export function trackL3Key(l1: Specialty, l2: string, l3: string) {
  return `${l1}${L3_SEP}${l2}${L3_SEP}${l3}`;
}

export function parseL2Key(key: string): { l1: Specialty; l2: string } | null {
  const idx = key.indexOf(L2_SEP);
  if (idx < 0) return null;
  const l1 = key.slice(0, idx) as Specialty;
  const l2 = key.slice(idx + L2_SEP.length);
  if (!l2) return null;
  return { l1, l2 };
}

export function parseL3Key(key: string): DesignerTrackTriple | null {
  const parts = key.split(L3_SEP);
  if (parts.length !== 3) return null;
  const [l1, l2, l3] = parts;
  if (!l1 || !l2 || !l3) return null;
  return { l1: l1 as Specialty, l2, l3 };
}

function l1Label(l1: Specialty) {
  return SPECIALTIES.find((s) => s.value === l1)?.label ?? l1;
}

function l2Label(l1: Specialty, l2: string) {
  return getL2Options(l1).find((x) => x.value === l2)?.label ?? l2;
}

export type OrgL2Option = {
  key: string;
  l1: Specialty;
  l2: string;
  label: string;
};

export type OrgL3Option = {
  key: string;
  l1: Specialty;
  l2: string;
  l3: string;
  label: string;
  description?: string;
};

export function orgL2OptionGroups(l1s: Specialty[]) {
  return l1s.map((l1) => ({
    l1,
    groupLabel: l1Label(l1),
    options: getL2Options(l1).map((l2) => ({
      key: trackL2Key(l1, l2.value),
      l1,
      l2: l2.value,
      label: l2.label,
    })),
  }));
}

export function orgL3OptionGroups(l2Keys: string[]) {
  return l2Keys
    .map((l2Key) => {
      const parsed = parseL2Key(l2Key);
      if (!parsed) return null;
      return {
        l2Key,
        groupLabel: `${l1Label(parsed.l1)} · ${l2Label(parsed.l1, parsed.l2)}`,
        options: getL3Options(parsed.l1, parsed.l2).map((l3) => ({
          key: trackL3Key(parsed.l1, parsed.l2, l3.value),
          l1: parsed.l1,
          l2: parsed.l2,
          l3: l3.value,
          label: l3.label,
          description: l3.description,
        })),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}

/** @deprecated 使用 orgL2OptionGroups 分组展示 */
export function orgL2OptionList(l1s: Specialty[]) {
  return orgL2OptionGroups(l1s).flatMap((g) => g.options);
}

/** @deprecated 使用 orgL3OptionGroups 分组展示 */
export function orgL3OptionList(l2Keys: string[]) {
  return orgL3OptionGroups(l2Keys).flatMap((g) => g.options);
}

export function orgTracksFromL3Keys(l3Keys: string[]): DesignerTrackTriple[] {
  return l3Keys
    .map(parseL3Key)
    .filter((t): t is DesignerTrackTriple => t !== null);
}

export function pruneOrgL2Keys(l2Keys: string[], l1s: Specialty[]) {
  const allowed = new Set(l1s);
  return l2Keys.filter((k) => {
    const p = parseL2Key(k);
    return p && allowed.has(p.l1);
  });
}

export function pruneOrgL3Keys(l3Keys: string[], l2Keys: string[]) {
  const allowedL2 = new Set(l2Keys);
  return l3Keys.filter((k) => {
    const p = parseL3Key(k);
    return p && allowedL2.has(trackL2Key(p.l1, p.l2));
  });
}
