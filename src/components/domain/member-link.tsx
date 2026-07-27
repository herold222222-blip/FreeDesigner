"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { canViewMemberContent } from "@/lib/guest-access";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";

type MemberLinkProps = ComponentProps<typeof Link>;

/**
 * 需入驻后才可跳转的链接。
 * 游客点击时拦截并弹出注册入驻提醒，停留当前页。
 */
export function MemberLink({ href, onClick, children, ...rest }: MemberLinkProps) {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const promptGuestAccess = useSessionStore((s) => s.promptGuestAccess);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (!bootstrapped || !canViewMemberContent(role)) {
      e.preventDefault();
      promptGuestAccess();
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
