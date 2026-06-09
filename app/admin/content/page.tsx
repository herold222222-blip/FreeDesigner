"use client";

import { AdminContentManager } from "@/components/domain/admin-content-manager";

export default function AdminContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          内容管理
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          维护常见问题、意见反馈、入驻协议与关于我们等平台内容。
        </p>
      </div>
      <AdminContentManager />
    </div>
  );
}
