"use client";

import {
  canViewDesignerFullContact,
  resolveDesignerDisplayContactName,
  resolveDesignerDisplayName,
  resolveDesignerDisplayPhone,
} from "@/lib/designer-contact-privacy";
import type { Designer } from "@/lib/types";
import { useRoleStore } from "@/store/role-store";

export function useDesignerContactPrivacy(
  designer: Pick<Designer, "id" | "name" | "phone" | "contactName">,
) {
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const viewer = { role, identityId };

  const canViewFull = canViewDesignerFullContact(role, identityId, designer.id);

  return {
    canViewFull,
    displayName: resolveDesignerDisplayName(designer, viewer),
    displayPhone: resolveDesignerDisplayPhone(designer.phone, designer.id, viewer),
    displayContactName: resolveDesignerDisplayContactName(
      designer.contactName,
      designer.id,
      viewer,
    ),
  };
}
