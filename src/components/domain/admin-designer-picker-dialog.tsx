"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DesignerFiltersPanel } from "@/components/domain/designer-filters-panel";
import { SpecialtyBadge, WorkloadBadge } from "@/components/domain/status-badges";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { SPECIALTIES } from "@/lib/constants";
import {
  applyDesignerFilters,
  DEFAULT_DESIGNER_FILTERS,
  type DesignerFiltersState,
} from "@/lib/designer-filters";
import {
  designerCanAcceptOrders,
  designerCoversProjectType,
} from "@/lib/designer-portfolio-readiness";
import type { Designer, Order, Specialty } from "@/lib/types";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminDesignerPickerDialog({
  open,
  onOpenChange,
  order,
  designers,
  selectedId,
  onSelect,
  preferL2,
  preferL3,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  designers: Designer[];
  selectedId?: string;
  onSelect: (designer: Designer) => void;
  preferL2?: string;
  preferL3?: string;
  title?: string;
}) {
  const defaultSpecialty =
    (order.specialty as Specialty | undefined) ?? "landscape";

  const [filters, setFilters] = useState<DesignerFiltersState>({
    ...DEFAULT_DESIGNER_FILTERS,
    specialty: defaultSpecialty,
    projectType: order.projectType?.trim() || "all",
    trackL2: preferL2 || "all",
    trackL3: preferL3 || "all",
  });
  const [pickedId, setPickedId] = useState(selectedId ?? "");

  useEffect(() => {
    if (!open) return;
    setPickedId(selectedId ?? "");
    setFilters({
      ...DEFAULT_DESIGNER_FILTERS,
      specialty: defaultSpecialty,
      projectType: order.projectType?.trim() || "all",
      trackL2: preferL2 || "all",
      trackL3: preferL3 || "all",
    });
  }, [
    open,
    selectedId,
    defaultSpecialty,
    order.projectType,
    preferL2,
    preferL3,
  ]);

  const eligible = useMemo(
    () =>
      designers.filter(
        (d) =>
          designerCanAcceptOrders(d) &&
          designerCoversProjectType(d, order.projectType),
      ),
    [designers, order.projectType],
  );

  const specialtyCounts = useMemo(() => {
    const counts = Object.fromEntries(
      SPECIALTIES.map((s) => [s.value, 0]),
    ) as Record<Specialty, number>;
    for (const d of eligible) {
      counts[d.specialty] = (counts[d.specialty] ?? 0) + 1;
    }
    return counts;
  }, [eligible]);

  const filtered = useMemo(
    () => applyDesignerFilters(eligible, filters),
    [eligible, filters],
  );

  const patchFilters = (partial: Partial<DesignerFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const handleConfirm = () => {
    const designer = eligible.find((d) => d.id === pickedId);
    if (!designer) return;
    onSelect(designer);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(960px,96vw)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-ink-20 px-6 py-5">
          <DialogTitle>{title ?? "选择委派设计师"}</DialogTitle>
          <DialogDescription>
            按专业分页浏览并筛选可接单设计师，确认后返回委派面板。
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-ink-20 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => {
              const active = filters.specialty === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() =>
                    patchFilters({
                      specialty: s.value,
                      trackL2: "all",
                      trackL3: "all",
                      projectType: "all",
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-ink-20 text-ink-60 hover:border-ink/40",
                  )}
                >
                  {s.label}
                  <span className="ml-1 tabular-nums opacity-70">
                    {specialtyCounts[s.value] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          <DesignerFiltersPanel
            filters={filters}
            onPatch={patchFilters}
            onReset={() =>
              setFilters({
                ...DEFAULT_DESIGNER_FILTERS,
                specialty: filters.specialty,
              })
            }
            resultCount={filtered.length}
            sticky={false}
            layout="toolbar"
            className="border-0 p-0 shadow-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-ink-60">
              <Search className="h-5 w-5" />
              当前筛选下暂无可委派设计师
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => {
                const active = pickedId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPickedId(d.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                        : "border-ink-20 bg-white hover:border-ink/40",
                    )}
                  >
                    <Avatar className="mt-0.5 h-11 w-11 shrink-0">
                      <AvatarImage src={d.avatar} alt={d.name} />
                      <AvatarFallback>{d.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {d.name}
                        </span>
                        {d.code ? (
                          <Badge variant="outline" className="text-[10px]">
                            {d.code}
                          </Badge>
                        ) : null}
                        {active ? (
                          <Badge variant="brand" className="text-[10px]">
                            <Check className="h-3 w-3" /> 已选
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SpecialtyBadge specialty={d.specialty} />
                        <DesignerLevelBadge level={d.level ?? "mid_v1"} />
                        <WorkloadBadge status={d.workloadStatus} />
                        {d.acceptingOrders === false ? (
                          <Badge variant="amber" className="text-[10px]">
                            暂不接单
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-1 text-xs text-ink-60">
                        {d.tagline || d.location || "—"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-ink-20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" disabled={!pickedId} onClick={handleConfirm}>
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
