"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessionStore } from "@/store/session-store";

/** 全局错误提示对话框：由 pushNotification({ variant: "destructive" }) 触发 */
export function ErrorAlertDialog() {
  const error = useSessionStore((s) => s.errorDialog);
  const dismiss = useSessionStore((s) => s.dismissErrorDialog);

  return (
    <Dialog
      open={Boolean(error)}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2.5 text-ink">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="pt-1">{error?.title ?? "提示"}</span>
          </DialogTitle>
          {error?.description ? (
            <DialogDescription className="pl-[2.625rem] text-sm leading-relaxed text-ink-60">
              {error.description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">错误提示</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="brand" className="min-w-24" onClick={dismiss}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
