import { NextRequest, NextResponse } from "next/server";
import { verifyWechatNotify } from "@/lib/server/payment/wechat";
import { settleByOutTradeNo } from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

/** 微信支付 V3 异步回调：验签 + 解密 + 落账 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers = {
      "wechatpay-timestamp": req.headers.get("wechatpay-timestamp"),
      "wechatpay-nonce": req.headers.get("wechatpay-nonce"),
      "wechatpay-signature": req.headers.get("wechatpay-signature"),
      "wechatpay-serial": req.headers.get("wechatpay-serial"),
    };
    const result = await verifyWechatNotify(headers, rawBody);
    if (result.success) {
      await settleByOutTradeNo(result.outTradeNo, result.transactionId);
    }
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (err) {
    console.error("[wechat-notify]", err);
    // 返回非成功状态，微信会按策略重试
    return NextResponse.json(
      { code: "FAIL", message: "处理失败" },
      { status: 500 }
    );
  }
}
