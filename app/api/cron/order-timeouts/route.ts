import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { processAllOrderTimeouts } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 定时处理订单超时（10 天验收 / 30 天结案 / 评价期结束） */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) return fail(503, "未配置 CRON_SECRET");

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) return fail(401, "无效的 cron 密钥");

    const result = await processAllOrderTimeouts();
    return ok(result);
  });
}
