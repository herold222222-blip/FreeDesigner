"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, QrCode, ExternalLink } from "lucide-react";
import { ScanOrderQrDialog } from "@/components/domain/scan-order-qr-dialog";
import { DesignerPublicProfileView } from "@/components/domain/designer-public-profile-view";
import { DesignerProfileEditDialog } from "@/components/domain/designer-profile-edit-dialog";
import { useEffectiveDesigner } from "@/lib/use-effective-designer";
import { useRoleStore } from "@/store/role-store";
import { useDesigner } from "@/lib/use-data";

export default function DesignerProfileEditorPage() {
  const identityId = useRoleStore((s) => s.identityId) ?? "";
  const { refresh } = useDesigner(identityId);
  const designer = useEffectiveDesigner(identityId);
  const [editOpen, setEditOpen] = useState(false);

  if (!designer) {
    return (
      <div className="text-sm text-ink-60">未找到当前设计师身份，请重新登录。</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">个人主页</h2>
          <p className="mt-1 text-sm text-ink-60">
            右侧为委托人看到的对外展示效果；修改资料后预览即时更新。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScanOrderQrDialog
            designerId={designer.id}
            designerName={designer.name}
            triggerClassName="h-10 px-4"
          />
          <Button asChild variant="outline">
            <Link href="/designer/scan-orders">
              <QrCode className="h-4 w-4" /> 扫码订单
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/designers/${designer.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> 新窗口打开
            </Link>
          </Button>
          <Button variant="brand" type="button" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> 编辑信息
          </Button>
        </div>
      </div>

      <DesignerProfileEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        designer={designer}
        onSaved={refresh}
      />

      <div className="overflow-hidden rounded-2xl border border-ink-20 bg-[#FAFAFA] shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-20 bg-white px-4 py-2.5">
          <Badge variant="muted" className="text-[10px]">
            对外展示预览
          </Badge>
          <span className="text-[11px] text-ink-40">
            /designers/{designer.id}
          </span>
        </div>
        <DesignerPublicProfileView designer={designer} embedded />
      </div>
    </div>
  );
}
