"use client";

import { DesignerMyRatesEditor } from "@/components/domain/designer-my-rates-editor";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";

export default function DesignerRatesPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer, loading, refresh } = useDesigner(identityId);

  if (loading || !designer) {
    return <div className="py-20 text-center text-ink-60">正在加载费率设置...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">我的费率</h2>
        <p className="mt-1 text-sm text-ink-60">
          查看平台为您计算的取费基数（已叠加设计师等级与所在地系数），可按项调节展示费率百分比。保存后同步至侧栏取费卡片与对外展示。
        </p>
      </div>
      <DesignerMyRatesEditor designer={designer} onSaved={refresh} />
    </div>
  );
}
