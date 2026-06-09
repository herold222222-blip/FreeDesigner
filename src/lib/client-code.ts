/** 委托人对外编号，格式 CL + 6 位数字 */
export function formatClientCode(seq: number): string {
  return `CL${String(seq).padStart(6, "0")}`;
}

export function normalizeClientCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, "");
}

export function isClientCodeFormat(code: string): boolean {
  return /^CL\d{6}$/.test(normalizeClientCode(code));
}
