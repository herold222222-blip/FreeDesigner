"use client";

import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { useRoleStore } from "@/store/role-store";

export default function DesignerOrdersPage() {
  const identityId = useRoleStore((s) => s.identityId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          我的项目
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          悬赏报名、定向下单、扫码下单、常规面积报价、按工时/按月、线上/线下等接单统一在此查看，可按类型分页筛选。
        </p>
      </div>

      <UnifiedProjectList
        perspective="designer"
        identityId={identityId ?? ""}
        emptyLabel="该分类下暂无项目，可切换「全部」查看所有类型。"
      />
    </div>
  );
}
