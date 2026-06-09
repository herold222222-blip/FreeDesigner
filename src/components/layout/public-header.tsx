"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMe } from "@/lib/api-client";
import type { Role } from "@/lib/types";
import { useRoleStore } from "@/store/role-store";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { cn } from "@/lib/utils";

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

function resolveProfileFallback(role: Role) {
  if (role === "client") return { name: "委托人", avatar: null };
  if (role === "designer") return { name: "设计师", avatar: null };
  if (role === "admin") return { name: "平台管理员", avatar: null };
  if (role === "super_admin") return { name: "超级管理员", avatar: null };
  return { name: "用户", avatar: null };
}

const NAV = [
  { href: "/designers", label: "找设计" },
  { href: "/bounties", label: "悬赏大厅" },
  { href: "/entrust/new", label: "发布需求" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const [hydrated, setHydrated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!bootstrapped || role === "guest") {
      setUserName(null);
      setUserAvatar(null);
      return;
    }

    let cancelled = false;
    fetchMe()
      .then(({ user }) => {
        if (cancelled) return;
        if (user?.name) {
          setUserName(user.name);
          setUserAvatar(user.avatar ?? null);
          return;
        }
        const fallback = resolveProfileFallback(role);
        setUserName(fallback.name);
        setUserAvatar(fallback.avatar);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = resolveProfileFallback(role);
        setUserName(fallback.name);
        setUserAvatar(fallback.avatar);
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, role, identityId]);

  const displayProfile = useMemo(() => {
    if (role === "guest") return null;
    if (userName) return { name: userName, avatar: userAvatar };
    return resolveProfileFallback(role);
  }, [role, identityId, userName, userAvatar]);

  const authReady = hydrated && bootstrapped;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-20 bg-white/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight text-ink">
              乐自由
            </span>
            <span className="text-[11px] text-ink-40">工程设计 · 服务对接平台</span>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-ink-60 transition-colors hover:text-ink",
                pathname?.startsWith(n.href) && "bg-ink-20/40 text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {authReady && role === "client" ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5"
              title="我的收藏"
            >
              <Link href="/client/favorites">
                <Heart className="h-4 w-4" />
                <span className="hidden md:inline">收藏</span>
              </Link>
            </Button>
          ) : null}
          <LanguageSwitcher />
          {authReady && role !== "guest" ? (
            <div className="flex items-center gap-2">
              {displayProfile ? (
                <div className="flex items-center gap-2" title={displayProfile.name}>
                  <Avatar className="h-8 w-8 border border-ink-20">
                    {displayProfile.avatar ? (
                      <AvatarImage
                        src={displayProfile.avatar}
                        alt={displayProfile.name}
                      />
                    ) : null}
                    <AvatarFallback className="bg-ink-20/50 text-xs font-medium text-ink">
                      {displayProfile.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[8rem] truncate text-sm font-medium text-ink">
                    {displayProfile.name}
                  </span>
                </div>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href={workbenchHref(role)}>我的工作台</Link>
              </Button>
            </div>
          ) : authReady ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">登录</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login?register=1">立即入驻</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
