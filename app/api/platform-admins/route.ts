import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { hashPassword, requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function toDto(user: {
  id: string;
  loginName: string | null;
  name: string;
  phone: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    loginName: user.loginName ?? "",
    name: user.name,
    phone: user.phone,
    status: user.status as "active" | "disabled",
    createdAt: user.createdAt.toISOString().slice(0, 10),
  };
}

const createSchema = z.object({
  loginName: z
    .string()
    .min(3, "登录账号至少 3 个字符")
    .max(32, "登录账号最多 32 个字符")
    .regex(/^[A-Za-z0-9_]+$/, "登录账号仅支持字母、数字与下划线"),
  name: z.string().min(1, "请输入姓名").max(32),
  password: z.string().min(6, "密码至少 6 位"),
  phone: z
    .string()
    .regex(/^1\d{10}$/, "请输入 11 位手机号")
    .optional(),
});

/** 平台管理员列表（仅超级管理员） */
export async function GET() {
  return handle(async () => {
    await requireRole("super_admin");
    const users = await prisma.user.findMany({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        loginName: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });
    return ok(users.map(toDto));
  });
}

/** 添加平台管理员 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole("super_admin");
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const { loginName, name, password, phone: phoneInput } = parsed.data;
    const login = loginName.trim();

    const dupLogin = await prisma.user.findFirst({
      where: { loginName: login },
    });
    if (dupLogin) return fail(409, "该登录账号已存在");

    let phone = phoneInput;
    if (phone) {
      const dupPhone = await prisma.user.findUnique({ where: { phone } });
      if (dupPhone) return fail(409, "该手机号已被使用");
    } else {
      for (let i = 0; i < 5; i++) {
        const candidate = `137${String(Date.now() + i).slice(-8)}`;
        const exists = await prisma.user.findUnique({ where: { phone: candidate } });
        if (!exists) {
          phone = candidate;
          break;
        }
      }
      if (!phone) return fail(500, "无法生成唯一手机号，请手动填写");
    }

    const user = await prisma.user.create({
      data: {
        phone,
        loginName: login,
        passwordHash: await hashPassword(password),
        name: name.trim(),
        role: "admin",
        status: "active",
        avatar: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(name)}&backgroundColor=1f2937&textColor=ffffff`,
      },
      select: {
        id: true,
        loginName: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    return ok(toDto(user));
  });
}
