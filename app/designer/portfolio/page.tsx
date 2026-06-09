"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";

export default function PortfolioPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer, loading } = useDesigner(identityId);

  const grouped = (designer?.portfolio ?? []).reduce<
    Record<string, NonNullable<typeof designer>["portfolio"]>
  >(
    (acc, p) => {
      acc[p.category] = acc[p.category] || [];
      acc[p.category].push(p);
      return acc;
    },
    {},
  );

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
            按项目类型分类上传作品案例，公开展示于个人主页。上传并覆盖所需项目类型后，方可开启接单与平台项目匹配。
          </p>
        </div>
        <Button variant="brand">
          <ImagePlus className="h-4 w-4" /> 上传新作品
        </Button>
      </div>

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
              {items.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="relative aspect-[4/3] bg-ink-20">
                    <Image
                      src={p.cover}
                      alt={p.title}
                      fill
                      sizes="20vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-1 text-sm font-medium text-ink">
                      {p.title}
                    </div>
                    <div className="mt-1 text-xs text-ink-40">{p.year}</div>
                    <div className="mt-3 flex justify-end gap-1">
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
