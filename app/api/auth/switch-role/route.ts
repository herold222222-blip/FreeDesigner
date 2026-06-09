import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireSession, switchSessionRole } from "@/lib/server/auth";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["client", "designer", "admin", "super_admin"]),
  identityId: z.string().optional(),
});

async function resolveIdentity(userId: string, role: Role, override?: string) {
  if (override) return override;
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

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const { role, identityId } = parsed.data;
    const resolved = await resolveIdentity(session.userId, role, identityId);
    if (!resolved) {
      return fail(400, "当前账号未具备该角色身份");
    }
    await switchSessionRole(role, resolved);
    return ok({ role, identityId: resolved });
  });
}
