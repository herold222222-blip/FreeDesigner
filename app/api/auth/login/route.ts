import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { verifyCode } from "@/lib/server/verification";
import {
  createSession,
  listBusinessRoles,
  verifyPassword,
} from "@/lib/server/auth";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    phone: z.string().optional(),
    loginName: z.string().optional(),
    code: z.string().optional(),
    password: z.string().optional(),
    /** 可选：仅在双重身份选择后由前端传入，登录时不要传 */
    role: z.enum(["client", "designer", "admin", "super_admin"]).optional(),
  })
  .refine((data) => Boolean(data.phone || data.loginName), {
    message: "请提供手机号或登录账号",
  });

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

function roleHome(role: Role) {
  if (role === "client") return "/client";
  if (role === "designer") return "/designer";
  if (role === "admin") return "/admin";
  return "/super-admin";
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

    if (loginName || password) {
      if (!password) return fail(400, "请输入密码");
      if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return fail(401, "密码错误");
      }
    } else if (code) {
      const valid = await verifyCode(phone!, code, "login");
      if (!valid) return fail(401, "验证码错误或已过期");
    } else {
      return fail(400, "请提供验证码或密码");
    }

    const isAdmin =
      user.role === "admin" || user.role === "super_admin";
    const businessRoles = isAdmin ? [] : await listBusinessRoles(user.id);

    let targetRole: Role;
    let needsRolePick = false;
    let needsOnboarding = false;
    const availableRoles: Role[] = [];

    if (isAdmin) {
      // 管理员不允许用「选委托人/设计师」覆盖权限
      if (role === "client" || role === "designer") {
        return fail(403, "管理员账号请使用管理后台身份登录");
      }
      if (role === "admin" && user.role !== "admin" && user.role !== "super_admin") {
        return fail(403, "该账号无管理员权限");
      }
      if (role === "super_admin" && user.role !== "super_admin") {
        return fail(403, "该账号无超级管理员权限");
      }
      targetRole = (role ?? (user.role as Role)) as Role;
      availableRoles.push(targetRole);
    } else if (role === "client" || role === "designer") {
      if (!businessRoles.includes(role)) {
        return fail(400, "当前账号未具备该角色身份");
      }
      targetRole = role;
      availableRoles.push(...businessRoles);
    } else if (businessRoles.length === 0) {
      // 普通空账号：登录后引导注册委托人/设计师
      targetRole = "client";
      needsOnboarding = true;
    } else if (businessRoles.length === 1) {
      targetRole = businessRoles[0];
      availableRoles.push(...businessRoles);
    } else {
      // 双重身份：先建会话，前端弹窗选择
      targetRole =
        user.role === "designer" && businessRoles.includes("designer")
          ? "designer"
          : "client";
      availableRoles.push(...businessRoles);
      needsRolePick = true;
    }

    const identityId = (await resolveIdentity(user.id, targetRole)) ?? user.id;

    await createSession({ userId: user.id, role: targetRole, identityId });

    return ok({
      userId: user.id,
      role: targetRole,
      identityId,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      availableRoles,
      needsRolePick,
      needsOnboarding,
      redirectTo: needsRolePick || needsOnboarding ? null : roleHome(targetRole),
    });
  });
}
