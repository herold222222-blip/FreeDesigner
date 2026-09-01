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
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-ink-20 bg-white px-2.5 text-xs text-ink disabled:opacity-50";

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
    <Card className="mb-6 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2 sm:gap-2.5">
        <ToolbarField label="专业" className="w-[7.5rem] sm:w-36">
          <select
            className={selectClass}
            value={filters.l1}
            onChange={(e) => onL1(e.target.value as Specialty | "all")}
          >
            <option value="all">全部专业</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </ToolbarField>

        {filters.l1 !== "all" ? (
          <>
            <ToolbarField label="二级" className="w-[7.5rem] sm:w-36">
              <select
                className={selectClass}
                value={filters.l2}
                onChange={(e) => patch({ l2: e.target.value, l3: "all" })}
              >
                <option value="all">全部二级</option>
                {l2Options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </ToolbarField>
            <ToolbarField label="三级" className="w-[7.5rem] sm:w-36">
              <select
                className={selectClass}
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
            </ToolbarField>
          </>
        ) : null}

        <ToolbarField label="所在地" className="w-auto">
          <div className="flex h-9 items-center rounded-lg border border-ink-20 p-0.5 text-[11px]">
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                filters.locationMode === "province"
                  ? "bg-ink text-white"
                  : "text-ink-60 hover:text-ink",
              )}
              onClick={() =>
                patch({ locationMode: "province", cityCode: "all" })
              }
            >
              省份
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                filters.locationMode === "city"
                  ? "bg-ink text-white"
                  : "text-ink-60 hover:text-ink",
              )}
              onClick={() => patch({ locationMode: "city" })}
            >
              城市
            </button>
          </div>
        </ToolbarField>

        <ToolbarField label="省份" className="min-w-[8rem] flex-1 sm:max-w-[11rem]">
          <select
            className={selectClass}
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
        </ToolbarField>

        {filters.locationMode === "city" ? (
          <ToolbarField label="城市" className="min-w-[8rem] flex-1 sm:max-w-[11rem]">
            <select
              className={selectClass}
              value={filters.cityCode}
              disabled={filters.provinceCode === "all"}
              onChange={(e) => patch({ cityCode: e.target.value })}
            >
              <option value="all">该省全部</option>
              {cityOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.text}
                </option>
              ))}
            </select>
          </ToolbarField>
        ) : null}

        <ToolbarField label="状态" className="w-[7rem] sm:w-32">
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) =>
              patch({ status: e.target.value as BountyListFilters["status"] })
            }
          >
            <option value="all">全部状态</option>
            <option value="open">开放报名</option>
            <option value="in_review">审核中</option>
            <option value="awarded">已选定设计师</option>
          </select>
        </ToolbarField>

        <div className="ml-auto flex h-9 items-center gap-2 pb-0.5">
          <span className="whitespace-nowrap text-xs text-ink-60">
            共 <strong className="text-ink">{resultCount}</strong> 条
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> 重置
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ToolbarField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[10px] font-medium text-ink-40">{label}</Label>
      {children}
    </div>
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
