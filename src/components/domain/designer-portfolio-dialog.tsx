"use client";

import { useMemo, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectTypes } from "@/lib/constants";
import { normalizePortfolioItem } from "@/lib/portfolio-images";
import type { Designer, PortfolioItem, Specialty } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";
import { ImagePlus, Star, Trash2, Upload, X } from "lucide-react";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 12;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("读取失败"));
    };
    reader.onerror = () => reject(new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

function buildInitialForm(editing: PortfolioItem | null | undefined, specialty: Specialty) {
  const types = getProjectTypes(specialty);
  if (editing) {
    const normalized = normalizePortfolioItem(editing);
    const images = normalized.images ?? [];
    const coverIndex = Math.max(0, images.indexOf(normalized.cover));
    return {
      title: normalized.title ?? "",
      category: normalized.category ?? types[0] ?? "",
      year: String(normalized.year ?? new Date().getFullYear()),
      owner: normalized.owner ?? "",
      landscapeArea:
        normalized.landscapeAreaSqm != null
          ? String(normalized.landscapeAreaSqm)
          : "",
      description: normalized.description ?? "",
      images,
      coverIndex: coverIndex >= 0 ? coverIndex : 0,
    };
  }
  return {
    title: "",
    category: types[0] ?? "",
    year: String(new Date().getFullYear()),
    owner: "",
    landscapeArea: "",
    description: "",
    images: [] as string[],
    coverIndex: 0,
  };
}

function PortfolioForm({
  designer,
  editing,
  onSubmit,
  onCancel,
  saving,
}: {
  designer: Designer;
  editing?: PortfolioItem | null;
  onSubmit: (item: PortfolioItem) => Promise<void> | void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = useMemo(
    () => buildInitialForm(editing, designer.specialty as Specialty),
    // 仅在表单挂载时取初始值；用 key 控制重新挂载，避免编辑过程中被重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [year, setYear] = useState(initial.year);
  const [owner, setOwner] = useState(initial.owner);
  const [landscapeArea, setLandscapeArea] = useState(initial.landscapeArea);
  const [description, setDescription] = useState(initial.description);
  const [images, setImages] = useState<string[]>(initial.images);
  const [coverIndex, setCoverIndex] = useState(initial.coverIndex);
  const [reading, setReading] = useState(false);

  const projectTypes = useMemo(() => {
    const types = getProjectTypes(designer.specialty as Specialty);
    if (category && !types.includes(category)) {
      return [category, ...types];
    }
    return types;
  }, [designer.specialty, category]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      push({
        title: "图片数量已达上限",
        description: `最多上传 ${MAX_IMAGES} 张图片。`,
        variant: "destructive",
      });
      return;
    }
    const slice = files.slice(0, room);
    const oversized = slice.find((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized) {
      push({
        title: "图片过大",
        description: `「${oversized.name}」超过 10MB，请压缩后重试。`,
        variant: "destructive",
      });
      return;
    }
    const nonImage = slice.find((f) => !f.type.startsWith("image/"));
    if (nonImage) {
      push({ title: "请选择图片文件", variant: "destructive" });
      return;
    }
    setReading(true);
    try {
      const urls = await Promise.all(slice.map(readFileAsDataUrl));
      setImages((prev) => {
        const next = [...prev, ...urls];
        if (prev.length === 0) setCoverIndex(0);
        return next;
      });
      if (files.length > room) {
        push({
          title: "部分图片未加入",
          description: `最多 ${MAX_IMAGES} 张，已跳过多余文件。`,
        });
      }
    } catch {
      push({ title: "图片读取失败", variant: "destructive" });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setCoverIndex((ci) => {
        if (next.length === 0) return 0;
        if (index === ci) return 0;
        if (index < ci) return ci - 1;
        return Math.min(ci, next.length - 1);
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      push({ title: "请填写作品标题", variant: "destructive" });
      return;
    }
    if (!category) {
      push({ title: "请选择项目类型", variant: "destructive" });
      return;
    }
    if (images.length === 0) {
      push({ title: "请至少上传一张图片", variant: "destructive" });
      return;
    }
    const yearNum = Math.round(Number(year));
    if (!Number.isFinite(yearNum) || yearNum < 1990 || yearNum > 2100) {
      push({ title: "请填写有效年份", variant: "destructive" });
      return;
    }
    const areaNum = Number(landscapeArea);
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      push({ title: "请填写有效的景观面积", variant: "destructive" });
      return;
    }
    const safeCoverIndex = Math.min(coverIndex, images.length - 1);
    await onSubmit({
      ...(editing ?? {}),
      id: editing?.id ?? `pf_${Date.now()}`,
      title: title.trim(),
      category,
      images,
      cover: images[safeCoverIndex],
      year: yearNum,
      owner: owner.trim() || undefined,
      landscapeAreaSqm: Math.round(areaNum),
      description: description.trim() || undefined,
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>作品标题 *</Label>
          <Input
            placeholder="例如：苏州相城公园施工图"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>项目类型 *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="选择项目类型" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>完成年份 *</Label>
            <Input
              type="number"
              min={1990}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>业主</Label>
            <Input
              placeholder="选填，如：玉龙地产"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>景观面积（㎡） *</Label>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="例如：12000"
              value={landscapeArea}
              onChange={(e) => setLandscapeArea(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>作品图片 *</Label>
            <span className="text-[11px] text-ink-40">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {images.map((src, index) => {
                const isCover = index === coverIndex;
                return (
                  <div
                    key={`${index}-${src.slice(0, 24)}`}
                    className={cn(
                      "group relative aspect-[4/3] overflow-hidden rounded-xl border bg-ink-20/20",
                      isCover
                        ? "border-brand ring-2 ring-brand/30"
                        : "border-ink-20",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`作品图 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {isCover ? (
                      <Badge
                        variant="brand"
                        className="absolute left-1.5 top-1.5 gap-0.5 px-1.5 text-[10px]"
                      >
                        <Star className="h-2.5 w-2.5" />
                        封面
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCoverIndex(index)}
                        className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                      >
                        设为封面
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="删除图片"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 bg-ink-20/20 text-ink-40">
              <ImagePlus className="h-8 w-8" />
              <span className="text-xs">尚未添加图片</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reading || images.length >= MAX_IMAGES}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {reading ? "读取中..." : images.length ? "继续添加" : "选择图片"}
            </Button>
            {images.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setImages([]);
                  setCoverIndex(0);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空图片
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-40">
            支持多选 JPG / PNG，单张不超过 10MB；默认第一张为封面，可点击「设为封面」更换。
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="space-y-2">
          <Label>项目介绍</Label>
          <Textarea
            rows={4}
            placeholder="选填：项目背景、设计要点、交付成果等"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button
          variant="brand"
          onClick={handleSave}
          disabled={saving || reading}
        >
          {saving ? "保存中..." : editing ? "保存修改" : "上传作品"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DesignerPortfolioDialog({
  open,
  onOpenChange,
  designer,
  editing,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designer: Designer;
  editing?: PortfolioItem | null;
  onSubmit: (item: PortfolioItem) => Promise<void> | void;
  saving?: boolean;
}) {
  const formKey = editing?.id ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑作品" : "上传新作品"}</DialogTitle>
          <DialogDescription>
            可上传多张图片，默认第一张为封面，也可点击任意图片设为封面。项目类型将同步为擅长类型并决定可接订单范围。
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <PortfolioForm
            key={formKey}
            designer={designer}
            editing={editing}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            saving={saving}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
