"use client";

import * as React from "react";
import { useSessionStore } from "@/store/session-store";
import { CheckCircle2, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const notifications = useSessionStore((s) => s.notifications);
  const dismiss = useSessionStore((s) => s.dismissNotification);
  /** 错误已改走 ErrorAlertDialog，此处仅展示成功 / 普通提示 */
  const toasts = notifications.filter((n) => n.variant !== "destructive");

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[100] flex max-w-sm flex-col items-end gap-3">
      {toasts.map((n) => {
        const Icon = n.variant === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={n.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-ink-20 bg-white p-4 shadow-xl animate-fade-in",
              n.variant === "success" && "border-emerald-200",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                n.variant === "success" ? "text-emerald-600" : "text-ink-60",
              )}
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">{n.title}</div>
              {n.description ? (
                <div className="mt-0.5 text-xs text-ink-60">{n.description}</div>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="rounded-full p-1 text-ink-40 transition-colors hover:bg-ink-20/40 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
