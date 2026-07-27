"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  /** 未读等角标（如消息） */
  badge?: number;
  children?: Array<{ href: string; label: string }>;
}

interface Props {
  title: string;
  subtitle: string;
  nav: ConsoleNavItem[];
  children: ReactNode;
  rightSlot?: ReactNode;
  /** 侧栏导航上方插槽（如实时取费基数卡片） */
  sidebarTop?: ReactNode;
  /** 侧栏导航下方插槽（账号操作、客服等） */
  sidebarBottom?: ReactNode;
}

function useConsoleLogout() {
  const router = useRouter();
  const logout = useRoleStore((s) => s.logout);
  const push = useSessionStore((s) => s.pushNotification);
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      push({ title: "已退出登录", variant: "success" });
      router.replace("/login");
      router.refresh();
    } catch (e) {
      push({
        title: "退出失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return { busy, handleLogout };
}

export function ConsoleShell({
  title,
  subtitle,
  nav,
  children,
  rightSlot,
  sidebarTop,
  sidebarBottom,
}: Props) {
  const pathname = usePathname();
  const { busy, handleLogout } = useConsoleLogout();

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-ink-20 bg-white lg:flex">
        <Link href="/" className="flex shrink-0 items-center gap-2 px-6 py-5">
          <BrandLogo size={36} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-ink">
              乐自由
            </span>
            <span className="text-[11px] text-ink-40">{subtitle}</span>
          </div>
        </Link>

        <div className="console-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {sidebarTop}

          <nav className="space-y-1 px-3 py-2">
            {nav.map((item) => {
              const childActive = item.children?.some((c) =>
                pathname?.startsWith(c.href),
              );
              const active =
                childActive ||
                (item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    (pathname?.startsWith(`${item.href}/`) ?? false));
              const Icon = item.icon;
              return (
                <div key={item.href} className="space-y-0.5">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-ink text-white"
                        : "text-ink-60 hover:bg-ink-20/40 hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge != null && item.badge > 0 ? (
                      <span
                        className={cn(
                          "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none",
                          active
                            ? "bg-brand text-white"
                            : "bg-brand text-white",
                        )}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </Link>
                  {item.children?.length ? (
                    <div className="ml-4 space-y-0.5 border-l border-ink-20/80 pl-2">
                      {item.children.map((child) => {
                        const subActive = pathname?.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-xs transition-colors",
                              subActive
                                ? "bg-ink-20/60 font-medium text-ink"
                                : "text-ink-60 hover:bg-ink-20/30 hover:text-ink",
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-ink-20">
          {sidebarBottom}
          <div className="space-y-2 px-3 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-60 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {busy ? "正在退出..." : "退出登录"}
            </button>
            <Link
              href="/"
              className="block px-3 text-[11px] text-ink-40 hover:text-ink"
            >
              ← 返回平台首页
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-20 bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-8">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <div className="flex items-center gap-2">
              {rightSlot}
              <button
                type="button"
                disabled={busy}
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-20 px-3 py-1.5 text-xs font-medium text-ink-60 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 lg:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                {busy ? "退出中..." : "退出"}
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-ink-20 px-3 py-2 lg:hidden">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-ink text-white"
                      : "bg-ink-20/30 text-ink-60 hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.badge != null && item.badge > 0 ? (
                    <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
