import "server-only";
import type { CreatePaymentParams, CreatePaymentResult } from "./provider";

/**
 * 沙箱支付渠道：不对接真实网关，用于本地与试用环境跑通完整下单/托管流程。
 *
 * - 默认不自动到账：返回占位二维码，需点「确认支付」或调用 sandbox-confirm。
 * - 仅当 PAYMENT_SANDBOX_AUTOCONFIRM=true 时创建即视为支付成功。
 */
export function sandboxAutoConfirm() {
  return process.env.PAYMENT_SANDBOX_AUTOCONFIRM === "true";
}

export async function createSandboxPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  if (sandboxAutoConfirm()) {
    return { autoPaid: true, raw: { sandbox: true, auto: true } };
  }
  // 二维码内容为沙箱占位（指向确认页/订单号）
  return {
    qrCodeContent: `lezyou-sandbox://pay?out_trade_no=${params.outTradeNo}&amount=${params.amountFen}`,
    autoPaid: false,
    raw: { sandbox: true, auto: false },
  };
}
