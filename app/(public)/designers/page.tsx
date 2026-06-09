"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDesigners } from "@/lib/use-data";
import { DesignerCard } from "@/components/domain/designer-card";
import { DesignerFiltersPanel } from "@/components/domain/designer-filters-panel";
import { Card } from "@/components/ui/card";
import type { Specialty } from "@/lib/types";
import {
  DESIGNER_SORT_OPTIONS,
  type DesignerSortKey,
  sortDesigners,
  getSortReferenceLabel,
} from "@/lib/designer-list-utils";
import { useDesignerFilters } from "@/lib/designer-filters";
import { Search, ArrowUpDown } from "lucide-react";

export default function DesignersPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">
          加载设计师列表...
        </div>
      }
    >
      <DesignersInner />
    </Suspense>
  );
}

function DesignersInner() {
  const params = useSearchParams();
  const initialSpecialty = params.get("specialty") as Specialty | null;
  const { data: designers, loading } = useDesigners();

  const { filters, patchFilters, resetFilters, filtered: filteredBase } =
    useDesignerFilters(designers, {
      specialty: initialSpecialty ?? "all",
    });

  const [sortKey, setSortKey] = useState<DesignerSortKey>("comprehensive");

  const filtered = useMemo(
    () => sortDesigners(filteredBase, sortKey, filters.city),
    [filteredBase, sortKey, filters.city],
  );

  const sortHint = DESIGNER_SORT_OPTIONS.find((o) => o.value === sortKey)?.hint;
  const distanceRef = getSortReferenceLabel(filters.city);

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            找设计
          </h1>
          <p className="mt-2 text-sm text-ink-60">
            独立设计师 / 设计团队 / 设计公司一站对接，在线优先展示。点击卡片进入主页查看作品集与档期。
          </p>
        </div>
        <div className="text-sm text-ink-60">
          共 <span className="font-semibold text-ink">{filtered.length}</span> 位匹配
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <DesignerFiltersPanel
          filters={filters}
          onPatch={patchFilters}
          onReset={resetFilters}
        />

        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <ArrowUpDown className="h-4 w-4 text-ink-60" />
              智能排序
            </div>
            <div className="flex flex-wrap gap-2">
              {DESIGNER_SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSortKey(o.value)}
                  title={o.hint}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    sortKey === o.value
                      ? "border-brand bg-brand/10 font-medium text-brand"
                      : "border-ink-20 text-ink-60 hover:border-brand/40"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {sortHint ? (
              <p className="w-full text-[11px] text-ink-40">
                {sortHint}
                {sortKey === "distance" && ` · 参考城市：${distanceRef}`}
              </p>
            ) : null}
          </Card>

          {loading ? (
            <Card className="p-16 text-center text-ink-60">
              <Search className="mx-auto mb-3 h-8 w-8 animate-pulse text-ink-40" />
              正在加载设计师...
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-16 text-center text-ink-60">
              <Search className="mx-auto mb-3 h-8 w-8 text-ink-40" />
              没有匹配的设计师,请调整筛选条件。
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => (
                <DesignerCard key={d.id} designer={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
