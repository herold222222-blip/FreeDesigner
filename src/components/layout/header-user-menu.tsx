"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Repeat, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMe } from "@/lib/api-client";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";

type BusinessRole = "client" | "designer";

function workbenchHref(role: Role): string {
  switch (role) {
    case "client":
      return "/client";
    case "designer":
      return "/designer";
    case "super_admin":
      return "/super-admin";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

function roleHomeLabel(role: Role) {
  if (role === "client") return "委托人工作台";
  if (role === "designer") return "设计师工作台";
  if (role === "admin") return "管理员工作台";
  if (role === "super_admin") return "超级管理员工作台";
  return "工作台";
}

export function HeaderUserMenu({
  role,
  name,
  avatar,
}: {
  role: Role;
  name: string;
  avatar?: string | null;
}) {
  const router = useRouter();
  const switchRole = useRoleStore((s) => s.switchRole);
  const logout = useRoleStore((s) => s.logout);
  const push = useSessionStore((s) => s.pushNotification);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<BusinessRole[]>([]);
  const [busy, setBusy] = useState<"switch" | "logout" | null>(null);

  useEffect(() => {
    let active = true;
    fetchMe()
      .then(({ user }) => {
        if (!active || !user) return;
        setAvailableRoles(
          (user.availableRoles ?? []).filter(
            (r): r is BusinessRole => r === "client" || r === "designer",
          ),
        );
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const otherRole: BusinessRole | null =
    role === "client" ? "designer" : role === "designer" ? "client" : null;
  const canSwitchBusiness =
    otherRole !== null && availableRoles.includes(otherRole);
  const canAttachOther =
    otherRole !== null && !availableRoles.includes(otherRole);
  const showIdentityAction = otherRole !== null;

  const endSession = async () => {
    if (busy) return;
    setBusy("logout");
    try {
      await logout();
      setOpen(false);
      push({
        title: "已退出登录",
        variant: "success",
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSwitchIdentity = async () => {
    if (!otherRole || busy) return;
    if (!canSwitchBusiness) {
      setOpen(false);
      router.push(
        otherRole === "client"
          ? "/login?register=1&attach=1&focus=client"
          : "/login?register=1&attach=1&focus=designer",
      );
      return;
    }
    setBusy("switch");
    try {
      await switchRole(otherRole);
      setOpen(false);
      push({
        title: `已切换为${otherRole === "client" ? "委托人" : "设计师"}`,
        variant: "success",
      });
      router.push(workbenchHref(otherRole));
      router.refresh();
    } catch (e) {
      push({
        title: "切换身份失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full py-1 pl-0.5 pr-1.5 transition-colors hover:bg-ink-20/40"
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar className="h-8 w-8 border border-ink-20">
          {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
          <AvatarFallback className="bg-ink-20/50 text-xs font-medium text-ink">
            {name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-[8rem] truncate text-sm font-medium text-ink">
          {name}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-ink-40 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-ink-20 bg-white p-1.5 shadow-lg"
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            <div className="text-xs text-ink-40">{roleHomeLabel(role)}</div>
          </div>
          <div className="my-1 h-px bg-ink-20" />
          <Link
            href={workbenchHref(role)}
            role="menuitem"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-ink-20/50"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4 text-ink-40" />
            进入工作台
          </Link>
          {showIdentityAction ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-ink-20/50 disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void handleSwitchIdentity()}
            >
              {canAttachOther ? (
                <UserPlus className="h-4 w-4 text-ink-40" />
              ) : (
                <Repeat className="h-4 w-4 text-ink-40" />
              )}
              {busy === "switch"
                ? "正在切换..."
                : canSwitchBusiness
                  ? `切换为${otherRole === "client" ? "委托人" : "设计师"}`
                  : `入驻${otherRole === "client" ? "委托人" : "设计师"}身份`}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => void endSession()}
          >
            <LogOut className="h-4 w-4" />
            {busy === "logout" ? "正在退出..." : "退出登录"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
