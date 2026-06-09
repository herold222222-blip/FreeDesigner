"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/** 兼容旧付款链接：重定向至订单详情并打开阶段支付弹窗 */
export default function PaymentPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 text-ink-60">
          <Loader2 className="h-5 w-5 animate-spin" />
          跳转支付...
        </div>
      }
    >
      <PaymentRedirect orderId={params.id} />
    </Suspense>
  );
}

function PaymentRedirect({ orderId }: { orderId: string }) {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const stageId = search.get("stageId");
    const q = stageId ? `?payStage=${encodeURIComponent(stageId)}` : "";
    router.replace(`/client/orders/${orderId}${q}`);
  }, [orderId, router, search]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-ink-60">
      <Loader2 className="h-5 w-5 animate-spin" />
      正在打开订单支付...
    </div>
  );
}
