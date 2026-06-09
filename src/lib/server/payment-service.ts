import "server-only";
import {
  getOrder,
  createPayment,
  getPayment,
  getPaymentByOutTradeNo,
  updatePayment,
} from "./repo";
import { payStage } from "./order-service";
import { AuthError } from "./auth";
import {
  activeProvider,
  publicBaseUrl,
  type CreatePaymentResult,
} from "./payment/provider";
import { createSandboxPayment } from "./payment/sandbox";
import { createWechatNativePayment } from "./payment/wechat";
import { createAlipayPrecreate } from "./payment/alipay";

export interface PayIntent {
  paymentId: string;
  provider: string;
  status: string; // pending | paid
  amount: number; // 元
  qrCodeContent?: string;
  redirectUrl?: string;
  sandbox: boolean;
}

function genOutTradeNo() {
  // <=32 字符，全局唯一
  return `LZ${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`.toUpperCase();
}

/** 为某订单某付款阶段创建一次收款（返回二维码/跳转链接或沙箱自动成功） */
export async function createPayIntent(
  orderId: string,
  stageId: string,
  clientId: string
): Promise<PayIntent> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权支付该订单");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "pending") throw new AuthError(409, "该阶段无需支付");
  if (
    !order.clientSignedContract ||
    !order.designerSignedContract
  ) {
    throw new AuthError(409, "请先完成双方电子签约");
  }

  const provider = activeProvider();
  const outTradeNo = genOutTradeNo();
  const amountFen = Math.round(stage.amount * 100);
  const payment = await createPayment({
    orderId,
    stageId,
    clientId,
    provider,
    amount: amountFen,
    outTradeNo,
  });

  const notifyUrl = `${publicBaseUrl()}/api/payments/notify/${provider}`;
  const subject = `${order.code} · ${stage.name}`;

  let result: CreatePaymentResult;
  if (provider === "wechat") {
    result = await createWechatNativePayment({ outTradeNo, amountFen, subject, notifyUrl });
  } else if (provider === "alipay") {
    result = await createAlipayPrecreate({ outTradeNo, amountFen, subject, notifyUrl });
  } else {
    result = await createSandboxPayment({ outTradeNo, amountFen, subject, notifyUrl });
  }

  await updatePayment(payment.id, { data: JSON.stringify(result.raw ?? {}) });

  if (result.autoPaid) {
    await settlePaymentById(payment.id);
    return {
      paymentId: payment.id,
      provider,
      status: "paid",
      amount: stage.amount,
      sandbox: provider === "sandbox",
    };
  }

  return {
    paymentId: payment.id,
    provider,
    status: "pending",
    amount: stage.amount,
    qrCodeContent: result.qrCodeContent,
    redirectUrl: result.redirectUrl,
    sandbox: provider === "sandbox",
  };
}

/** 收款成功落账：标记支付单已支付，并把对应阶段资金转入平台托管 */
export async function settlePaymentById(
  paymentId: string,
  transactionId?: string
) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new AuthError(404, "支付单不存在");
  if (payment.status === "paid") return payment; // 幂等：重复回调直接返回

  await updatePayment(payment.id, {
    status: "paid",
    paidAt: new Date(),
    transactionId: transactionId ?? payment.transactionId,
  });

  // 资金进入托管（设计师侧冻结）。重复/已处理则忽略冲突。
  try {
    await payStage(payment.orderId, payment.stageId, payment.clientId);
  } catch (err) {
    if (!(err instanceof AuthError) || err.status !== 409) {
      console.error("[payment] 托管入账失败:", err);
    }
  }

  return getPayment(paymentId);
}

export async function settleByOutTradeNo(
  outTradeNo: string,
  transactionId?: string
) {
  const payment = await getPaymentByOutTradeNo(outTradeNo);
  if (!payment) throw new AuthError(404, "支付单不存在");
  return settlePaymentById(payment.id, transactionId);
}

export async function getPaymentStatus(paymentId: string, clientId: string) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new AuthError(404, "支付单不存在");
  if (payment.clientId !== clientId) throw new AuthError(403, "无权查看该支付单");
  return {
    paymentId: payment.id,
    status: payment.status,
    provider: payment.provider,
  };
}

/** 沙箱：手动确认支付成功（仅 sandbox 渠道、仅本人可调用） */
export async function sandboxConfirm(paymentId: string, clientId: string) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new AuthError(404, "支付单不存在");
  if (payment.provider !== "sandbox") throw new AuthError(400, "非沙箱支付单");
  if (payment.clientId !== clientId) throw new AuthError(403, "无权操作");
  return settlePaymentById(paymentId);
}
