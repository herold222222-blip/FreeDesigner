"use client";

import { useSearchParams } from "next/navigation";
import { DesignerPublicProfileView } from "@/components/domain/designer-public-profile-view";
import { parseAdminUsersReturnTo } from "@/lib/admin-return-to";
import { useDesigner } from "@/lib/use-data";
import { useEffectiveDesigner } from "@/lib/use-effective-designer";

export function DesignerPublicProfilePageClient({ designerId }: { designerId: string }) {
  const returnTo = parseAdminUsersReturnTo(useSearchParams().get("returnTo"));
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
    <DesignerPublicProfileView designer={designer} returnTo={returnTo ?? undefined} />
  );
}
