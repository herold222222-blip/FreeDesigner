"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GUEST_ACCESS_COPY } from "@/lib/guest-access";
import { useSessionStore } from "@/store/session-store";

/** 游客尝试离页访问时的注册入驻提醒 */
export function GuestAccessDialog() {
  const open = useSessionStore((s) => s.guestAccessPromptOpen);
  const dismiss = useSessionStore((s) => s.dismissGuestAccessPrompt);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2.5 text-ink">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-20/70 text-ink">
              <UserPlus className="h-4 w-4" />
            </span>
            <span className="pt-1">{GUEST_ACCESS_COPY.title}</span>
          </DialogTitle>
          <DialogDescription className="pl-[2.625rem] text-sm leading-relaxed text-ink-60">
            {GUEST_ACCESS_COPY.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={dismiss}>
            继续浏览首页
          </Button>
          <Button asChild variant="brand" onClick={dismiss}>
            <Link href="/login?register=1">去注册 / 登录</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
