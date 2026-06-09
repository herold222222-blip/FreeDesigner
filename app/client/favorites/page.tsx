"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DesignerCard } from "@/components/domain/designer-card";
import { useDesigners } from "@/lib/use-data";
import { useFavoritesStore } from "@/store/favorites-store";
import { setClientFavoritesRequest } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { SPECIALTIES } from "@/lib/constants";
import type { Specialty } from "@/lib/types";
import { Heart, Search, Sparkles, ArrowRight } from "lucide-react";

export default function FavoritesPage() {
  const favoriteIds = useFavoritesStore((s) => s.designerIds);
  const hydrated = useFavoritesStore((s) => s.hydrated);
  const setDesignerIds = useFavoritesStore((s) => s.setDesignerIds);
  const push = useSessionStore((s) => s.pushNotification);
  const { data: designers } = useDesigners();
  const [keyword, setKeyword] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<Specialty | "all">("all");

  const favorites = useMemo(() => {
    if (!hydrated) return [];
    return designers
      .filter((d) => favoriteIds.includes(d.id))
      .filter((d) =>
        keyword
          ? d.name.includes(keyword) ||
            d.tagline.includes(keyword) ||
            d.expertiseTags.some((t) => t.includes(keyword))
          : true,
      )
      .filter((d) => (filterSpecialty === "all" ? true : d.specialty === filterSpecialty));
  }, [designers, hydrated, favoriteIds, keyword, filterSpecialty]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
            我的收藏
            <Badge variant="muted">{hydrated ? favoriteIds.length : 0} 位</Badge>
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            收藏喜欢的设计师，合作时一键找到。可在筛选条件下进一步过滤。
          </p>
        </div>
        {hydrated && favoriteIds.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const res = await setClientFavoritesRequest([]);
                setDesignerIds(res.designerIds);
                push({ title: "已清空收藏", variant: "success" });
              } catch (e) {
                push({
                  title: "清空失败",
                  description: e instanceof Error ? e.message : "请稍后再试",
                  variant: "destructive",
                });
              }
            }}
          >
            清空收藏
          </Button>
        ) : null}
      </div>

      {/* 筛选 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
            <Input
              placeholder="按姓名 / 标签 / 项目类型搜索"
              className="pl-9"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[{ value: "all", label: "全部专业" }, ...SPECIALTIES].map((s) => (
              <button
                key={s.value}
                onClick={() => setFilterSpecialty(s.value as any)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  filterSpecialty === s.value
                    ? "border-ink bg-ink text-white"
                    : "border-ink-20 text-ink-60 hover:border-ink/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {!hydrated ? (
        <Card className="p-16 text-center text-ink-60">加载收藏列表...</Card>
      ) : favoriteIds.length === 0 ? (
        <Card className="p-16 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-ink-40" />
          <div className="text-base font-medium text-ink">还没有收藏的设计师</div>
          <p className="mt-2 text-sm text-ink-60">
            浏览设计师列表，点击右上角的 ❤ 即可加入收藏。
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4">
            <Link href="/designers">
              去浏览设计师 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
      ) : favorites.length === 0 ? (
        <Card className="p-16 text-center text-ink-60">
          <Search className="mx-auto mb-3 h-8 w-8 text-ink-40" />
          没有匹配的收藏，请调整筛选条件。
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((d) => (
            <DesignerCard key={d.id} designer={d} />
          ))}
        </div>
      )}
    </div>
  );
}
