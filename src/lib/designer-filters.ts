import { useMemo, useState } from "react";
import { AREA_ROOTS } from "@/lib/administrative-area";
import { normalizeDesignerCode } from "@/lib/designer-code";
import type {
  Designer,
  DesignerLevel,
  OnlineMeetingTimeOption,
  Specialty,
  SubjectType,
  TeamSizeOption,
  TravelDurationOption,
  WorkloadStatus,
} from "@/lib/types";

export type TriState = "all" | "yes" | "no";
export type ServiceModeFilter = "all" | "online_only" | "online_onsite";

export interface DesignerFiltersState {
  keyword: string;
  specialty: Specialty | "all";
  subjectType: SubjectType | "all";
  level: DesignerLevel | "all";
  onlineOnly: boolean;
  workload: WorkloadStatus | "all";
  province: string;
  city: string;
  trackL2: string;
  trackL3: string;
  teamSize: TeamSizeOption | "all";
  projectType: string;
  inJob: TriState;
  handDrawing: TriState;
  travel: TriState;
  travelDuration: TravelDurationOption | "all";
  backToBack: TriState;
  overseas: TriState;
  overseasCountry: string;
  timeBilling: TriState;
  onsiteExp: TriState;
  meetingTime: OnlineMeetingTimeOption | "all";
  serviceMode: ServiceModeFilter;
}

export const DEFAULT_DESIGNER_FILTERS: DesignerFiltersState = {
  keyword: "",
  specialty: "all",
  subjectType: "all",
  level: "all",
  onlineOnly: false,
  workload: "all",
  province: "all",
  city: "all",
  trackL2: "all",
  trackL3: "all",
  teamSize: "all",
  projectType: "all",
  inJob: "all",
  handDrawing: "all",
  travel: "all",
  travelDuration: "all",
  backToBack: "all",
  overseas: "all",
  overseasCountry: "all",
  timeBilling: "all",
  onsiteExp: "all",
  meetingTime: "all",
  serviceMode: "all",
};

function designerTracks(d: Designer) {
  const tracks = [];
  if (d.primaryTrack) tracks.push(d.primaryTrack);
  if (d.secondaryTracks?.length) tracks.push(...d.secondaryTracks);
  return tracks;
}

function matchesTrackFilter(
  d: Designer,
  specialty: Specialty | "all",
  trackL2: string,
  trackL3: string,
) {
  const tracks = designerTracks(d);
  if (specialty !== "all") {
    const hasL1 =
      tracks.some((t) => t.l1 === specialty) || d.specialty === specialty;
    if (!hasL1) return false;
  }
  if (trackL2 !== "all" && !tracks.some((t) => t.l2 === trackL2)) return false;
  if (trackL3 !== "all" && !tracks.some((t) => t.l3 === trackL3)) return false;
  return true;
}

function tri(val: TriState, flag: boolean) {
  return val === "all" ? true : val === "yes" ? flag : !flag;
}

function designerCity(loc?: string) {
  return (loc ?? "").split(" ·")[0].trim();
}

function buildCityToProvince() {
  const map = new Map<string, string>();
  AREA_ROOTS.forEach((p) => {
    p.children.forEach((c) => {
      if (!map.has(c.text)) map.set(c.text, p.text);
    });
  });
  return map;
}

const CITY_TO_PROVINCE = buildCityToProvince();

/** 关键词：姓名、编号、标签、项目案例、项目类型 */
export function matchesDesignerKeyword(designer: Designer, keyword: string) {
  const q = keyword.trim();
  if (!q) return true;

  if (designer.name.includes(q)) return true;

  if (designer.code) {
    const code = designer.code.toUpperCase();
    const query = q.toUpperCase();
    if (code.includes(query)) return true;
    const norm = normalizeDesignerCode(query);
    if (norm && normalizeDesignerCode(code).includes(norm)) return true;
    const digits = query.replace(/\D/g, "");
    if (digits && code.replace(/\D/g, "").includes(digits)) return true;
  }

  if (designer.expertiseTags.some((t) => t.includes(q))) return true;
  if (designer.projectTypeTags.some((t) => t.includes(q))) return true;
  if (
    designer.portfolio?.some(
      (p) => p.title.includes(q) || p.category.includes(q),
    )
  ) {
    return true;
  }

  return false;
}

export function applyDesignerFilters(
  designers: Designer[],
  filters: DesignerFiltersState,
): Designer[] {
  const showInJob =
    filters.subjectType === "all" || filters.subjectType === "individual";
  const showTeamSize =
    filters.subjectType === "team" || filters.subjectType === "company";

  return designers
    .filter((d) => matchesDesignerKeyword(d, filters.keyword))
    .filter((d) =>
      matchesTrackFilter(d, filters.specialty, filters.trackL2, filters.trackL3),
    )
    .filter((d) =>
      filters.subjectType === "all"
        ? true
        : (d.subjectType ?? "individual") === filters.subjectType,
    )
    .filter((d) =>
      showTeamSize && filters.teamSize !== "all"
        ? d.teamSize === filters.teamSize
        : true,
    )
    .filter((d) =>
      filters.projectType !== "all"
        ? d.projectTypeTags.includes(filters.projectType)
        : true,
    )
    .filter((d) => (showInJob ? tri(filters.inJob, d.isInJob) : true))
    .filter((d) => tri(filters.handDrawing, d.supportsHandDrawing))
    .filter((d) => tri(filters.travel, d.isOpenToTravel))
    .filter((d) =>
      filters.travel === "yes" && filters.travelDuration !== "all"
        ? d.travelDuration === filters.travelDuration
        : true,
    )
    .filter((d) => tri(filters.backToBack, !!d.acceptBackToBackContract))
    .filter((d) => tri(filters.overseas, !!d.hasOverseasExperience))
    .filter((d) =>
      filters.overseas === "yes" && filters.overseasCountry !== "all"
        ? (d.overseasCountries ?? []).includes(filters.overseasCountry)
        : true,
    )
    .filter((d) => tri(filters.timeBilling, d.acceptTimeBilling !== false))
    .filter((d) => tri(filters.onsiteExp, !!d.hasOnsiteExperience))
    .filter((d) =>
      filters.meetingTime === "all"
        ? true
        : d.onlineMeetingTime === filters.meetingTime,
    )
    .filter((d) => {
      if (filters.serviceMode === "all") return true;
      const hasOnsite = d.serviceModes.includes("onsite");
      return filters.serviceMode === "online_onsite" ? hasOnsite : !hasOnsite;
    })
    .filter((d) => (filters.level === "all" ? true : d.level === filters.level))
    .filter((d) => (filters.onlineOnly ? d.onlineStatus === "online" : true))
    .filter((d) =>
      filters.workload === "all" ? true : d.workloadStatus === filters.workload,
    )
    .filter((d) => {
      if (filters.province === "all") return true;
      const c = designerCity(d.location);
      const p = CITY_TO_PROVINCE.get(c) ?? c;
      if (p !== filters.province) return false;
      if (filters.city !== "all" && c !== filters.city) return false;
      return true;
    });
}

export function useDesignerFilters(
  designers: Designer[],
  initial?: Partial<DesignerFiltersState>,
) {
  const [filters, setFilters] = useState<DesignerFiltersState>({
    ...DEFAULT_DESIGNER_FILTERS,
    ...initial,
  });

  const patchFilters = (partial: Partial<DesignerFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const resetFilters = () => setFilters(DEFAULT_DESIGNER_FILTERS);

  const filtered = useMemo(
    () => applyDesignerFilters(designers, filters),
    [designers, filters],
  );

  return { filters, patchFilters, setFilters, resetFilters, filtered };
}
