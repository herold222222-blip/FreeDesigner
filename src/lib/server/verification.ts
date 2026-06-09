import "server-only";
import { prisma } from "./db";
import { sendSmsVerificationCode } from "./sms";

const CODE_TTL_MINUTES = 10;

function demoEnabled() {
  return process.env.DEMO_CODE_ENABLED !== "off";
}

function demoCode() {
  return process.env.DEMO_VERIFICATION_CODE || "888888";
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 发送验证码。演示模式下固定返回 DEMO_VERIFICATION_CODE。
 * 接入真实短信时，在此处调用短信服务商 API 发送 `code`。
 */
export async function sendVerificationCode(phone: string, purpose: "login" | "register") {
  const code = demoEnabled() ? demoCode() : genCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await prisma.verificationCode.create({
    data: { phone, code, purpose, expiresAt },
  });

  if (!demoEnabled()) {
    await sendSmsVerificationCode(phone, code);
  }

  return {
    sent: true,
    // 仅演示模式回传验证码，便于前端自动填充
    demoCode: demoEnabled() ? code : undefined,
  };
}

/** 校验验证码。演示模式下额外接受固定演示码。 */
export async function verifyCode(
  phone: string,
  code: string,
  purpose: "login" | "register"
): Promise<boolean> {
  if (demoEnabled() && code === demoCode()) {
    return true;
  }

  const record = await prisma.verificationCode.findFirst({
    where: { phone, purpose, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  return true;
}
