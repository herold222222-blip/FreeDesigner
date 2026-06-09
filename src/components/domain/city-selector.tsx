"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { REGION_TIER_META, inferRegionTier } from "@/lib/constants";
import type { RegionTier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CityOption {
  city: string;
  tier: RegionTier;
}

const ALL_CITIES: CityOption[] = (() => {
  const list: CityOption[] = [];
  (Object.keys(REGION_TIER_META) as RegionTier[]).forEach((tier) => {
    REGION_TIER_META[tier].cities.forEach((city) => list.push({ city, tier }));
  });
  return list;
})();

/**
 * 城市选择器 —— 选定城市后自动对应 RegionTier。
 * 第六梯队为「其余县市」（不在前五梯队中），允许自由输入；
 * 自动调用 inferRegionTier 判定。
 */
export function CitySelector({
  value,
  onChange,
  placeholder = "选择或输入城市",
  className,
}: {
  /** 已选城市名（如「上海」/「成都」） */
  value: string;
  /** 受控变更，回调 (城市, 推断出的梯队) */
  onChange: (city: string, tier: RegionTier) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDownOutside(e: PointerEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    /* capture：避免与其它浮层争抢同一轮的 mousedown/click */
    document.addEventListener("pointerdown", onPointerDownOutside, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
  }, [open]);

  const groupedFiltered = useMemo(() => {
    const k = keyword.trim();
    return (Object.keys(REGION_TIER_META) as RegionTier[])
      .filter((t) => t !== "tier6")
      .map((tier) => ({
        tier,
        meta: REGION_TIER_META[tier],
        cities: REGION_TIER_META[tier].cities.filter((c) => (k ? c.includes(k) : true)),
      }))
      .filter((g) => g.cities.length > 0);
  }, [keyword]);

  const currentTier = value ? inferRegionTier(value) : null;

  const selectCity = (city: string) => {
    onChange(city, inferRegionTier(city));
    setOpen(false);
    setKeyword("");
  };

  return (
    <div ref={wrapRef} className={cn("relative z-[1]", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-ink-20 bg-white px-3 text-left text-sm hover:border-ink/40"
      >
        <div className="flex items-center gap-2 truncate">
          <MapPin className="h-4 w-4 shrink-0 text-ink-40" />
          <span className={cn("truncate", value ? "text-ink" : "text-ink-40")}>
            {value || placeholder}
          </span>
          {currentTier ? (
            <Badge variant="muted" className="shrink-0 text-[10px]">
              {REGION_TIER_META[currentTier].label} ·{" "}
              {Math.round(REGION_TIER_META[currentTier].coefficient * 100)}%
            </Badge>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-40 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-12 z-30 max-h-96 overflow-hidden rounded-xl border border-ink-20 bg-white shadow-xl">
          {/* 搜索 + 自由输入 */}
          <div className="border-b border-ink-20 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-40" />
              <Input
                placeholder="搜索或输入城市名（例如：上海 / 大理 / 县级市）"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="h-9 pl-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && keyword.trim()) {
                    selectCity(keyword.trim());
                  }
                }}
              />
            </div>
            {keyword.trim() &&
            !ALL_CITIES.some((c) => c.city === keyword.trim()) ? (
              <button
                type="button"
                onClick={() => selectCity(keyword.trim())}
                className="mt-2 flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-100"
              >
                <span>
                  使用 <span className="font-semibold">「{keyword.trim()}」</span> 作为城市
                </span>
                <Badge variant="amber" className="text-[10px]">
                  归入第六梯队 · 70%
                </Badge>
              </button>
            ) : null}
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {groupedFiltered.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-40">
                未找到匹配城市，可直接回车确认输入归入第六梯队。
              </div>
            ) : (
              groupedFiltered.map((g) => (
                <div key={g.tier} className="mb-2">
                  <div className="mb-1 flex items-center gap-2 px-2 text-[10px] uppercase tracking-wider text-ink-40">
                    <span>{g.meta.label}</span>
                    <span className="text-ink-60">
                      系数 {Math.round(g.meta.coefficient * 100)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.cities.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => selectCity(c)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                          value === c
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60 hover:border-ink/40 hover:text-ink",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
