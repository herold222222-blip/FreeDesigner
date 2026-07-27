import type { Role } from "@/lib/types";

/** 已登录并入驻的业务身份（含管理员）可离开主页访问站内功能 */
export function canViewMemberContent(role: Role): boolean {
  return role !== "guest";
}

/** 游客允许停留的路径：首页与登录/注册/入驻流程 */
export function isGuestAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/onboarding")) return true;
  return false;
}

export const GUEST_ACCESS_COPY = {
  title: "请先注册并完成入驻",
  description:
    "游客目前仅可浏览平台首页。打开设计师、悬赏大厅、发布需求或进入其他页面，需先注册账号并完成委托人/设计师入驻。",
} as const;
