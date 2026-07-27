import { Suspense } from "react";
import { DesignerPublicProfilePageClient } from "@/components/domain/designer-public-profile-page-client";
import { GuestAccessGate } from "@/components/domain/guest-access-gate";

export default function DesignerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <GuestAccessGate intent="detail">
      <Suspense
        fallback={
          <div className="container-page py-20 text-center text-ink-60">
            正在加载设计师主页...
          </div>
        }
      >
        <DesignerPublicProfilePageClient designerId={params.id} />
      </Suspense>
    </GuestAccessGate>
  );
}
