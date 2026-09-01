"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { useRoleStore } from "@/store/role-store";
import { withReturnTo } from "@/lib/admin-return-to";
import { Megaphone } from "lucide-react";

export default function DesignerBountiesPage() {
  const identityId = useRoleStore((s) => s.identityId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            悬赏订单
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            仅查看你已报名的悬赏订单，可按类型、状态与专业筛选，与平台项目相同。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={withReturnTo("/bounties", "/designer/bounties")}>
            <Megaphone className="h-4 w-4" /> 悬赏大厅
          </Link>
        </Button>
      </div>

      <UnifiedProjectList
        perspective="designer"
        identityId={identityId ?? ""}
        bountiesOnly
        emptyLabel="暂无已报名的悬赏订单。"
      />
    </div>
  );
}
