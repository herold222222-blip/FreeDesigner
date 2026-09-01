"use client";

import { useSearchParams } from "next/navigation";
import { DesignerPublicProfileView } from "@/components/domain/designer-public-profile-view";
import {
  parseAdminUsersReturnTo,
  parseClientBountyReturnTo,
  parseOrderReturnTo,
} from "@/lib/admin-return-to";
import { useDesigner } from "@/lib/use-data";
import { useEffectiveDesigner } from "@/lib/use-effective-designer";

export function DesignerPublicProfilePageClient({ designerId }: { designerId: string }) {
  const rawReturnTo = useSearchParams().get("returnTo");
  const adminReturnTo = parseAdminUsersReturnTo(rawReturnTo);
  const bountyReturnTo = parseClientBountyReturnTo(rawReturnTo);
  const orderReturnTo = parseOrderReturnTo(rawReturnTo);
  const returnTo = adminReturnTo ?? bountyReturnTo ?? orderReturnTo ?? undefined;
  const returnLabel = adminReturnTo
    ? "返回用户管理"
    : bountyReturnTo
      ? "返回悬赏报名"
      : orderReturnTo
        ? "返回订单"
        : undefined;
  const { loading } = useDesigner(designerId);
  const designer = useEffectiveDesigner(designerId);

  if (loading) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        正在加载设计师主页...
      </div>
    );
  }
  if (!designer) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        未找到该设计师。
      </div>
    );
  }
  return (
    <DesignerPublicProfileView
      designer={designer}
      returnTo={returnTo}
      returnLabel={returnLabel}
    />
  );
}
