"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { normalizePortfolioItem } from "@/lib/portfolio-images";
import type { PortfolioItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PortfolioImageLightbox({
  item,
  open,
  onOpenChange,
  initialIndex = 0,
}: {
  item: PortfolioItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}) {
  const normalized = item ? normalizePortfolioItem(item) : null;
  const images = normalized?.images ?? [];
  const count = images.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open || count <= 0) return;
    setIndex(Math.min(Math.max(0, initialIndex), count - 1));
  }, [open, initialIndex, count, item?.id]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  if (!normalized || count === 0) return null;

  const current = images[Math.min(index, count - 1)];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] w-[min(960px,94vw)] max-w-none gap-0 overflow-hidden border-0 bg-ink p-0 text-white shadow-2xl",
          "[&>button]:right-3 [&>button]:top-3 [&>button]:text-white/70 [&>button]:hover:bg-white/10 [&>button]:hover:text-white",
        )}
      >
        <DialogTitle className="sr-only">{normalized.title}</DialogTitle>
        <DialogDescription className="sr-only">
          作品图片预览，可用左右方向键切换
        </DialogDescription>

        <div className="relative flex min-h-[50vh] items-center justify-center bg-black px-12 py-10 sm:min-h-[70vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={`${normalized.title} · 图 ${index + 1}`}
            className="max-h-[72vh] max-w-full object-contain"
          />

          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:left-3"
                aria-label="上一张"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:right-3"
                aria-label="下一张"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/10 bg-ink px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {normalized.title}
            </div>
            <div className="mt-0.5 text-xs text-white/60">
              {normalized.year}
              {normalized.landscapeAreaSqm
                ? ` · ${normalized.landscapeAreaSqm.toLocaleString()}㎡`
                : ""}
              {normalized.owner ? ` · ${normalized.owner}` : ""}
            </div>
          </div>
          <Badge className="bg-white/15 text-[11px] text-white hover:bg-white/15">
            {index + 1} / {count}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
