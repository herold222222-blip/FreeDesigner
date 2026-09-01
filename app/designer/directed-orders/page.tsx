"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { ScanOrderQrDialog } from "@/components/domain/scan-order-qr-dialog";
import { buildScanOrderPath } from "@/lib/scan-order";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { Pencil } from "lucide-react";

export default function DesignerDirectedOrdersPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer } = useDesigner(identityId);
  const selfOrderHref = identityId ? buildScanOrderPath(identityId) : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            定向订单
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            委托人在您主页发起的定向下单与扫码下单，可按类型与状态筛选。
          </p>
        </div>
        {identityId ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={selfOrderHref}>
                <Pencil className="h-4 w-4" /> 自己填单
              </Link>
            </Button>
            <ScanOrderQrDialog
              designerId={identityId}
              designerName={designer?.name ?? ""}
              triggerLabel="分享下单链接"
              triggerSize="default"
              triggerClassName=""
              showEnterOrder={false}
            />
          </div>
        ) : null}
      </div>

      <UnifiedProjectList
        perspective="designer"
        identityId={identityId ?? ""}
        directedOrdersOnly
        emptyLabel="暂无定向订单。将个人主页分享给委托人即可接单。"
      />
    </div>
  );
}
