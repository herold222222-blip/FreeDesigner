import "server-only";
import { prisma } from "./db";
import { sendSmsVerificationCode } from "./sms";

const CODE_TTL_MINUTES = 10;

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 发送验证码（短信通道） */
export async function sendVerificationCode(
  phone: string,
  purpose: "login" | "register",
) {
  const code = genCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await prisma.verificationCode.create({
    data: { phone, code, purpose, expiresAt },
  });

  await sendSmsVerificationCode(phone, code);

  return { sent: true as const };
}

/** 校验验证码 */
export async function verifyCode(
  phone: string,
  code: string,
  purpose: "login" | "register",
): Promise<boolean> {
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
