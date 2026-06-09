import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import {
  deleteClientForAdmin,
  getClient,
  setClientAccountStatus,
  updateClientForAdmin,
} from "@/lib/server/repo";
import { CLIENT_LEVEL_META } from "@/lib/constants";
import type { Client, ClientLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    accountStatus: z.enum(["active", "disabled"]).optional(),
    name: z.string().min(1).max(64).optional(),
    phone: z.string().regex(/^1\d{10}$/).optional(),
    level: z.string().optional(),
    client: z.record(z.unknown()).optional(),
  })
  .refine(
    (d) =>
      d.accountStatus != null ||
      d.name != null ||
      d.phone != null ||
      d.level != null ||
      d.client != null,
    { message: "请提供要更新的字段" },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const existing = await getClient(params.id);
    if (!existing) return fail(404, "委托人不存在");

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }

    if (parsed.data.accountStatus) {
      const result = await setClientAccountStatus(
        params.id,
        parsed.data.accountStatus,
      );
      if (!result) {
        return fail(400, "该委托人未绑定登录账号，无法冻结 / 解冻");
      }
    }

    let client: Client = existing;
    if (parsed.data.client) {
      client = {
        ...existing,
        ...(parsed.data.client as Partial<Client>),
      };
    }
    if (parsed.data.level) {
      const level = parsed.data.level as ClientLevel;
      if (!(level in CLIENT_LEVEL_META)) {
        return fail(400, "无效的等级");
      }
      client.level = level;
    }
    if (parsed.data.name) client.name = parsed.data.name.trim();

    const needsClientSave =
      parsed.data.client != null ||
      parsed.data.level != null ||
      parsed.data.name != null;

    if (parsed.data.phone) {
      const row = await prisma.client.findUnique({
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

    if (needsClientSave || parsed.data.phone) {
      const updated = await updateClientForAdmin(params.id, client, {
        phone: parsed.data.phone,
        name: parsed.data.name,
      });
      if (!updated) return fail(404, "委托人不存在");
      client = updated;
    }

    const row = await getClient(params.id);
    return ok(row);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("super_admin");
    const deleted = await deleteClientForAdmin(params.id);
    if (!deleted) return fail(404, "委托人不存在");
    return ok({ deleted: true });
  });
}
