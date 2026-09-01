"use client";

import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { useRoleStore } from "@/store/role-store";

export default function DesignerOrdersPage() {
  const identityId = useRoleStore((s) => s.identityId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          平台项目
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          常规委托、按工时/按月等项目在此查看；已报名悬赏见「悬赏订单」，指定设计师下单见「定向订单」。
        </p>
      </div>

      <UnifiedProjectList
        perspective="designer"
        identityId={identityId ?? ""}
        platformOrdersOnly
        emptyLabel="该分类下暂无项目。"
      />
    </div>
  );
}
