"use client";

import { AdminContractTemplates } from "@/components/domain/admin-contract-templates";
import { useContractTemplates } from "@/lib/use-data";

export default function AdminContractsPage() {
  const { data: config } = useContractTemplates();
  const enabledCount = config.templates.filter((t) => t.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          合同模板
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          预设各类下单与签约场景的合同模板，支持变量占位符，下单时自动生成电子合同。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-20 bg-background p-5">
          <div className="text-xs uppercase tracking-wider text-ink-40">
            模板总数
          </div>
          <div className="mt-2 text-2xl font-semibold text-ink">
            {config.templates.length}
          </div>
        </div>
        <div className="rounded-xl border border-ink-20 bg-background p-5">
          <div className="text-xs uppercase tracking-wider text-ink-40">
            已启用
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">
            {enabledCount}
          </div>
        </div>
      </div>

      <AdminContractTemplates />
    </div>
  );
}
