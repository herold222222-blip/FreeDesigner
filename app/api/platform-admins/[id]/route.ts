import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { hashPassword, requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    password: z.string().min(6, "密码至少 6 位").optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((d) => d.password != null || d.status != null, {
    message: "请提供要更新的字段",
  });

async function getPlatformAdmin(id: string) {
  return prisma.user.findFirst({
    where: { id, role: "admin" },
    select: {
      id: true,
      loginName: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
    },
  });
}

/** 修改密码 / 冻结解冻 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("super_admin");
    const existing = await getPlatformAdmin(params.id);
    if (!existing) return fail(404, "管理员账号不存在");

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }

    const data: { passwordHash?: string; status?: string } = {};
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
    }
    if (parsed.data.status) {
      data.status = parsed.data.status;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        loginName: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    if (parsed.data.status === "disabled" || parsed.data.password) {
      await prisma.session.deleteMany({ where: { userId: params.id } });
    }

    return ok({
      id: user.id,
      loginName: user.loginName ?? "",
      name: user.name,
      phone: user.phone,
      status: user.status as "active" | "disabled",
      createdAt: user.createdAt.toISOString().slice(0, 10),
    });
  });
}

/** 删除平台管理员 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("super_admin");
    const existing = await getPlatformAdmin(params.id);
    if (!existing) return fail(404, "管理员账号不存在");

    await prisma.session.deleteMany({ where: { userId: params.id } });
    await prisma.user.delete({ where: { id: params.id } });

    return ok({ deleted: true });
  });
}
