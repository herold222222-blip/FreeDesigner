"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ScanOrderPayPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">
          正在跳转支付...
        </div>
      }
    >
      <ScanOrderPayRedirect />
    </Suspense>
  );
}

function ScanOrderPayRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("id");

  useEffect(() => {
    if (orderId) {
      router.replace(`/client/orders/${orderId}`);
    } else {
      router.replace("/client/orders");
    }
  }, [orderId, router]);

  return (
    <div className="container-page py-20 text-center text-ink-60">
      请在订单详情页完成签约与阶段支付。
    </div>
  );
}
