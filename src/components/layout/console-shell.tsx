"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
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

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-ink-20 bg-white lg:flex">
        <Link href="/" className="flex shrink-0 items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white">
            <Sparkles className="h-4 w-4" />
          </div>
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
                    <Icon className="h-4 w-4" />
                    {item.label}
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

          {sidebarBottom}
        </div>

        <div className="shrink-0 border-t border-ink-20 px-6 py-4 text-[11px] text-ink-40">
          <Link href="/" className="hover:text-ink">
            ← 返回平台首页
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-20 bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-8">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <div className="flex items-center gap-2">{rightSlot}</div>
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
