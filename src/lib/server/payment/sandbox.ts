import "server-only";
import type { CreatePaymentParams, CreatePaymentResult } from "./provider";

/**
 * 沙箱支付渠道：不对接真实网关，用于本地与试用环境跑通完整下单/托管流程。
 *
 * - 默认 PAYMENT_SANDBOX_AUTOCONFIRM=true：创建即视为支付成功（保持一键体验）。
 * - 设为 false：返回一个可扫描的占位二维码，需调用 sandbox-confirm 接口
 *   （或前端「模拟支付成功」按钮）后才置为成功，便于演示扫码轮询交互。
 */
export function sandboxAutoConfirm() {
  return process.env.PAYMENT_SANDBOX_AUTOCONFIRM !== "false";
}

export async function createSandboxPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  if (sandboxAutoConfirm()) {
    return { autoPaid: true, raw: { sandbox: true, auto: true } };
  }
  // 二维码内容仅作演示占位（指向沙箱确认页/订单号）
  return {
    qrCodeContent: `lezyou-sandbox://pay?out_trade_no=${params.outTradeNo}&amount=${params.amountFen}`,
    autoPaid: false,
    raw: { sandbox: true, auto: false },
  };
}
