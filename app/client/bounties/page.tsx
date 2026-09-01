"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { useRoleStore } from "@/store/role-store";
import { Megaphone } from "lucide-react";

export default function ClientBountiesPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const clientId = identityId ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            我的悬赏
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            管理你发布的全部悬赏项目。未中标前可选设计师；中标后在本页继续签约、付款与验收。
          </p>
        </div>
        <Button asChild variant="brand">
          <Link href="/entrust/new?mode=bounty">
            <Megaphone className="h-4 w-4" /> 发布新悬赏
          </Link>
        </Button>
      </div>

      <UnifiedProjectList
        perspective="client"
        identityId={clientId}
        bountiesOnly
        emptyLabel="暂无悬赏，可切换「全部」查看各类型，或发布新悬赏。"
      />
    </div>
  );
}
