import "server-only";

export type PaymentProviderName = "sandbox" | "wechat" | "alipay";

export interface CreatePaymentParams {
  /** 商户订单号（全局唯一，<=32 字符） */
  outTradeNo: string;
  /** 金额（单位：分） */
  amountFen: number;
  /** 订单标题 */
  subject: string;
  /** 异步回调地址 */
  notifyUrl: string;
}

export interface CreatePaymentResult {
  /** 扫码支付二维码内容（前端用 qrcode.react 渲染成二维码） */
  qrCodeContent?: string;
  /** 跳转支付链接（PC 网站 / H5） */
  redirectUrl?: string;
  /** 沙箱：是否已自动置为支付成功 */
  autoPaid?: boolean;
  /** 网关原始返回，便于排查 */
  raw?: unknown;
}

export interface NotifyResult {
  outTradeNo: string;
  transactionId?: string;
  success: boolean;
  raw?: unknown;
}

/** 当前启用的支付渠道（环境变量 PAYMENT_PROVIDER，默认 sandbox） */
export function activeProvider(): PaymentProviderName {
  const p = (process.env.PAYMENT_PROVIDER || "sandbox").toLowerCase();
  if (p === "wechat" || p === "alipay") return p;
  return "sandbox";
}

/** 对外可访问的站点根地址，用于拼接回调 URL */
export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}
