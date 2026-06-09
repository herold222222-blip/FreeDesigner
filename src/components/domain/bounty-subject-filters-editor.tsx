"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DESIGNER_LEVEL_META,
  SUBJECT_TYPE_OPTIONS,
} from "@/lib/constants";
import {
  BountyRegionPickerDialog,
  regionPickerTriggerLabel,
} from "@/components/domain/bounty-region-picker-dialog";
import type {
  BountySubjectFilters,
  DesignerLevel,
  SubjectType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const EMPTY_BOUNTY_SUBJECT_FILTERS: BountySubjectFilters = {};

function clampRating(v: number) {
  return Math.round(Math.min(5, Math.max(0.1, v)) * 10) / 10;
}

function normalizeFilters(v: BountySubjectFilters): BountySubjectFilters {
  return {
    subjectTypes: v.subjectTypes?.length ? v.subjectTypes : undefined,
    minDesignerLevel: v.minDesignerLevel,
    regionRequirements: v.regionRequirements?.length
      ? v.regionRequirements
      : undefined,
    minRating:
      v.minRating != null && !Number.isNaN(v.minRating)
        ? clampRating(v.minRating)
        : undefined,
  };
}

interface BountySubjectFiltersEditorProps {
  value: BountySubjectFilters;
  onChange: (v: BountySubjectFilters) => void;
}

export function BountySubjectFiltersEditor({
  value,
  onChange,
}: BountySubjectFiltersEditorProps) {
  const subjectTypes = value.subjectTypes ?? [];
  const regions = value.regionRequirements ?? [];
  const minLevel = value.minDesignerLevel ?? "";
  const ratingEnabled = value.minRating != null;
  const minRating = value.minRating ?? 4.0;

  const [regionDialogOpen, setRegionDialogOpen] = useState(false);

  const toggleSubjectType = (t: SubjectType) => {
    const next = subjectTypes.includes(t)
      ? subjectTypes.filter((x) => x !== t)
      : [...subjectTypes, t];
    onChange({ ...value, subjectTypes: next.length ? next : undefined });
  };

  const removeRegion = (type: "province" | "city", code: string) => {
    const next = regions.filter((r) => !(r.type === type && r.code === code));
    onChange({
      ...value,
      regionRequirements: next.length ? next : undefined,
    });
  };

  const resetRegions = () => {
    onChange({ ...value, regionRequirements: undefined });
  };

  const selectClass =
    "h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm";

  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-60">
        以下均为选填；不设置则表示对可报名设计主体不做额外限制。
      </p>

      {/* 1. 团队规模 */}
      <div className="space-y-2">
        <Label>可接单的团队规模</Label>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={subjectTypes.length === 0}
            onClick={() => onChange({ ...value, subjectTypes: undefined })}
          >
            不限
          </FilterChip>
          {SUBJECT_TYPE_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              active={subjectTypes.includes(o.value)}
              onClick={() => toggleSubjectType(o.value)}
            >
              {o.label}
            </FilterChip>
          ))}
        </div>
        {subjectTypes.length > 0 ? (
          <p className="text-[11px] text-ink-40">已选 {subjectTypes.length} 类，可多选</p>
        ) : null}
      </div>

      {/* 2. 最低等级 */}
      <div className="space-y-2">
        <Label>最低设计主体等级</Label>
        <select
          className={selectClass}
          value={minLevel || "all"}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...value,
              minDesignerLevel:
                v === "all" ? undefined : (v as DesignerLevel),
            });
          }}
        >
          <option value="all">不限</option>
          {(
            Object.entries(DESIGNER_LEVEL_META) as [
              DesignerLevel,
              (typeof DESIGNER_LEVEL_META)[DesignerLevel],
            ][]
          ).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}及以上
            </option>
          ))}
        </select>
      </div>

      {/* 3. 地域要求 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>地域要求</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-ink-60"
            onClick={resetRegions}
            disabled={regions.length === 0}
          >
            重置
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setRegionDialogOpen(true)}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-ink-20 bg-white px-3 text-left text-sm transition-colors hover:border-ink/40",
            regions.length > 0 ? "text-ink" : "text-ink-40",
          )}
        >
          <MapPin className="h-4 w-4 shrink-0 text-ink-40" />
          <span className="min-w-0 flex-1 truncate">
            {regionPickerTriggerLabel(regions)}
          </span>
        </button>
        {regions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <Badge
                key={`${r.type}-${r.code}`}
                variant="outline"
                className="gap-1 pr-1 font-normal"
              >
                {r.type === "province" ? "全省" : "城市"} · {r.label}
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-ink-20/50"
                  onClick={() => removeRegion(r.type, r.code)}
                  aria-label={`移除 ${r.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-40">默认不限，点击上方按钮多选省/直辖市或地级市</p>
        )}
        <BountyRegionPickerDialog
          open={regionDialogOpen}
          onOpenChange={setRegionDialogOpen}
          value={regions}
          onConfirm={(next) =>
            onChange({
              ...value,
              regionRequirements: next.length ? next : undefined,
            })
          }
        />
      </div>

      {/* 4. 最低评分 */}
      <div className="space-y-2">
        <Label>最低评分限制</Label>
        <div className="flex flex-wrap items-center gap-3">
          <FilterChip
            active={!ratingEnabled}
            onClick={() => onChange({ ...value, minRating: undefined })}
          >
            不限
          </FilterChip>
          <FilterChip
            active={ratingEnabled}
            onClick={() =>
              onChange({ ...value, minRating: clampRating(minRating) })
            }
          >
            设置最低分
          </FilterChip>
        </div>
        {ratingEnabled ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() =>
                onChange({
                  ...value,
                  minRating: clampRating(minRating - 0.1),
                })
              }
              disabled={minRating <= 0.1}
              aria-label="降低 0.1 分"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              className="w-24 text-center font-medium"
              value={minRating}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) {
                  onChange({ ...value, minRating: clampRating(n) });
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() =>
                onChange({
                  ...value,
                  minRating: clampRating(minRating + 0.1),
                })
              }
              disabled={minRating >= 5}
              aria-label="提高 0.1 分"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <span className="text-xs text-ink-60">分（0.1 – 5.0，步进 0.1）</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function packBountySubjectFilters(
  value: BountySubjectFilters,
): BountySubjectFilters | undefined {
  const packed = normalizeFilters(value);
  if (
    !packed.subjectTypes?.length &&
    !packed.minDesignerLevel &&
    !packed.regionRequirements?.length &&
    packed.minRating == null
  ) {
    return undefined;
  }
  return packed;
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
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-ink-20 text-ink-60 hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}
