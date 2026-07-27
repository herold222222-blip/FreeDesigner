"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignerPortfolioDialog } from "@/components/domain/designer-portfolio-dialog";
import { PortfolioImageLightbox } from "@/components/domain/portfolio-image-lightbox";
import { updateDesignerProfileRequest } from "@/lib/api-client";
import { getAcceptableProjectTypes } from "@/lib/designer-portfolio-readiness";
import { normalizePortfolioItem, portfolioCoverUrl } from "@/lib/portfolio-images";
import { invalidateApiPath, useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import type { PortfolioItem } from "@/lib/types";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";

export default function PortfolioPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer, loading, refresh } = useDesigner(identityId);
  const push = useSessionStore((s) => s.pushNotification);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

  const portfolio = designer?.portfolio ?? [];
  const acceptableTypes = designer ? getAcceptableProjectTypes(designer) : [];
  const grouped = portfolio.reduce<Record<string, PortfolioItem[]>>(
    (acc, p) => {
      acc[p.category] = acc[p.category] || [];
      acc[p.category].push(p);
      return acc;
    },
    {},
  );

  const persistPortfolio = async (next: PortfolioItem[], successTitle: string) => {
    if (!designer) return;
    setSaving(true);
    try {
      await updateDesignerProfileRequest(designer.id, { portfolio: next });
      invalidateApiPath(`/api/designers/${designer.id}`);
      refresh();
      push({ title: successTitle, variant: "success" });
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (item: PortfolioItem) => {
    if (!designer) return;
    const normalized = normalizePortfolioItem(item);
    const exists = portfolio.some((p) => p.id === normalized.id);
    const next = exists
      ? portfolio.map((p) => (p.id === normalized.id ? normalized : p))
      : [normalized, ...portfolio];
    await persistPortfolio(next, exists ? "作品已更新" : "作品已上传");
  };

  const handleDelete = async (id: string) => {
    if (!designer) return;
    if (!window.confirm("确认删除该作品？删除后不可恢复。")) return;
    const next = portfolio.filter((p) => p.id !== id);
    await persistPortfolio(next, "作品已删除");
  };

  if (loading || !designer) {
    return <div className="py-20 text-center text-ink-60">正在加载作品...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            作品管理
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            按项目类型上传作品案例；上传后的类型同步为擅长项目类型，并决定您可承接的订单 /
            悬赏类型。
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <ImagePlus className="h-4 w-4" /> 上传新作品
        </Button>
      </div>

      {acceptableTypes.length > 0 ? (
        <Card className="space-y-2 p-4">
          <div className="text-xs font-medium text-ink">当前可接单项目类型</div>
          <p className="text-[11px] text-ink-40">
            仅可承接下列类型的定向下单、扫码下单与悬赏；补充作品即可扩展可接范围。
          </p>
          <div className="flex flex-wrap gap-1.5">
            {acceptableTypes.map((t) => (
              <Badge key={t} variant="emerald" className="text-[11px]">
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {portfolio.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-20/50 text-ink-40">
            <ImagePlus className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-ink">还没有作品案例</div>
            <p className="mt-1 text-xs text-ink-40">
              上传至少 1 个项目案例后，方可开启接单；案例的项目类型即您可承接的订单类型。
            </p>
          </div>
          <Button
            variant="brand"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <ImagePlus className="h-4 w-4" /> 上传第一件作品
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="default" className="bg-ink">
                  {cat}
                </Badge>
                <span className="text-xs text-ink-40">{items.length} 件</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => {
                  const cover = portfolioCoverUrl(p);
                  const imageCount = normalizePortfolioItem(p).images?.length ?? 1;
                  return (
                  <Card key={p.id} className="overflow-hidden">
                    <button
                      type="button"
                      className="relative aspect-[4/3] w-full cursor-zoom-in bg-ink-20 text-left"
                      onClick={() => {
                        const normalized = normalizePortfolioItem(p);
                        const coverIdx = Math.max(
                          0,
                          (normalized.images ?? []).indexOf(normalized.cover),
                        );
                        setPreviewItem(normalized);
                        setPreviewInitialIndex(coverIdx);
                        setPreviewOpen(true);
                      }}
                    >
                      {cover.startsWith("data:") || cover.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={p.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src={cover}
                          alt={p.title}
                          fill
                          sizes="20vw"
                          className="object-cover"
                        />
                      )}
                      {imageCount > 1 ? (
                        <Badge
                          variant="muted"
                          className="pointer-events-none absolute bottom-2 right-2 bg-ink/70 text-[10px] text-white"
                        >
                          {imageCount} 图
                        </Badge>
                      ) : null}
                    </button>
                    <div className="p-4">
                      <div className="line-clamp-1 text-sm font-medium text-ink">
                        {p.title}
                      </div>
                      <div className="mt-1 text-xs text-ink-40">
                        {p.year}
                        {p.landscapeAreaSqm
                          ? ` · ${p.landscapeAreaSqm.toLocaleString()}㎡`
                          : ""}
                        {p.owner ? ` · ${p.owner}` : ""}
                      </div>
                      {p.description ? (
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink-50">
                          {p.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(normalizePortfolioItem(p));
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.id)}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <DesignerPortfolioDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        designer={designer}
        editing={editing}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <PortfolioImageLightbox
        item={previewItem}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewItem(null);
        }}
        initialIndex={previewInitialIndex}
      />
    </div>
  );
}
