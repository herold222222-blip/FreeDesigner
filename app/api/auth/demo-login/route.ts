import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { createSession, destroySession } from "@/lib/server/auth";
import {
  resolveDemoIdentity,
  type DemoIdentityKey,
} from "@/lib/demo-accounts";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum([
    "client",
    "designer",
    "designer_team",
    "designer_company",
    "admin",
    "super_admin",
    "guest",
  ]),
});

/**
 * 演示身份一键切换：直接以对应角色的种子账号建立真实会话。
 * 仅在 DEMO_CODE_ENABLED 未关闭时可用，生产环境应关闭。
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    if (process.env.DEMO_CODE_ENABLED === "off") {
      return fail(403, "演示模式已关闭");
    }
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return fail(400, "参数错误");

    const demoKey = parsed.data.role as DemoIdentityKey;
    const demo = resolveDemoIdentity(demoKey);

    if (demoKey === "guest") {
      await destroySession();
      return ok({ role: "guest", identityId: "" });
    }

    const phone = demo.phone;
    if (!phone) return fail(400, "演示账号配置错误");

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return fail(404, "演示账号不存在，请先执行 npm run db:seed");

    let identityId = user.id;
    if (demo.sessionRole === "designer") {
      const d = await prisma.designer.findUnique({ where: { userId: user.id } });
      identityId = d?.id ?? demo.designerId ?? user.id;
    } else if (demo.sessionRole === "client") {
      const c = await prisma.client.findUnique({ where: { userId: user.id } });
      identityId = c?.id ?? user.id;
    }

    await createSession({
      userId: user.id,
      role: demo.sessionRole,
      identityId,
    });
    return ok({ role: demo.sessionRole, identityId, name: user.name });
  });
}
