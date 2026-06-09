import "server-only";
import crypto from "crypto";
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
} from "./provider";

/**
 * 微信支付 V3 · Native（扫码）实现。
 * 仅用 Node crypto 完成签名/验签/解密，无需额外 SDK。
 *
 * 需要的环境变量：
 *   WECHAT_PAY_APPID         公众号/小程序/应用 AppID
 *   WECHAT_PAY_MCH_ID        商户号
 *   WECHAT_PAY_SERIAL_NO     商户 API 证书序列号
 *   WECHAT_PAY_PRIVATE_KEY   商户 API 私钥（PEM，可用 \n 转义换行）
 *   WECHAT_PAY_APIV3_KEY     APIv3 密钥（用于回调报文 AES-GCM 解密）
 *   WECHAT_PAY_PLATFORM_PUBLIC_KEY  微信支付平台证书公钥（PEM，用于回调验签；缺省则跳过验签）
 *
 * 联调提示：商户号需在微信支付商户平台开通 Native 支付，并配置回调域名。
 */

const WECHAT_API_BASE = "https://api.mch.weixin.qq.com";

function pem(value?: string) {
  return (value || "").replace(/\\n/g, "\n");
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`微信支付缺少环境变量 ${name}`);
  return v;
}

function buildAuthToken(method: string, urlPath: string, body: string) {
  const mchid = requireEnv("WECHAT_PAY_MCH_ID");
  const serialNo = requireEnv("WECHAT_PAY_SERIAL_NO");
  const privateKey = pem(requireEnv("WECHAT_PAY_PRIVATE_KEY"));

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(message)
    .sign(privateKey, "base64");

  return (
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${mchid}",nonce_str="${nonceStr}",signature="${signature}",` +
    `timestamp="${timestamp}",serial_no="${serialNo}"`
  );
}

export async function createWechatNativePayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const appid = requireEnv("WECHAT_PAY_APPID");
  const mchid = requireEnv("WECHAT_PAY_MCH_ID");
  const urlPath = "/v3/pay/transactions/native";

  const body = JSON.stringify({
    appid,
    mchid,
    description: params.subject,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    amount: { total: params.amountFen, currency: "CNY" },
  });

  const res = await fetch(WECHAT_API_BASE + urlPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: buildAuthToken("POST", urlPath, body),
    },
    body,
  });

  const json = (await res.json()) as { code_url?: string; message?: string };
  if (!res.ok || !json.code_url) {
    throw new Error(`微信下单失败：${json.message || res.status}`);
  }
  return { qrCodeContent: json.code_url, autoPaid: false, raw: json };
}

/** 校验并解析微信支付回调。验签需配置平台公钥，否则仅解密。 */
export async function verifyWechatNotify(
  headers: Record<string, string | null>,
  rawBody: string
): Promise<NotifyResult> {
  const platformKey = pem(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY);
  if (platformKey) {
    const timestamp = headers["wechatpay-timestamp"] ?? "";
    const nonce = headers["wechatpay-nonce"] ?? "";
    const signature = headers["wechatpay-signature"] ?? "";
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const ok = crypto
      .createVerify("RSA-SHA256")
      .update(message)
      .verify(platformKey, signature, "base64");
    if (!ok) throw new Error("微信回调验签失败");
  }

  const apiV3Key = requireEnv("WECHAT_PAY_APIV3_KEY");
  const payload = JSON.parse(rawBody) as {
    resource?: {
      ciphertext: string;
      nonce: string;
      associated_data?: string;
    };
  };
  const resource = payload.resource;
  if (!resource) throw new Error("微信回调缺少 resource");

  const cipher = Buffer.from(resource.ciphertext, "base64");
  const authTag = cipher.subarray(cipher.length - 16);
  const data = cipher.subarray(0, cipher.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiV3Key, "utf8"),
    Buffer.from(resource.nonce, "utf8")
  );
  decipher.setAuthTag(authTag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  const decoded = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString("utf8");

  const result = JSON.parse(decoded) as {
    out_trade_no: string;
    transaction_id?: string;
    trade_state: string;
  };

  return {
    outTradeNo: result.out_trade_no,
    transactionId: result.transaction_id,
    success: result.trade_state === "SUCCESS",
    raw: result,
  };
}
