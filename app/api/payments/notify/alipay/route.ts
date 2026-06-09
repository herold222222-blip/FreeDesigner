import { NextRequest } from "next/server";
import { verifyAlipayNotify } from "@/lib/server/payment/alipay";
import { settleByOutTradeNo } from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

/** 支付宝异步回调：验签 + 落账。成功须返回纯文本 success */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => {
      params[k] = v;
    });
    const result = await verifyAlipayNotify(params);
    if (result.success) {
      await settleByOutTradeNo(result.outTradeNo, result.transactionId);
    }
    return new Response("success");
  } catch (err) {
    console.error("[alipay-notify]", err);
    return new Response("fail", { status: 500 });
  }
}
