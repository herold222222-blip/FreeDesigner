import type { PortfolioItem } from "@/lib/types";

/** 兼容旧数据：仅有 cover 时补齐 images */
export function normalizePortfolioItem(item: PortfolioItem): PortfolioItem {
  const images =
    item.images && item.images.length > 0
      ? [...item.images]
      : item.cover
        ? [item.cover]
        : [];
  const cover =
    item.cover && images.includes(item.cover) ? item.cover : (images[0] ?? "");
  return { ...item, images, cover };
}

export function portfolioCoverUrl(item: PortfolioItem): string {
  return normalizePortfolioItem(item).cover;
}
