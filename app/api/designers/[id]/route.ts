import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getSessionUser, requireRole } from "@/lib/server/auth";
import { redactDesignerContactFields } from "@/lib/designer-contact-privacy";
import { getDesigner, updateDesignerLevel } from "@/lib/server/repo";
import { DESIGNER_LEVEL_META } from "@/lib/constants";
import type { DesignerLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await getSessionUser();
    const viewer = session
      ? { role: session.role, identityId: session.identityId }
      : null;
    const designer = await getDesigner(params.id);
    if (!designer) return fail(404, "设计师不存在");
    return ok(redactDesignerContactFields(designer, viewer));
  });
}

/** 管理员 / 超级管理员设置设计师等级 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json().catch(() => ({}))) as { level?: string };
    const level = body.level as DesignerLevel | undefined;
    if (!level || !(level in DESIGNER_LEVEL_META)) {
      return fail(400, "无效的等级");
    }
    const designer = await updateDesignerLevel(params.id, level);
    if (!designer) return fail(404, "设计师不存在");
    return ok(designer);
  });
}
