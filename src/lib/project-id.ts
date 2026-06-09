import type { Specialty } from "@/lib/types";

/** 一级专业 → 项目 ID 前缀 */
export const SPECIALTY_PROJECT_ID_PREFIX: Record<Specialty, string> = {
  architecture: "AD",
  landscape: "LA",
  interior: "ID",
  rendering: "RD",
  cost_consulting: "CC",
};

const PROJECT_ID_PATTERN = /^(AD|LA|ID|RD|CC)\d{10}$/;

function randomTenDigits(): string {
  return String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
}

/** 按专业生成项目 ID：前缀 + 10 位数字 */
export function generateProjectId(specialty: Specialty): string {
  return `${SPECIALTY_PROJECT_ID_PREFIX[specialty]}${randomTenDigits()}`;
}

export function isProjectId(code: string): boolean {
  return PROJECT_ID_PATTERN.test(code);
}

export function specialtyFromProjectId(code: string): Specialty | undefined {
  const prefix = code.slice(0, 2);
  const entry = Object.entries(SPECIALTY_PROJECT_ID_PREFIX).find(
    ([, p]) => p === prefix,
  );
  return entry ? (entry[0] as Specialty) : undefined;
}
