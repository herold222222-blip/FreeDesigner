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
