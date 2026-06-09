"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ScanOrderContractPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">
          正在跳转订单详情...
        </div>
      }
    >
      <ScanOrderContractRedirect />
    </Suspense>
  );
}

function ScanOrderContractRedirect() {
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
      扫码订单已并入平台订单，正在跳转...
    </div>
  );
}
