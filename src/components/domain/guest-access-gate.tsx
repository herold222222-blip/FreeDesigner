"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  canViewMemberContent,
  GUEST_ACCESS_COPY,
} from "@/lib/guest-access";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import type { ReactNode } from "react";

/** 拦截游客直接打开需入驻后才可访问的页面 */
export function GuestAccessGate({
  children,
  intent,
}: {
  children: ReactNode;
  /** 用于文案微调，如「发布需求」 */
  intent?: "publish" | "detail" | "browse";
}) {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const pathname = usePathname();
  const router = useRouter();
  const promptGuestAccess = useSessionStore((s) => s.promptGuestAccess);

  useEffect(() => {
    if (!bootstrapped || canViewMemberContent(role)) return;
    promptGuestAccess();
    router.replace("/");
  }, [bootstrapped, role, promptGuestAccess, router]);

  if (!bootstrapped) {
    return (
      <div className="container-page py-20 text-center text-sm text-ink-60">
        正在确认登录状态...
      </div>
    );
  }

  if (canViewMemberContent(role)) {
    return <>{children}</>;
  }

  const title =
    intent === "publish"
      ? "发布需求需先注册入驻"
      : intent === "browse"
        ? "浏览更多内容需先注册入驻"
        : GUEST_ACCESS_COPY.title;
  const description =
    intent === "publish"
      ? "发布常规委托或悬赏前，请先注册账号并完成委托人入驻。"
      : GUEST_ACCESS_COPY.description;

  const loginHref = `/login?register=1&redirect=${encodeURIComponent(pathname || "/")}`;

  return (
    <div className="container-page flex min-h-[50vh] items-center justify-center py-16">
      <Card className="max-w-lg space-y-5 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-20/60 text-ink">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-ink-60">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="brand">
            <Link href={loginHref}>去注册 / 登录</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">返回首页</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
