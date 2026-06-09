/** 设计师 / 团队 / 公司对外编号，格式 DS + 6 位数字 */
export function formatDesignerCode(seq: number): string {
  return `DS${String(seq).padStart(6, "0")}`;
}

/** 从粘贴文本解析多个编号（逗号、空格、换行分隔） */
export function parseDesignerCodesInput(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,，;；\n]+/)
        .map((s) => normalizeDesignerCode(s))
        .filter(Boolean),
    ),
  ];
}

export function normalizeDesignerCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, "");
}

export function isDesignerCodeFormat(code: string): boolean {
  return /^DS\d{6}$/.test(normalizeDesignerCode(code));
}
