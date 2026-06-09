import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { verifyCode } from "@/lib/server/verification";
import { createSession, verifyPassword } from "@/lib/server/auth";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    phone: z.string().optional(),
    loginName: z.string().optional(),
    code: z.string().optional(),
    password: z.string().optional(),
    role: z.enum(["client", "designer", "admin", "super_admin"]).optional(),
  })
  .refine((data) => Boolean(data.phone || data.loginName), {
    message: "请提供手机号或登录账号",
  });

/** 根据账号已有资料，推导该角色对应的业务身份 id */
async function resolveIdentity(userId: string, role: Role): Promise<string | null> {
  if (role === "designer") {
    const d = await prisma.designer.findUnique({ where: { userId } });
    return d?.id ?? null;
  }
  if (role === "client") {
    const c = await prisma.client.findUnique({ where: { userId } });
    return c?.id ?? null;
  }
  return userId;
}

async function findUserByCredential(phone?: string, loginName?: string) {
  if (loginName) {
    return prisma.user.findFirst({
      where: { loginName: loginName.trim() },
    });
  }
  if (phone) {
    return prisma.user.findUnique({ where: { phone } });
  }
  return null;
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const { phone, loginName, code, password, role } = parsed.data;

    const user = await findUserByCredential(phone, loginName);
    if (!user) {
      return fail(404, loginName ? "登录账号不存在" : "该手机号尚未注册");
    }
    if (user.status === "disabled") {
      return fail(403, "账号已被禁用");
    }

    if (loginName) {
      if (!password) return fail(400, "请输入密码");
      if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return fail(401, "密码错误");
      }
    } else if (password) {
      if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return fail(401, "密码错误");
      }
    } else if (code) {
      const valid = await verifyCode(phone!, code, "login");
      if (!valid) return fail(401, "验证码错误或已过期");
    } else {
      return fail(400, "请提供验证码或密码");
    }

    const targetRole = (role ?? (user.role as Role)) as Role;

    if (loginName) {
      if (targetRole === "admin" && user.role !== "admin" && user.role !== "super_admin") {
        return fail(403, "该账号无管理员权限");
      }
      if (targetRole === "super_admin" && user.role !== "super_admin") {
        return fail(403, "该账号无超级管理员权限");
      }
    }

    const identityId = (await resolveIdentity(user.id, targetRole)) ?? user.id;

    await createSession({ userId: user.id, role: targetRole, identityId });

    return ok({
      userId: user.id,
      role: targetRole,
      identityId,
      name: user.name,
      avatar: user.avatar,
    });
  });
}
