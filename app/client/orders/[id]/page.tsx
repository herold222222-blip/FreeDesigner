"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrder } from "@/lib/use-data";
import { isBountySourcedOrder } from "@/lib/unified-project-list";
import { ClientOrderDetailInner } from "@/components/domain/client-order-detail-inner";

export default function ClientOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink-60">加载订单...</div>}>
      <ClientOrderDetailGate id={params.id} />
    </Suspense>
  );
}

function ClientOrderDetailGate({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: order, loading } = useOrder(id);

  useEffect(() => {
    if (order && isBountySourcedOrder(order) && order.bountyId) {
      const qs = searchParams.toString();
      router.replace(
        `/client/bounties/${order.bountyId}${qs ? `?${qs}` : ""}`,
      );
    }
  }, [order, router, searchParams]);

  if (loading) {
    return (
      <div className="py-20 text-center text-ink-60">正在加载订单详情...</div>
    );
  }
  if (order && isBountySourcedOrder(order) && order.bountyId) {
    return (
      <div className="py-20 text-center text-ink-60">正在前往悬赏项目...</div>
    );
  }
  return <ClientOrderDetailInner id={id} />;
}
