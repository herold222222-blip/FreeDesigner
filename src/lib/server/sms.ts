import "server-only";

/**
 * 发送短信验证码。生产环境需配置 SMS_PROVIDER 及对应密钥。
 * 当前实现：阿里云占位（记录日志）；接入时在下方补充 HTTP 调用。
 */
export async function sendSmsVerificationCode(phone: string, code: string) {
  const provider = process.env.SMS_PROVIDER?.trim();
  if (!provider) {
    console.info(`[sms] skipped (SMS_PROVIDER unset) phone=${phone.slice(0, 3)}****`);
    return;
  }

  if (provider === "aliyun") {
    const accessKeyId = process.env.SMS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.SMS_ACCESS_KEY_SECRET;
    const signName = process.env.SMS_SIGN_NAME;
    const templateCode = process.env.SMS_TEMPLATE_CODE;
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
      throw new Error("阿里云短信环境变量未配置完整");
    }
    // 接入阿里云 dysmsapi 时在此发起请求；模板变量一般为 { code }
    console.info(
      `[sms:aliyun] send code to ${phone.slice(0, 3)}**** template=${templateCode}`,
    );
    return;
  }

  throw new Error(`不支持的 SMS_PROVIDER: ${provider}`);
}
