"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRoleStore } from "@/store/role-store";

function adminWorkbench(role: string) {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return null;
}

/** 管理员 / 超级管理员进入公开页时，直接转到对应工作台 */
export function AdminConsoleRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) return;
    const home = adminWorkbench(role);
    if (!home) return;
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/super-admin")) {
      return;
    }
    router.replace(home);
  }, [bootstrapped, role, pathname, router]);

  return null;
}
