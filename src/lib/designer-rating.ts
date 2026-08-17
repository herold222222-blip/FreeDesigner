import type {
  Designer,
  DesignerProjectReview,
  ImpressionTag,
  RatingBreakdown,
} from "@/lib/types";

export function roundDesignerRating(value: number) {
  return Math.round(value * 10) / 10;
}

function finiteScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function reviewOverall(review: DesignerProjectReview): number {
  const overall = finiteScore(review.overall);
  if (overall != null) return overall;
  const breakdown = review.breakdown;
  const parts = [
    finiteScore(breakdown?.professional),
    finiteScore(breakdown?.service),
    finiteScore(breakdown?.responsiveness),
  ].filter((n): n is number => n != null);
  if (!parts.length) return 0;
  return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}

export function designerHasReviews(reviewCount?: number | null) {
  return (reviewCount ?? 0) > 0;
}

export function formatDesignerRating(rating: number) {
  return roundDesignerRating(rating).toFixed(1);
}

export function formatDesignerRatingDisplay(
  rating: number,
  reviewCount?: number | null,
  empty = "暂无",
) {
  return designerHasReviews(reviewCount)
    ? formatDesignerRating(rating)
    : empty;
}

export function aggregateDesignerReviewStats(
  reviews: DesignerProjectReview[] | null | undefined,
): {
  rating: number;
  reviewCount: number;
  ratingBreakdown?: RatingBreakdown;
  impressions: ImpressionTag[];
} {
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.length === 0) {
    return { rating: 0, reviewCount: 0, impressions: [] };
  }

  const count = list.length;
  const sumOverall = list.reduce((sum, r) => sum + reviewOverall(r), 0);
  const sumBreakdown = list.reduce(
    (acc, r) => {
      const b = r.breakdown;
      const fallback = reviewOverall(r);
      acc.professional += finiteScore(b?.professional) ?? fallback;
      acc.service += finiteScore(b?.service) ?? fallback;
      acc.responsiveness += finiteScore(b?.responsiveness) ?? fallback;
      return acc;
    },
    { professional: 0, service: 0, responsiveness: 0 },
  );

  const impressionMap = new Map<string, ImpressionTag>();
  for (const review of list) {
    for (const label of review.impressionTags ?? []) {
      const key = label.trim();
      if (!key) continue;
      const prev = impressionMap.get(key);
      if (prev) prev.count += 1;
      else impressionMap.set(key, { id: key, label: key, count: 1 });
    }
  }

  return {
    rating: roundDesignerRating(sumOverall / count),
    reviewCount: count,
    ratingBreakdown: {
      professional: roundDesignerRating(sumBreakdown.professional / count),
      service: roundDesignerRating(sumBreakdown.service / count),
      responsiveness: roundDesignerRating(sumBreakdown.responsiveness / count),
    },
    impressions: [...impressionMap.values()].sort((a, b) => b.count - a.count),
  };
}

export function applyReviewStatsToDesigner(
  designer: Designer,
  reviews: DesignerProjectReview[],
): Designer {
  const stats = aggregateDesignerReviewStats(reviews);
  return {
    ...designer,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    ratingBreakdown: stats.ratingBreakdown,
    impressions: stats.impressions.length
      ? stats.impressions
      : designer.impressions,
  };
}

