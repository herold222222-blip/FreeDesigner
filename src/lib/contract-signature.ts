const MAX_SIGNATURE_CHARS = 400_000;

export function parseContractSignature(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "请手写或鼠标写下姓名后再确认签署" };
  }
  const value = input.trim();
  if (!value.startsWith("data:image/")) {
    return { ok: false, error: "签名格式无效，请重新签署" };
  }
  if (value.length > MAX_SIGNATURE_CHARS) {
    return { ok: false, error: "签名图片过大，请重写后确认" };
  }
  return { ok: true, value };
}
