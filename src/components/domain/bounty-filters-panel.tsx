"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SPECIALTIES } from "@/lib/constants";
import { AREA_ROOTS, type AdministrativeTriple } from "@/lib/administrative-area";
import {
  getL2Options,
  getL3Options,
  type BountyListFilters,
} from "@/lib/bounty-filters";
import type { Specialty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function createDefaultBountyFilters(): BountyListFilters {
  return {
    l1: "all",
    l2: "all",
    l3: "all",
    designScope: "all",
    provinceCode: "all",
    cityCode: "all",
    locationMode: "province",
    status: "all",
  };
}

export function BountyFiltersPanel({
  filters,
  onChange,
  onReset,
  resultCount,
}: {
  filters: BountyListFilters;
  onChange: (next: BountyListFilters) => void;
  onReset: () => void;
  resultCount: number;
}) {
  const l2Options = useMemo(() => getL2Options(filters.l1), [filters.l1]);
  const l3Options = useMemo(
    () => getL3Options(filters.l1, filters.l2),
    [filters.l1, filters.l2],
  );

  const cityOptions = useMemo(() => {
    if (filters.provinceCode === "all") return [];
    const p = AREA_ROOTS.find((x) => x.value === filters.provinceCode);
    return p?.children ?? [];
  }, [filters.provinceCode]);

  const patch = (partial: Partial<BountyListFilters>) =>
    onChange({ ...filters, ...partial });

  const onL1 = (l1: Specialty | "all") => {
    onChange({
      ...filters,
      l1,
      l2: "all",
      l3: "all",
      designScope: "all",
    });
  };

  const onProvince = (provinceCode: string) => {
    if (provinceCode === "all") {
      patch({ provinceCode: "all", cityCode: "all" });
      return;
    }
    const p = AREA_ROOTS.find((x) => x.value === provinceCode);
    const firstCity = p?.children?.[0];
    patch({
      provinceCode,
      cityCode:
        filters.locationMode === "city" && firstCity ? firstCity.value : "all",
    });
  };

  return (
    <Card className="mb-6 space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4 text-brand" />
          筛选悬赏项目
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-60">
          <span>
            共 <strong className="text-ink">{resultCount}</strong> 条
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> 重置
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-ink-40">一级专业</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <FilterChip active={filters.l1 === "all"} onClick={() => onL1("all")}>
            全部
          </FilterChip>
          {SPECIALTIES.map((s) => (
            <FilterChip
              key={s.value}
              active={filters.l1 === s.value}
              onClick={() => onL1(s.value)}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filters.l1 !== "all" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs text-ink-40">二级专业</Label>
            <select
              className="mt-2 h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              value={filters.l2}
              onChange={(e) =>
                patch({ l2: e.target.value, l3: "all" })
              }
            >
              <option value="all">全部二级</option>
              {l2Options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-ink-40">三级专业</Label>
            <select
              className="mt-2 h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              value={filters.l3}
              disabled={filters.l2 === "all"}
              onChange={(e) => patch({ l3: e.target.value })}
            >
              <option value="all">全部三级</option>
              {l3Options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="border-t border-ink-20 pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Label className="flex items-center gap-1.5 text-xs text-ink-40">
            <MapPin className="h-3.5 w-3.5" /> 项目所在地
          </Label>
          <div className="flex rounded-full border border-ink-20 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                filters.locationMode === "province"
                  ? "bg-ink text-white"
                  : "text-ink-60",
              )}
              onClick={() =>
                patch({ locationMode: "province", cityCode: "all" })
              }
            >
              仅省份
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                filters.locationMode === "city"
                  ? "bg-ink text-white"
                  : "text-ink-60",
              )}
              onClick={() => patch({ locationMode: "city" })}
            >
              精确到城市
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-ink-40">省份</Label>
            <select
              className="mt-2 h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              value={filters.provinceCode}
              onChange={(e) => onProvince(e.target.value)}
            >
              <option value="all">全国 / 不限</option>
              {AREA_ROOTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.text}
                </option>
              ))}
            </select>
          </div>
          {filters.locationMode === "city" ? (
            <div>
              <Label className="text-xs text-ink-40">城市</Label>
              <select
                className="mt-2 h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm disabled:opacity-50"
                value={filters.cityCode}
                disabled={filters.provinceCode === "all"}
                onChange={(e) => patch({ cityCode: e.target.value })}
              >
                <option value="all">该省全部城市</option>
                {cityOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.text}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <Label className="text-xs text-ink-40">报名状态</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { value: "all", label: "全部状态" },
            { value: "open", label: "开放报名" },
            { value: "in_review", label: "审核中" },
          ].map((s) => (
            <FilterChip
              key={s.value}
              active={filters.status === s.value}
              onClick={() => patch({ status: s.value as BountyListFilters["status"] })}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-ink-20 text-ink-60 hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}

/** 从行政区划三元组生成悬赏存库字段 */
export function bountyLocationFromTriple(
  triple: AdministrativeTriple,
  mode: "province" | "city",
): import("@/lib/types").BountyLocation {
  const p = AREA_ROOTS.find((x) => x.value === triple.provinceCode);
  const cy = p?.children.find((x) => x.value === triple.cityCode);
  const provinceName = p?.text ?? "";
  const cityName = cy?.text;
  if (mode === "province" || !cityName) {
    return {
      provinceCode: triple.provinceCode,
      provinceName,
      label: provinceName,
    };
  }
  return {
    provinceCode: triple.provinceCode,
    provinceName,
    cityCode: triple.cityCode,
    cityName,
    label: `${provinceName} · ${cityName}`,
  };
}
