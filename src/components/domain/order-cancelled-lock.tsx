"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { isOrderCancelled } from "@/lib/order-lifecycle";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderCancelledBanner({
  order,
}: {
  order: Pick<Order, "status">;
}) {
  if (!isOrderCancelled(order)) return null;
  return (
    <Card className="flex items-start gap-3 border-ink-20 bg-ink-20/50 p-4">
      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-ink-60" />
      <div>
        <div className="text-sm font-semibold text-ink">订单已取消</div>
        <p className="mt-0.5 text-xs text-ink-60">
          本订单已取消，仅可查看历史信息，不可进行任何操作。
        </p>
      </div>
    </Card>
  );
}

/**
 * 已取消订单锁定层：禁用内部全部输入框、按钮与链接点击。
 * 返回列表等导航请放在本组件外部。
 */
export function OrderInteractionLock({
  order,
  children,
  className,
}: {
  order: Pick<Order, "status">;
  children: ReactNode;
  className?: string;
}) {
  const locked = isOrderCancelled(order);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (locked) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [locked]);

  return (
    <div
      ref={ref}
      aria-disabled={locked || undefined}
      className={cn(
        locked && "pointer-events-none select-none opacity-90",
        className,
      )}
    >
      {children}
    </div>
  );
}
