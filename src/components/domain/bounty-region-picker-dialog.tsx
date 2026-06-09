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
import { Input } from "@/components/ui/input";
import { AREA_ROOTS } from "@/lib/administrative-area";
import type { BountyRegionRequirement } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseRegions(regions: BountyRegionRequirement[]) {
  const provinces = new Set<string>();
  const cities = new Set<string>();
  for (const r of regions) {
    if (r.type === "province") provinces.add(r.code);
    else cities.add(r.code);
  }
  return { provinces, cities };
}

function buildRegions(
  provinces: Set<string>,
  cities: Set<string>,
): BountyRegionRequirement[] {
  const out: BountyRegionRequirement[] = [];
  for (const code of provinces) {
    const p = AREA_ROOTS.find((x) => x.value === code);
    if (p) out.push({ type: "province", code, label: p.text });
  }
  for (const code of cities) {
    for (const p of AREA_ROOTS) {
      const c = p.children.find((x) => x.value === code);
      if (c) {
        out.push({ type: "city", code, label: `${p.text} · ${c.text}` });
        break;
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "zh"));
}

interface BountyRegionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: BountyRegionRequirement[];
  onConfirm: (regions: BountyRegionRequirement[]) => void;
}

export function BountyRegionPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: BountyRegionPickerDialogProps) {
  const [draftProvinces, setDraftProvinces] = useState<Set<string>>(new Set());
  const [draftCities, setDraftCities] = useState<Set<string>>(new Set());
  const [activeProvinceCode, setActiveProvinceCode] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const { provinces, cities } = parseRegions(value);
    setDraftProvinces(new Set(provinces));
    setDraftCities(new Set(cities));
    setQuery("");
    const first =
      value.find((r) => r.type === "province")?.code ??
      AREA_ROOTS.find((p) =>
        p.children.some((c) => cities.has(c.value)),
      )?.value ??
      AREA_ROOTS[0]?.value ??
      "";
    setActiveProvinceCode(first);
  }, [open, value]);

  const filteredProvinces = useMemo(() => {
    const q = query.trim();
    if (!q) return AREA_ROOTS;
    return AREA_ROOTS.filter((p) => {
      if (p.text.includes(q)) return true;
      return p.children.some((c) => c.text.includes(q));
    });
  }, [query]);

  const activeProvince = AREA_ROOTS.find((p) => p.value === activeProvinceCode);
  const cityOptions = useMemo(() => {
    if (!activeProvince) return [];
    const q = query.trim();
    if (!q) return activeProvince.children;
    return activeProvince.children.filter((c) => c.text.includes(q));
  }, [activeProvince, query]);

  const toggleProvince = (code: string) => {
    setDraftProvinces((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCity = (code: string) => {
    setDraftCities((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(buildRegions(draftProvinces, draftCities));
    onOpenChange(false);
  };

  const selectedCount = draftProvinces.size + draftCities.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4">
        <DialogHeader>
          <DialogTitle>选择地域要求</DialogTitle>
          <DialogDescription>
            可多选省/直辖市，也可多选具体地级市；不选则表示不限地域。
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="搜索省、直辖市或城市"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="grid h-[min(52vh,400px)] gap-3 sm:grid-cols-2">
          <div className="flex min-h-0 flex-col rounded-xl border border-ink-20">
            <div className="border-b border-ink-20 px-3 py-2 text-xs font-medium text-ink-40">
              省 / 直辖市
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredProvinces.map((p) => {
                const checked = draftProvinces.has(p.value);
                const active = activeProvinceCode === p.value;
                const cityHits = p.children.filter((c) => draftCities.has(c.value)).length;
                return (
                  <div
                    key={p.value}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                      active && "bg-ink-20/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProvince(p.value)}
                      className="h-4 w-4 shrink-0"
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left text-ink hover:text-brand"
                      onClick={() => setActiveProvinceCode(p.value)}
                    >
                      {p.text}
                      {cityHits > 0 ? (
                        <span className="ml-1 text-[11px] text-ink-40">
                          · {cityHits} 市
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-xl border border-ink-20">
            <div className="border-b border-ink-20 px-3 py-2 text-xs font-medium text-ink-40">
              {activeProvince ? `${activeProvince.text} · 地级市` : "地级市"}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!activeProvince ? (
                <p className="px-2 py-4 text-sm text-ink-40">请先在左侧选择省份</p>
              ) : (
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink hover:bg-ink-20/30">
                    <input
                      type="checkbox"
                      checked={draftProvinces.has(activeProvince.value)}
                      onChange={() => toggleProvince(activeProvince.value)}
                      className="h-4 w-4 shrink-0"
                    />
                    全省 · {activeProvince.text}
                  </label>
                  {cityOptions.length > 0 ? (
                    cityOptions.map((c) => (
                      <label
                        key={c.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-ink-20/30"
                      >
                        <input
                          type="checkbox"
                          checked={draftCities.has(c.value)}
                          onChange={() => toggleCity(c.value)}
                          className="h-4 w-4 shrink-0"
                        />
                        {c.text}
                      </label>
                    ))
                  ) : (
                    <p className="px-2 py-2 text-xs text-ink-40">
                      该省无下级地级市，请直接勾选全省。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-40">
          已选 {selectedCount} 项
          {selectedCount > 0 ? "，确定后将应用到地域要求" : ""}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="brand" onClick={handleConfirm}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function regionPickerTriggerLabel(regions: BountyRegionRequirement[]) {
  if (regions.length === 0) return "点击选择省/直辖市与地级市";
  if (regions.length === 1) return regions[0]!.label;
  return `已选 ${regions.length} 项地域条件`;
}
