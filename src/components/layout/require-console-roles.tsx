"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/api-client";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/lib/types";

/** 按服务端会话校验工作台身份，避免本地缓存角色与 cookie 不一致 */
export function RequireConsoleRoles({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const router = useRouter();
  const setRole = useRoleStore((s) => s.setRole);
  const [allowed, setAllowed] = useState(false);
  const roleKey = roles.join(",");

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(({ user }) => {
        if (cancelled) return;
        if (!user || !roles.includes(user.role)) {
          router.replace("/login");
          return;
        }
        setRole(user.role, user.identityId);
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
    // roleKey 避免调用方每次渲染传入新数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey, router, setRole]);

  if (!allowed) {
    return (
      <div className="py-20 text-center text-sm text-ink-60">
        正在验证管理员身份...
      </div>
    );
  }

  return <>{children}</>;
}
