"use client";

import { useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REGION_TIER_META } from "@/lib/constants";
import {
  AREA_ROOTS,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/lib/administrative-area";
import { cn } from "@/lib/utils";

export type { AdministrativeTriple, AdministrativeRegionResolution } from "@/lib/administrative-area";
export { AREA_ROOTS, getDefaultAdministrativeTriple, resolveAdministrativeTriple };

interface AdministrativeRegionSelectorProps {
  triple: AdministrativeTriple;
  /** 任一级别变更后为完整三元组（地级变更时会自动回填首个区县） */
  onTripleChange: (next: AdministrativeTriple) => void;
  className?: string;
}

/**
 * 省级 → 地级市 → 区县；费率梯队由地级市名称对照文档 REGION_TIER_META（非从梯队城市列表中选）。
 */
export function AdministrativeRegionSelector({
  triple,
  onTripleChange,
  className,
}: AdministrativeRegionSelectorProps) {
  const provinceNode = AREA_ROOTS.find((x) => x.value === triple.provinceCode);
  const cityOptions = provinceNode?.children ?? [];
  const cityNode = cityOptions.find((x) => x.value === triple.cityCode);
  const countyOptions = cityNode?.children ?? [];

  useEffect(() => {
    const p = AREA_ROOTS.find((x) => x.value === triple.provinceCode);
    const cy = p?.children.find((x) => x.value === triple.cityCode);
    const opts = cy?.children ?? [];

    if (opts.length === 0) return;
    const matches =
      !!triple.countyCode && opts.some((x) => x.value === triple.countyCode);
    if (!matches && opts[0]) {
      onTripleChange({
        provinceCode: triple.provinceCode,
        cityCode: triple.cityCode,
        countyCode: opts[0]!.value,
      });
    }
  }, [
    triple.provinceCode,
    triple.cityCode,
    triple.countyCode,
    onTripleChange,
  ]);

  const resolution = resolveAdministrativeTriple(triple);

  const pushTriple = (
    provinceCode: string,
    cityCode: string,
    countyCode: string | null,
  ) =>
    onTripleChange({
      provinceCode,
      cityCode,
      countyCode,
    });

  const onProvincePick = (pCode: string) => {
    const p = AREA_ROOTS.find((x) => x.value === pCode);
    const c0 = p?.children?.[0];
    if (!p || !c0)
      return pushTriple(pCode, "", null);
    const d0 = c0.children[0]?.value ?? null;
    pushTriple(p.value, c0.value, d0);
  };

  const onCityPick = (cyCode: string, pOverride?: AdministrativeTriple) => {
    const base = pOverride ?? triple;
    const pnode = AREA_ROOTS.find((x) => x.value === base.provinceCode);
    const cy = pnode?.children.find((x) => x.value === cyCode);
    if (!pnode || !cy)
      return pushTriple(base.provinceCode, cyCode, null);
    const d0 =
      cy.children.length ? cy.children[0]!.value
      : null;
    pushTriple(pnode.value, cy.value, d0);
  };

  const onCountyPick = (ctCode: string) => {
    if (!triple.provinceCode || !triple.cityCode)
      return;
    pushTriple(triple.provinceCode, triple.cityCode, ctCode || null);
  };

  const tierBadge =
    resolution &&
    (resolution.tier === "tier6" ?
      (
        <Badge variant="muted" className="shrink-0 text-[10px]">
          {REGION_TIER_META.tier6.label}：所选地级市不在前五梯队明细名录中时，按文档归第六梯队 ·{" "}
          {Math.round(REGION_TIER_META.tier6.coefficient * 100)}%
        </Badge>
      )
    : (
        <Badge variant="muted" className="shrink-0 text-[10px]">
          文档 {REGION_TIER_META[resolution.tier].label} · 设计师区域系数{" "}
          {Math.round(REGION_TIER_META[resolution.tier].coefficient * 100)}%
        </Badge>
      ));

  /* 兜底：三元组不完整时仍尽量展示 */
  const displayLine = useMemo(() => {
    if (resolution?.fullLabel) return resolution.fullLabel;
    const parts = [provinceNode?.text, cityNode?.text].filter(Boolean);
    return parts.join(" · ") || "请先选择行政区划";
  }, [provinceNode?.text, cityNode?.text, resolution?.fullLabel]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="space-y-1">
          <span className="text-[11px] text-ink-40">省 / 直辖市 / 自治区</span>
          <select
            className="h-11 w-full rounded-xl border border-ink-20 bg-white px-2 text-xs sm:text-sm"
            value={triple.provinceCode}
            onChange={(e) => onProvincePick(e.target.value)}
          >
            <option value="" disabled>
              请选择省份
            </option>
            {AREA_ROOTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.text}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-ink-40">地级市</span>
          <select
            disabled={!triple.provinceCode || cityOptions.length === 0}
            className="h-11 w-full rounded-xl border border-ink-20 bg-white px-2 text-xs sm:text-sm disabled:opacity-50"
            value={triple.cityCode}
            onChange={(e) =>
              triple.provinceCode ?
                onCityPick(e.target.value, triple)
              : undefined
            }
          >
            <option value="">请选择地级市</option>
            {cityOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.text}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-ink-40">区县（县级）</span>
          <select
            disabled={!triple.cityCode || countyOptions.length === 0}
            className="h-11 w-full rounded-xl border border-ink-20 bg-white px-2 text-xs sm:text-sm disabled:opacity-50"
            value={
              triple.countyCode !== null &&
              countyOptions.some((x) => x.value === triple.countyCode)
                ?
                  triple.countyCode
              : ""
            }
            onChange={(e) => onCountyPick(e.target.value)}
          >
            {countyOptions.length === 0 ?
              <option value="">本市级暂无下级区县条目</option>
            : <>
                <option value="">请选择区县</option>
                {countyOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.text}
                  </option>
                ))}
              </>
            }
          </select>
        </label>
        <div className="hidden items-end pb-2 sm:flex sm:justify-center">
          <MapPin className="h-4 w-4 text-ink-40" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-20/30 px-3 py-2 text-[11px] text-ink-60">
        <span className="text-ink">已选：{displayLine}</span>
        {tierBadge}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-40">
        项目所在地按民政部标准行政区划选择；梯队与设计师区域费率系数由所选
        <span className="font-medium text-ink">地级市</span>
        （或直辖市同名市）对照平台文档费率表判定，覆盖全国区县，不限于简短城市名单列表。
      </p>
    </div>
  );
}
