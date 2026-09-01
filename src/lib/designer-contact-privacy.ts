import type { Designer, Role } from "@/lib/types";

/** 管理员 / 超级管理员可查看设计师完整姓名与联系方式 */
export function canViewDesignerFullContact(
  viewerRole: Role,
  viewerIdentityId?: string | null,
  designerId?: string,
): boolean {
  if (viewerRole === "admin" || viewerRole === "super_admin") return true;
  if (
    viewerRole === "designer" &&
    viewerIdentityId &&
    designerId &&
    viewerIdentityId === designerId
  ) {
    return true;
  }
  return false;
}

/** 对外展示：取姓名首字 + 「工」，如 陈牧之 → 陈工 */
export function maskDesignerPublicName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return `${trimmed.charAt(0)}工`;
}

/**
 * 项目订单场景：双方最终签约前对外显示「某工」，签约后可展示全名。
 * 管理员 / 设计师本人的全名由调用方或 DesignerName 的权限判断处理。
 */
export function resolveProjectDesignerName(
  name: string,
  revealFullName = false,
): string {
  if (revealFullName) {
    const trimmed = name.trim();
    return trimmed || "设计师";
  }
  return maskDesignerPublicName(name);
}

/** 手机号数字全部替换为 * */
export function maskPhoneDigits(phone: string): string {
  return phone.replace(/\d/g, "*");
}

/** 签约前对外隐藏电话；reveal 且号码仍含数字时才可拨打 */
export function resolveVisiblePhone(
  phone: string | undefined | null,
  reveal: boolean,
): { display: string; href?: string } | null {
  if (!phone?.trim()) return null;
  const normalized = phone.replace(/\s/g, "");
  if (reveal && /\d/.test(normalized)) {
    return { display: normalized, href: `tel:${normalized}` };
  }
  return { display: maskPhoneDigits(normalized) };
}

/** 正文里的大陆手机号一并打码 */
export function maskPhonesInText(text: string): string {
  return text.replace(/1[3-9]\d{9}/g, (m) => maskPhoneDigits(m));
}

export function resolveDesignerDisplayName(
  designer: Pick<Designer, "id" | "name">,
  viewer?: { role: Role; identityId?: string | null } | null,
): string {
  if (canViewDesignerFullContact(viewer?.role ?? "guest", viewer?.identityId, designer.id)) {
    return designer.name;
  }
  return maskDesignerPublicName(designer.name);
}

export function resolveDesignerDisplayPhone(
  phone: string | undefined,
  designerId: string,
  viewer?: { role: Role; identityId?: string | null } | null,
): string | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\s/g, "");
  if (
    canViewDesignerFullContact(viewer?.role ?? "guest", viewer?.identityId, designerId)
  ) {
    return normalized;
  }
  return maskPhoneDigits(normalized);
}

export function resolveDesignerDisplayContactName(
  contactName: string | undefined,
  designerId: string,
  viewer?: { role: Role; identityId?: string | null } | null,
): string | undefined {
  if (!contactName?.trim()) return undefined;
  if (canViewDesignerFullContact(viewer?.role ?? "guest", viewer?.identityId, designerId)) {
    return contactName.trim();
  }
  return maskDesignerPublicName(contactName);
}

/** 服务端 API：对非授权角色脱敏联系方式字段（姓名仍由前端展示层处理） */
export function redactDesignerContactFields(
  designer: Designer,
  viewer?: { role: Role; identityId?: string | null } | null,
): Designer {
  if (canViewDesignerFullContact(viewer?.role ?? "guest", viewer?.identityId, designer.id)) {
    return designer;
  }
  return {
    ...designer,
    phone: designer.phone
      ? maskPhoneDigits(designer.phone.replace(/\s/g, ""))
      : undefined,
    contactName: designer.contactName
      ? maskDesignerPublicName(designer.contactName)
      : undefined,
  };
}
