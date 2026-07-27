import type { Role } from "@/lib/types";

/** 仅委托人与管理员可发布需求 / 悬赏 */
export function canPublishEntrust(role: Role): boolean {
  return role === "client" || role === "admin" || role === "super_admin";
}
