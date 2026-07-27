"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";
import { canPublishEntrust } from "@/lib/publish-access";
import { canViewMemberContent } from "@/lib/guest-access";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import type { ReactNode } from "react";

/**
 * 发布需求 / 悬赏入口：
 * - 游客可见（点击弹出注册入驻提醒）
 * - 委托人 / 管理员可直接进入
 * - 设计师等其他身份不展示
 */
export function PublishEntrustCta({
  href,
  children,
  ...buttonProps
}: {
  href: string;
  children: ReactNode;
} & Omit<ButtonProps, "asChild">) {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const promptGuestAccess = useSessionStore((s) => s.promptGuestAccess);

  if (!bootstrapped) return null;
  if (role !== "guest" && !canPublishEntrust(role)) return null;

  if (!canViewMemberContent(role)) {
    return (
      <Button
        {...buttonProps}
        type="button"
        onClick={() => promptGuestAccess()}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button asChild {...buttonProps}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
