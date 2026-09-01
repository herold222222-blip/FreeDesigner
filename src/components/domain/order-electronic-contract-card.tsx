"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  canViewSignedContract,
  contractPageHref,
  isContractFullySigned,
  needsClientSign,
  needsDesignerSign,
} from "@/lib/order-lifecycle";
import type { Order } from "@/lib/types";

export function OrderElectronicContractCard({
  order,
  party,
}: {
  order: Order;
  party: "client" | "designer";
}) {
  const needsSign =
    party === "designer" ? needsDesignerSign(order) : needsClientSign(order);
  const canView = canViewSignedContract(order, party);

  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-ink-40">电子合同</div>
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-ink-20 p-3">
        <FileSignature className="mt-0.5 h-4 w-4 text-brand" />
        <div>
          <div className="text-sm font-medium text-ink">
            {order.contractId || "尚未生成"}
          </div>
          <div className="text-xs text-ink-60">{contractStatusHint(order)}</div>
        </div>
      </div>
      {needsSign ? (
        <Button asChild variant="brand" size="sm" className="mt-3 w-full">
          <Link href={contractPageHref(order)}>签署电子合同</Link>
        </Button>
      ) : canView ? (
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link href={contractPageHref(order)}>在线查阅合同</Link>
        </Button>
      ) : null}
    </Card>
  );
}

function contractStatusHint(order: Order) {
  if (isContractFullySigned(order)) return "已签署 · 永久存档";
  if (!order.contractId) return "尚未生成";
  if (order.clientSignedContract && !order.designerSignedContract) {
    return "已生成 · 委托人已经签署";
  }
  if (order.designerSignedContract && !order.clientSignedContract) {
    return "已生成 · 设计师已经签署";
  }
  return "已生成 · 待签署完成";
}
