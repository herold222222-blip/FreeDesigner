"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
import { Badge } from "@/components/ui/badge";
import { useDesigners } from "@/lib/use-data";
import { useFavoritesStore } from "@/store/favorites-store";
import { SPECIALTIES, SUBJECT_TYPE_OPTIONS } from "@/lib/constants";
import { DesignerName } from "@/components/domain/designer-name";
import { useDesignerContactPrivacy } from "@/lib/use-designer-contact-privacy";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import { normalizeDesignerCode } from "@/lib/designer-code";
import type { Designer, Specialty, SubjectType } from "@/lib/types";
import { Check, Heart, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteDesignersImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已选中的设计师编号（用于打开时预勾选） */
  existingCodes?: string[];
  onConfirm: (codes: string[]) => void;
}

export function FavoriteDesignersImportDialog({
  open,
  onOpenChange,
  existingCodes = [],
  onConfirm,
}: FavoriteDesignersImportDialogProps) {
  const favoriteIds = useFavoritesStore((s) => s.designerIds);
  const { data: designers } = useDesigners();

  const [keyword, setKeyword] = useState("");
  const [specialty, setSpecialty] = useState<Specialty | "all">("all");
  const [subjectType, setSubjectType] = useState<SubjectType | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const favorites = useMemo(() => {
    return designers.filter((d) => favoriteIds.includes(d.id) && d.code);
  }, [designers, favoriteIds]);

  const filtered = useMemo(() => {
    return favorites
      .filter((d) =>
        keyword
          ? d.name.includes(keyword) ||
            d.code?.includes(keyword.toUpperCase()) ||
            d.tagline.includes(keyword) ||
            d.expertiseTags.some((t) => t.includes(keyword))
          : true,
      )
      .filter((d) => (specialty === "all" ? true : d.specialty === specialty))
      .filter((d) =>
        subjectType === "all"
          ? true
          : (d.subjectType ?? "individual") === subjectType,
      );
  }, [favorites, keyword, specialty, subjectType]);

  // 打开时按已有编号预勾选
  useEffect(() => {
    if (!open) return;
    const codeSet = new Set(existingCodes.map(normalizeDesignerCode));
    const ids = favorites
      .filter((d) => d.code && codeSet.has(normalizeDesignerCode(d.code)))
      .map((d) => d.id);
    setSelectedIds(new Set(ids));
    setKeyword("");
    setSpecialty("all");
    setSubjectType("all");
  }, [open, existingCodes, favorites]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((d) => next.add(d.id));
      return next;
    });
  };

  const clearFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((d) => next.delete(d.id));
      return next;
    });
  };

  const handleConfirm = () => {
    const codes = favorites
      .filter((d) => selectedIds.has(d.id) && d.code)
      .map((d) => normalizeDesignerCode(d.code!));
    onConfirm(codes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <div className="border-b border-ink-20 px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
              从收藏导入设计师
            </DialogTitle>
            <DialogDescription>
              勾选一位或多位收藏的设计师，确认后将编号填入倾向列表。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
              <Input
                placeholder="搜索姓名 / 编号 / 标签"
                className="pl-9"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-ink-40">专业</div>
              <div className="flex flex-wrap gap-1.5">
                {[{ value: "all", label: "全部" }, ...SPECIALTIES].map((s) => (
                  <FilterChip
                    key={s.value}
                    active={specialty === s.value}
                    onClick={() => setSpecialty(s.value as Specialty | "all")}
                  >
                    {s.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-ink-40">团队规模</div>
              <div className="flex flex-wrap gap-1.5">
                {[{ value: "all", label: "全部" }, ...SUBJECT_TYPE_OPTIONS].map(
                  (o) => (
                    <FilterChip
                      key={o.value}
                      active={subjectType === o.value}
                      onClick={() =>
                        setSubjectType(o.value as SubjectType | "all")
                      }
                    >
                      {o.label}
                    </FilterChip>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-ink-20 px-6 py-2 text-xs text-ink-60">
          <span>
            共 {filtered.length} 位
            {selectedIds.size > 0 ? ` · 已选 ${selectedIds.size} 位` : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-brand hover:underline"
              onClick={selectAllFiltered}
              disabled={filtered.length === 0}
            >
              全选当前
            </button>
            <button
              type="button"
              className="hover:underline"
              onClick={clearFiltered}
              disabled={filtered.length === 0}
            >
              取消当前
            </button>
          </div>
        </div>

        <div className="max-h-[min(50vh,360px)] overflow-y-auto px-3 py-2">
          {favorites.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-ink-60">
              暂无收藏的设计师，请先在「找设计」页面收藏。
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-ink-60">
              没有匹配的收藏，请调整筛选条件。
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((d) => (
                <FavoriteRow
                  key={d.id}
                  designer={d}
                  selected={selectedIds.has(d.id)}
                  onToggle={() => toggle(d.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-ink-20 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            导入选中（{selectedIds.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-ink-20 text-ink-60 hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}

function FavoriteRow({
  designer,
  selected,
  onToggle,
}: {
  designer: Designer;
  selected: boolean;
  onToggle: () => void;
}) {
  const { displayName } = useDesignerContactPrivacy(designer);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
          selected ? "bg-brand/8 ring-1 ring-brand/30" : "hover:bg-ink-20/30",
        )}
      >
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
            selected
              ? "border-brand bg-brand text-white"
              : "border-ink-20 bg-white",
          )}
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </div>
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-20">
          {designer.avatar ? (
            <Image
              src={designer.avatar}
              alt={displayName}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-medium text-ink-60">
              {displayName.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DesignerName
              designer={designer}
              displayName={displayName}
              className="max-w-full text-sm font-medium"
            />
            <SpecialtyBadge specialty={designer.specialty} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-60">
            <span className="font-mono">{designer.code}</span>
            {designer.location ? (
              <span className="truncate">{designer.location}</span>
            ) : null}
          </div>
        </div>
        {selected ? (
          <Badge variant="brand" className="shrink-0 text-[10px]">
            已选
          </Badge>
        ) : null}
      </button>
    </li>
  );
}
