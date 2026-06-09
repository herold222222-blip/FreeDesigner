import type { ActivityIndicator, Designer } from "./types";

/** 方案 / 施工图阶段筛选 */
export type DesignPhaseFilter = "all" | "scheme" | "construction_doc";

export type DesignerSortKey = "comprehensive" | "activity" | "rating" | "distance";

export const DESIGN_PHASE_FILTER_OPTIONS: {
  value: DesignPhaseFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "scheme", label: "方案" },
  { value: "construction_doc", label: "施工图" },
];

export const DESIGNER_SORT_OPTIONS: {
  value: DesignerSortKey;
  label: string;
  hint?: string;
}[] = [
  { value: "comprehensive", label: "综合推荐", hint: "综合评分、活跃、距离等" },
  { value: "activity", label: "活跃度", hint: "最近登录与在线状态" },
  { value: "rating", label: "评分", hint: "委托人评价从高到低" },
  { value: "distance", label: "距离优先", hint: "距参考城市从近到远" },
];

const SCHEME_SUB_SPECIALTIES = new Set(["concept"]);

const CONSTRUCTION_SUB_SPECIALTIES = new Set([
  "construction_doc",
  "garden_construction",
  "greening",
  "drainage",
  "electrical",
]);

const CITY_GEO: Record<string, { lat: number; lng: number }> = {
  上海市: { lat: 31.2304, lng: 121.4737 },
  杭州市: { lat: 30.2741, lng: 120.1551 },
  北京市: { lat: 39.9042, lng: 116.4074 },
  广州市: { lat: 23.1291, lng: 113.2644 },
  深圳市: { lat: 22.5431, lng: 114.0579 },
  成都市: { lat: 30.5728, lng: 104.0668 },
  南京市: { lat: 32.0603, lng: 118.7969 },
  厦门市: { lat: 24.4798, lng: 118.0894 },
};

const DEFAULT_REFERENCE_CITY = "上海市";

export function getDesignerCity(designer: Designer): string {
  return designer.location.split(" ·")[0].trim();
}

function trackMatchesPhase(
  designer: Designer,
  phase: "scheme" | "construction_doc",
): boolean {
  const tracks = [
    designer.primaryTrack,
    ...(designer.secondaryTracks ?? []),
  ].filter(Boolean);
  return tracks.some((t) => t!.l2 === phase);
}

/** 设计师是否匹配方案 / 施工图筛选 */
export function matchesDesignPhase(
  designer: Designer,
  phase: DesignPhaseFilter,
): boolean {
  if (phase === "all") return true;

  const subs = designer.subSpecialties;
  const tagText = [
    ...designer.expertiseTags,
    ...designer.projectTypeTags,
    designer.tagline,
    designer.bio,
  ].join(" ");

  if (phase === "scheme") {
    return (
      subs.some((s) => SCHEME_SUB_SPECIALTIES.has(s)) ||
      trackMatchesPhase(designer, "scheme") ||
      /方案/.test(tagText)
    );
  }

  return (
    subs.some((s) => CONSTRUCTION_SUB_SPECIALTIES.has(s)) ||
    trackMatchesPhase(designer, "construction_doc") ||
    /施工图/.test(tagText)
  );
}

function activityRank(indicator: ActivityIndicator): number {
  if (indicator === "green") return 3;
  if (indicator === "yellow") return 2;
  return 1;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getDistanceKm(designer: Designer, referenceCity: string): number {
  const from = CITY_GEO[referenceCity] ?? CITY_GEO[DEFAULT_REFERENCE_CITY];
  const toCity = getDesignerCity(designer);
  const to = CITY_GEO[toCity];
  if (!to) return 9999;
  return Math.round(haversineKm(from, to));
}

function workloadRank(status: Designer["workloadStatus"]): number {
  if (status === "free") return 3;
  if (status === "normal") return 2;
  return 1;
}

function comprehensiveScore(designer: Designer, referenceCity: string): number {
  const activity = activityRank(designer.activityIndicator) * 25;
  const rating = designer.rating * 20;
  const online = designer.onlineStatus === "online" ? 15 : 0;
  const workload = workloadRank(designer.workloadStatus) * 5;
  const experience = Math.min(designer.completedProjects / 4, 20);
  const dist = getDistanceKm(designer, referenceCity);
  const distance = Math.max(0, 100 - dist * 0.8);
  const responsive =
    (designer.ratingBreakdown?.responsiveness ?? designer.rating) * 10;

  return (
    activity * 0.22 +
    rating * 0.28 +
    distance * 0.2 +
    online * 0.12 +
    workload * 0.05 +
    experience * 0.08 +
    responsive * 0.05
  );
}

export function sortDesigners(
  list: Designer[],
  sortKey: DesignerSortKey,
  referenceCity: string = DEFAULT_REFERENCE_CITY,
): Designer[] {
  const ref = referenceCity === "all" ? DEFAULT_REFERENCE_CITY : referenceCity;
  const sorted = [...list];

  switch (sortKey) {
    case "rating":
      sorted.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviewCount - a.reviewCount;
      });
      break;
    case "activity":
      sorted.sort((a, b) => {
        const act = activityRank(b.activityIndicator) - activityRank(a.activityIndicator);
        if (act !== 0) return act;
        const time =
          new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
        if (time !== 0) return time;
        return a.onlineStatus === "online" ? -1 : 1;
      });
      break;
    case "distance":
      sorted.sort(
        (a, b) => getDistanceKm(a, ref) - getDistanceKm(b, ref),
      );
      break;
    case "comprehensive":
    default:
      sorted.sort(
        (a, b) => comprehensiveScore(b, ref) - comprehensiveScore(a, ref),
      );
      break;
  }

  return sorted;
}

export function getSortReferenceLabel(referenceCity: string): string {
  return referenceCity === "all" ? DEFAULT_REFERENCE_CITY : referenceCity;
}
