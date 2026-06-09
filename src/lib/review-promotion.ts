import type { DesignerLevel } from "@/lib/types";
import type { ReviewItem } from "@/lib/types";

/** 从晋升申请 payload 解析目标设计师等级 */
export function parsePromotionTargetLevel(
  label: string | undefined,
): DesignerLevel | null {
  if (!label) return null;
  const text = label.trim();
  if (/特级/.test(text)) return "specialist";
  if (/高级/.test(text)) return "senior_v1";
  if (/中级/.test(text)) return "mid_v1";
  return null;
}

export function isInternPromotionReview(item: ReviewItem) {
  return item.type === "designer_promotion";
}

export function isLevelPromotionReview(item: ReviewItem) {
  return item.type === "designer_level_promotion";
}

export function isPromotionReview(item: ReviewItem) {
  return isInternPromotionReview(item) || isLevelPromotionReview(item);
}

export function promotionApproveLabel(item: ReviewItem) {
  if (isInternPromotionReview(item)) return "确认晋升中级";
  const target = item.payload["申请晋升"];
  return target ? `确认晋升${target}` : "确认晋升";
}

export function promotionRejectLabel(item: ReviewItem) {
  return isInternPromotionReview(item) ? "暂不晋升" : "驳回申请";
}
