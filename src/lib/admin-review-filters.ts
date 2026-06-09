import { SPECIALTIES } from "@/lib/constants";
import type { ReviewItem } from "@/lib/types";
import type { Specialty } from "@/lib/types";

export type ReviewSpecialtyFilter = Specialty | "all";

export function getReviewItemSpecialty(item: ReviewItem): Specialty | null {
  const profession = item.payload["专业"];
  if (!profession) return null;
  for (const specialty of SPECIALTIES) {
    if (profession.startsWith(specialty.label)) {
      return specialty.value;
    }
  }
  return null;
}

export function matchesReviewSearch(item: ReviewItem, query: string): boolean {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  const haystack = [item.name, ...Object.values(item.payload)]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
}

export function filterReviewItems(
  items: ReviewItem[],
  query: string,
  specialtyFilter: ReviewSpecialtyFilter,
): ReviewItem[] {
  return items.filter((item) => {
    if (!matchesReviewSearch(item, query)) return false;
    if (specialtyFilter === "all") return true;
    return getReviewItemSpecialty(item) === specialtyFilter;
  });
}

export function countReviewItemsBySpecialty(
  items: ReviewItem[],
): Record<Specialty, number> {
  const counts = Object.fromEntries(
    SPECIALTIES.map((s) => [s.value, 0]),
  ) as Record<Specialty, number>;
  for (const item of items) {
    const specialty = getReviewItemSpecialty(item);
    if (specialty) counts[specialty] += 1;
  }
  return counts;
}
