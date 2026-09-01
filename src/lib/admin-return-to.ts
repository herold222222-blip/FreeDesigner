/** 管理后台从用户管理列表跳转时携带的返回路径 */

const USER_LIST_PATHS = new Set(["/admin/users", "/super-admin/users"]);

export type AdminUsersTab = "designers" | "clients" | "admins";

export function buildAdminUsersReturnTo(
  consoleBase: string,
  tab?: AdminUsersTab,
): string {
  if (!tab || tab === "designers") return `${consoleBase}/users`;
  return `${consoleBase}/users?tab=${tab}`;
}

export function parseAdminUsersReturnTo(param: string | null): string | null {
  if (!param || !param.startsWith("/")) return null;
  const [path, search = ""] = param.split("?");
  if (!USER_LIST_PATHS.has(path)) return null;
  const qs = search.trim();
  return qs ? `${path}?${qs}` : path;
}

export function withReturnTo(path: string, returnTo: string): string {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("returnTo", returnTo);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** 委托人从悬赏报名列表进入设计师主页时的返回路径 */
export function parseClientBountyReturnTo(param: string | null): string | null {
  if (!param || !param.startsWith("/") || param.startsWith("//")) return null;
  const path = param.split("?")[0];
  if (!/^\/client\/bounties\/[^/]+$/.test(path)) return null;
  return path;
}

/** 从订单详情进入设计师主页时的返回路径 */
export function parseOrderReturnTo(param: string | null): string | null {
  if (!param || !param.startsWith("/") || param.startsWith("//")) return null;
  const path = param.split("?")[0];
  if (
    /^\/client\/orders\/[^/]+$/.test(path) ||
    /^\/designer\/orders\/[^/]+$/.test(path) ||
    /^\/admin\/orders\/[^/]+$/.test(path)
  ) {
    return path;
  }
  return null;
}

/** 设计师从「悬赏订单」进入公开大厅时的返回路径 */
export function parseDesignerBountiesReturnTo(
  param: string | null,
): string | null {
  if (!param || !param.startsWith("/") || param.startsWith("//")) return null;
  const path = param.split("?")[0];
  return path === "/designer/bounties" ? path : null;
}
