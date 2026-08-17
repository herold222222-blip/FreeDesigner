import type { DesignerProjectReview } from "@/lib/types";

/** 项目名：保留首字和末两字，中间用 * 代替 */
export function maskAnonymousProjectTitle(title: string): string {
  const chars = Array.from(title.trim());
  if (chars.length <= 1) return chars.join("") || title;
  if (chars.length === 2) return `${chars[0]}*`;
  if (chars.length === 3) return `${chars[0]}*${chars[2]}`;
  return `${chars[0]}${"*".repeat(chars.length - 3)}${chars.slice(-2).join("")}`;
}

/** 委托人名称：仅保留首字，其余用 * 代替 */
export function maskAnonymousClientName(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return name;
  if (chars.length === 1) return chars[0]!;
  return `${chars[0]}${"*".repeat(chars.length - 1)}`;
}

export function toPublicDesignerReview(
  review: DesignerProjectReview,
): DesignerProjectReview {
  if (!review.anonymous) return review;
  return {
    ...review,
    projectTitle: maskAnonymousProjectTitle(review.projectTitle),
    clientDisplayName: maskAnonymousClientName(review.clientDisplayName),
  };
}
