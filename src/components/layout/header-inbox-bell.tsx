"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useInboxUnreadCount } from "@/lib/use-inbox-unread";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

function messagesHref(role: Role): string | null {
  switch (role) {
    case "client":
      return "/client/messages";
    case "designer":
      return "/designer/messages";
    case "admin":
      return "/admin/messages";
    case "super_admin":
      return "/super-admin/messages";
    default:
      return null;
  }
}

/** 主站顶栏消息铃铛（未读数高亮） */
export function HeaderInboxBell() {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const { count } = useInboxUnreadCount();
  const href = messagesHref(role);

  if (!bootstrapped || !href) return null;

  return (
    <Link
      href={href}
      title={count > 0 ? `${count} 条未读消息` : "消息"}
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-medium transition-colors",
        count > 0
          ? "text-brand hover:bg-brand/10"
          : "text-ink-60 hover:bg-ink-20/40 hover:text-ink",
      )}
    >
      <Bell
        className={cn(
          "h-4 w-4",
          count > 0 && "fill-brand/20 text-brand",
        )}
      />
      {count > 0 ? (
        <span className="min-w-[1.25rem] rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : (
        <span className="hidden md:inline">消息</span>
      )}
    </Link>
  );
}
