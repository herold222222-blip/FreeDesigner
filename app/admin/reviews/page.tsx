"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminReviewQueue,
  parseReviewQueueTab,
} from "@/components/domain/admin-review-queue";

function AdminReviewsInner() {
  const searchParams = useSearchParams();
  const initialTab = parseReviewQueueTab(searchParams.get("tab"));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          入驻审核
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          处理设计首次入驻、企业委托人、见习晋级与等级晋级申请。
        </p>
      </div>
      <AdminReviewQueue initialTab={initialTab} />
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">加载中…</div>
      }
    >
      <AdminReviewsInner />
    </Suspense>
  );
}
