"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { isOrderDeletable } from "@/lib/order-lifecycle";
import { deleteOrderRequest } from "@/lib/api-client";
import { invalidateApiPath } from "@/lib/use-data";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 已取消 / 已完成订单的永久删除（委托人、管理员）。
 * 删除后无法恢复。
 */
export function OrderDeleteButton({
  order,
  perspective,
  className,
  size = "sm",
  /** 删除成功后跳转（详情页用） */
  redirectTo,
  variant = "outline",
}: {
  order: Order;
  perspective: "client" | "designer" | "admin";
  className?: string;
  size?: "sm" | "default";
  redirectTo?: string;
  variant?: "outline" | "destructive";
}) {
  const router = useRouter();
  const push = useSessionStore((s) => s.pushNotification);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (perspective === "designer") return null;
  if (!isOrderDeletable(order)) return null;

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteOrderRequest(order.id);
      push({
        title: "订单已删除",
        description: "该订单已永久删除，无法恢复。",
        variant: "success",
      });
      setOpen(false);
      invalidateApiPath("/api/orders");
      invalidateApiPath(`/api/orders/${order.id}`);
      if (redirectTo) {
        router.replace(redirectTo);
      }
    } catch (e) {
      push({
        title: "删除失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(
          "gap-1 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
          size === "sm" && "h-8 px-2.5 text-xs",
          className,
        )}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除订单
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span className="pt-1">确认永久删除？</span>
            </DialogTitle>
            <DialogDescription className="pl-[2.625rem] text-sm leading-relaxed text-ink-60">
              即将删除「{order.title}」（{order.code}
              ）。删除后无法恢复，相关记录与沟通内容将一并清除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              返回
            </Button>
            <Button
              type="button"
              variant="brand"
              className="bg-rose-600 hover:bg-rose-700"
              disabled={busy}
              onClick={handleDelete}
            >
              {busy ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
