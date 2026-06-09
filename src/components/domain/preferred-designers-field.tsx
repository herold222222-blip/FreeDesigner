"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MapPin, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useDesigners } from "@/lib/use-data";
import { useFavoritesStore } from "@/store/favorites-store";
import { FavoriteDesignersImportDialog } from "@/components/domain/favorite-designers-import-dialog";
import { DesignerName } from "@/components/domain/designer-name";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { resolveTrackLabels, SPECIALTIES } from "@/lib/constants";
import {
  parseDesignerCodesInput,
  normalizeDesignerCode,
} from "@/lib/designer-code";
import type { Designer, DesignerLevel } from "@/lib/types";
import { useDesignerContactPrivacy } from "@/lib/use-designer-contact-privacy";
import { cn } from "@/lib/utils";

interface PreferredDesignersFieldProps {
  value: string;
  onChange: (raw: string) => void;
}

export function PreferredDesignersField({
  value,
  onChange,
}: PreferredDesignersFieldProps) {
  const { data: designers } = useDesigners();
  const favoriteIds = useFavoritesStore((s) => s.designerIds);
  const [importOpen, setImportOpen] = useState(false);

  const codeToDesigner = useMemo(() => {
    const map = new Map<string, Designer>();
    for (const d of designers) {
      if (d.code) map.set(normalizeDesignerCode(d.code), d);
    }
    return map;
  }, [designers]);

  const codes = useMemo(() => parseDesignerCodesInput(value), [value]);

  const resolved = codes
    .map((c) => ({ code: c, designer: codeToDesigner.get(c) }))
    .filter((x) => x.designer);
  const unresolved = codes.filter((c) => !codeToDesigner.has(c));

  const importFromFavorites = (pickedCodes: string[]) => {
    if (pickedCodes.length === 0) return;
    const merged = [...new Set([...codes, ...pickedCodes])];
    onChange(merged.join("\n"));
  };

  const removeCode = (code: string) => {
    const next = codes.filter((c) => c !== code);
    onChange(next.join("\n"));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium text-ink">
          倾向的设计师
          <span className="ml-1 text-xs font-normal text-ink-40">（选填）</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => setImportOpen(true)}
          disabled={favoriteIds.length === 0}
        >
          <Heart className="h-3.5 w-3.5" />
          从收藏导入
        </Button>
      </div>
      <FavoriteDesignersImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingCodes={codes}
        onConfirm={importFromFavorites}
      />
      <Textarea
        placeholder="粘贴设计师编号，多个可用逗号、空格或换行分隔，例如：&#10;DS000001&#10;DS000003"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="font-mono text-sm"
      />
      <p className="text-[11px] text-ink-40">
        填写后平台会优先向对应设计师推送匹配；也可从「我的收藏」勾选导入编号。
      </p>

      {resolved.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {resolved.map(({ code, designer }) => (
            <PreferredDesignerMiniCard
              key={code}
              code={code}
              designer={designer!}
              onRemove={() => removeCode(code)}
            />
          ))}
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <p className="text-[11px] text-amber-700">
          未识别的编号：{unresolved.join("、")}，请核对后重新输入。
        </p>
      ) : null}
    </div>
  );
}

function PreferredDesignerMiniCard({
  designer,
  code,
  onRemove,
}: {
  designer: Designer;
  code: string;
  onRemove: () => void;
}) {
  const level: DesignerLevel = designer.level ?? "intern";
  const { displayName } = useDesignerContactPrivacy(designer);
  const track = designer.primaryTrack;
  const { l1Label, l2Label, l3Label } = track
    ? resolveTrackLabels(track.l1, track.l2, track.l3)
    : {
        l1Label:
          SPECIALTIES.find((s) => s.value === designer.specialty)?.label ??
          designer.specialty,
        l2Label: "未设置",
        l3Label: "未设置",
      };

  return (
    <div className="group relative">
      <Link
        href={`/designers/${designer.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex gap-3 rounded-xl border border-ink-20 bg-white p-3 pr-9",
          "transition-colors hover:border-brand/40 hover:bg-brand/[0.03]",
        )}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-20 ring-2 ring-white">
          {designer.avatar ? (
            <Image
              src={designer.avatar}
              alt={displayName}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-medium text-ink-60">
              {displayName.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <DesignerName
              designer={designer}
              displayName={displayName}
              className="max-w-full text-sm font-semibold"
            />
            <DesignerLevelBadge level={level} />
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-40">{code}</div>
          {designer.location ? (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-60">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{designer.location}</span>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-ink-40">所在地未设置</div>
          )}
          <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-ink-60">
            <div>
              <span className="text-ink-40">一级专业</span> {l1Label}
            </div>
            <div>
              <span className="text-ink-40">二级专业</span> {l2Label}
            </div>
            <div>
              <span className="text-ink-40">三级专业</span> {l3Label}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        className="absolute right-2 top-2 rounded-full p-1 text-ink-40 transition-colors hover:bg-ink-20/60 hover:text-ink"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`移除 ${designer.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
