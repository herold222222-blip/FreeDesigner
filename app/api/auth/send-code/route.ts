import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { sendVerificationCode } from "@/lib/server/verification";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  purpose: z.enum(["login", "register"]).default("login"),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const result = await sendVerificationCode(parsed.data.phone, parsed.data.purpose);
    return ok(result);
  });
}
