import "server-only";
import crypto from "crypto";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
} from "./provider";

/**
 * 支付宝 · 当面付（alipay.trade.precreate，扫码）实现，RSA2 签名。
 *
 * 需要的环境变量：
 *   ALIPAY_APP_ID       应用 AppId
 *   ALIPAY_PRIVATE_KEY  应用私钥（PEM/PKCS8，可用 \n 转义换行）
 *   ALIPAY_PUBLIC_KEY   支付宝公钥（用于回调验签）
 *   ALIPAY_GATEWAY      网关，默认 https://openapi.alipay.com/gateway.do
 *
 * 联调提示：需在支付宝开放平台创建应用并签约「当面付」，配置应用公钥/支付宝公钥与回调地址。
 */

function pem(value?: string, type: "PRIVATE" | "PUBLIC" = "PRIVATE") {
  const v = (value || "").replace(/\\n/g, "\n").trim();
  if (v.includes("BEGIN")) return v;
  // 允许只填裸 base64，自动补全 PEM 头尾
  const header = type === "PRIVATE" ? "PRIVATE KEY" : "PUBLIC KEY";
  const wrapped = v.match(/.{1,64}/g)?.join("\n") ?? v;
  return `-----BEGIN ${header}-----\n${wrapped}\n-----END ${header}-----`;
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`支付宝缺少环境变量 ${name}`);
  return v;
}

function gateway() {
  return process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do";
}

/** 上海时区的 yyyy-MM-dd HH:mm:ss */
function shanghaiTimestamp() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function sortedQuery(params: Record<string, string>) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function signRSA2(content: string) {
  const privateKey = pem(requireEnv("ALIPAY_PRIVATE_KEY"), "PRIVATE");
  return crypto.createSign("RSA-SHA256").update(content, "utf8").sign(privateKey, "base64");
}

export async function createAlipayPrecreate(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const publicParams: Record<string, string> = {
    app_id: requireEnv("ALIPAY_APP_ID"),
    method: "alipay.trade.precreate",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: shanghaiTimestamp(),
    version: "1.0",
    notify_url: params.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: params.outTradeNo,
      total_amount: (params.amountFen / 100).toFixed(2),
      subject: params.subject,
    }),
  };

  const sign = signRSA2(sortedQuery(publicParams));
  const form = new URLSearchParams({ ...publicParams, sign });

  const res = await fetch(gateway(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form.toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  const resp = json["alipay_trade_precreate_response"] as
    | { code?: string; msg?: string; sub_msg?: string; qr_code?: string }
    | undefined;
  if (!resp || resp.code !== "10000" || !resp.qr_code) {
    throw new Error(`支付宝下单失败：${resp?.sub_msg || resp?.msg || res.status}`);
  }
  return { qrCodeContent: resp.qr_code, autoPaid: false, raw: resp };
}

/** 校验并解析支付宝回调（application/x-www-form-urlencoded 表单） */
export async function verifyAlipayNotify(
  params: Record<string, string>
): Promise<NotifyResult> {
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (publicKey) {
    const sign = params.sign;
    const rest: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k === "sign" || k === "sign_type") continue;
      rest[k] = v;
    }
    const ok = crypto
      .createVerify("RSA-SHA256")
      .update(sortedQuery(rest), "utf8")
      .verify(pem(publicKey, "PUBLIC"), sign, "base64");
    if (!ok) throw new Error("支付宝回调验签失败");
  }

  const status = params.trade_status;
  return {
    outTradeNo: params.out_trade_no,
    transactionId: params.trade_no,
    success: status === "TRADE_SUCCESS" || status === "TRADE_FINISHED",
    raw: params,
  };
}
