import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import {
  deleteDesignerForAdmin,
  getDesigner,
  setDesignerAccountStatus,
  updateDesignerForAdmin,
} from "@/lib/server/repo";
import { DESIGNER_LEVEL_META } from "@/lib/constants";
import type { Designer, DesignerLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    accountStatus: z.enum(["active", "disabled"]).optional(),
    name: z.string().min(1).max(64).optional(),
    phone: z.string().regex(/^1\d{10}$/).optional(),
    level: z.string().optional(),
    designer: z.record(z.unknown()).optional(),
  })
  .refine(
    (d) =>
      d.accountStatus != null ||
      d.name != null ||
      d.phone != null ||
      d.level != null ||
      d.designer != null,
    { message: "请提供要更新的字段" },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const existing = await getDesigner(params.id);
    if (!existing) return fail(404, "设计师不存在");

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }

    if (parsed.data.accountStatus) {
      const result = await setDesignerAccountStatus(
        params.id,
        parsed.data.accountStatus,
      );
      if (!result) {
        return fail(400, "该设计师未绑定登录账号，无法冻结 / 解冻");
      }
    }

    let designer: Designer = existing;
    if (parsed.data.designer) {
      designer = {
        ...existing,
        ...(parsed.data.designer as Partial<Designer>),
      };
    }
    if (parsed.data.level) {
      const level = parsed.data.level as DesignerLevel;
      if (!(level in DESIGNER_LEVEL_META)) {
        return fail(400, "无效的等级");
      }
      designer.level = level;
    }
    if (parsed.data.name) designer.name = parsed.data.name.trim();

    const needsDesignerSave =
      parsed.data.designer != null ||
      parsed.data.level != null ||
      parsed.data.name != null;

    if (parsed.data.phone) {
      const row = await prisma.designer.findUnique({
        where: { id: params.id },
        select: { userId: true },
      });
      if (row?.userId) {
        const dup = await prisma.user.findFirst({
          where: {
            phone: parsed.data.phone,
            NOT: { id: row.userId },
          },
        });
        if (dup) return fail(409, "该手机号已被使用");
      }
    }

    if (needsDesignerSave || parsed.data.phone) {
      const updated = await updateDesignerForAdmin(params.id, designer, {
        phone: parsed.data.phone,
        name: parsed.data.name,
      });
      if (!updated) return fail(404, "设计师不存在");
      designer = updated;
    }

    const row = await getDesigner(params.id);
    return ok(row);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("super_admin");
    const deleted = await deleteDesignerForAdmin(params.id);
    if (!deleted) return fail(404, "设计师不存在");
    return ok({ deleted: true });
  });
}
