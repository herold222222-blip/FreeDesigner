"use client";

import { SuperAdminLevelManager } from "@/components/domain/super-admin-level-manager";

export default function SuperAdminLevelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          等级管理
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          按设计主体与委托人两大类配置等级体系，查看用户分布；删除等级时需将用户迁移至其他等级。
        </p>
      </div>
      <SuperAdminLevelManager />
    </div>
  );
}
