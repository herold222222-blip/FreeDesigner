import { SPECIALTY_TRACKS } from "@/lib/constants";
import {
  getL2Labels,
  getL3Labels,
  normalizeBountyTrack,
} from "@/lib/bounty-tracks";
import type {
  Bounty,
  BountyDesignScope,
  BountyTrack,
  Specialty,
} from "@/lib/types";

export type BountyDesignScopeFilter = "all" | BountyDesignScope;

export const BOUNTY_DESIGN_SCOPE_OPTIONS: {
  value: BountyDesignScopeFilter;
  label: string;
}[] = [
  { value: "all", label: "全部阶段" },
  { value: "scheme", label: "方案" },
  { value: "construction_doc", label: "施工图" },
  { value: "full_process", label: "全过程设计" },
];

const PHASE_SPECIALTIES = new Set<Specialty>([
  "architecture",
  "landscape",
  "interior",
]);

export function bountySupportsDesignScope(specialty: Specialty) {
  return PHASE_SPECIALTIES.has(specialty);
}

export function getTrackLabelParts(track: BountyTrack) {
  const normalized = normalizeBountyTrack(track);
  const l1 = SPECIALTY_TRACKS.find((t) => t.value === normalized.l1);
  return {
    l1: l1?.label ?? normalized.l1,
    l2: getL2Labels(normalized.l1, normalized.l2).join("、"),
    l3: getL3Labels(normalized.l1, normalized.l3).join("、"),
    l2List: getL2Labels(normalized.l1, normalized.l2),
    l3List: getL3Labels(normalized.l1, normalized.l3),
  };
}

export function getDesignScopeLabel(scope?: BountyDesignScope) {
  if (!scope) return "";
  return BOUNTY_DESIGN_SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? "";
}

export function matchesBountyDesignScope(
  bounty: Bounty,
  scope: BountyDesignScopeFilter,
) {
  if (scope === "all") return true;
  if (!bountySupportsDesignScope(bounty.specialty)) return true;
  if (scope === "full_process") return bounty.designScope === "full_process";
  if (bounty.designScope === "full_process") return false;
  const track = normalizeBountyTrack(bounty.primaryTrack);
  return bounty.designScope === scope || track.l2.includes(scope);
}

export interface BountyListFilters {
  l1: Specialty | "all";
  l2: string;
  l3: string;
  designScope: BountyDesignScopeFilter;
  provinceCode: string;
  cityCode: string;
  locationMode: "province" | "city";
  status: "all" | "open" | "in_review";
}

export function filterBounties(list: Bounty[], filters: BountyListFilters): Bounty[] {
  return list
    .filter((b) => (filters.l1 === "all" ? true : b.specialty === filters.l1))
    .filter((b) => {
      if (filters.l2 === "all") return true;
      const track = normalizeBountyTrack(b.primaryTrack);
      return track.l2.includes(filters.l2);
    })
    .filter((b) => {
      if (filters.l3 === "all") return true;
      const track = normalizeBountyTrack(b.primaryTrack);
      return track.l3.includes(filters.l3);
    })
    .filter((b) => matchesBountyDesignScope(b, filters.designScope))
    .filter((b) => {
      if (filters.provinceCode === "all") return true;
      if (b.location.provinceCode !== filters.provinceCode) return false;
      if (filters.locationMode === "province") return true;
      if (filters.cityCode === "all") return true;
      return b.location.cityCode === filters.cityCode;
    })
    .filter((b) =>
      filters.status === "all" ? true : b.status === filters.status,
    );
}

export function getL2Options(l1: Specialty | "all") {
  if (l1 === "all") return [];
  return SPECIALTY_TRACKS.find((t) => t.value === l1)?.l2 ?? [];
}

export function getL3Options(l1: Specialty | "all", l2: string) {
  if (l1 === "all" || l2 === "all") return [];
  const l2Node = getL2Options(l1).find((x) => x.value === l2);
  return l2Node?.l3 ?? [];
}
