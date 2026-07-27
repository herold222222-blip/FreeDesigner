import type {
  EducationDegree,
  EducationExperience,
  EmploymentExperience,
  HighestEducation,
} from "@/lib/types";

export const HIGHEST_EDUCATION_OPTIONS: {
  value: HighestEducation;
  label: string;
}[] = [
  { value: "college_or_below", label: "大专及以下" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "doctorate_or_above", label: "博士及以上" },
];

export const EDUCATION_DEGREE_OPTIONS: {
  value: EducationDegree;
  label: string;
}[] = [
  { value: "college", label: "大专" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "doctorate", label: "博士" },
  { value: "postdoc", label: "博士后" },
];

export function highestEducationLabel(
  value?: HighestEducation | null,
): string {
  if (!value) return "";
  return (
    HIGHEST_EDUCATION_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function educationDegreeLabel(value?: EducationDegree | null): string {
  if (!value) return "";
  return EDUCATION_DEGREE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function emptyEducationExperience(): EducationExperience {
  return {
    id: `edu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    school: "",
    degree: undefined,
    major: "",
    graduatedAt: "",
  };
}

export function emptyEmploymentExperience(): EmploymentExperience {
  return {
    id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    company: "",
    title: "",
    startAt: "",
    endAt: "",
  };
}

export function isEducationExperienceFilled(row: EducationExperience) {
  return Boolean(
    row.school?.trim() ||
      row.degree ||
      row.major?.trim() ||
      row.graduatedAt?.trim(),
  );
}

export function isEmploymentExperienceFilled(row: EmploymentExperience) {
  return Boolean(
    row.company?.trim() ||
      row.title?.trim() ||
      row.startAt?.trim() ||
      row.endAt?.trim(),
  );
}

export function normalizeEducationExperiences(
  rows?: EducationExperience[] | null,
): EducationExperience[] {
  if (!rows?.length) return [];
  return rows
    .filter(isEducationExperienceFilled)
    .map((row) => ({
      id: row.id || emptyEducationExperience().id,
      school: row.school?.trim() || undefined,
      degree: row.degree || undefined,
      major: row.major?.trim() || undefined,
      graduatedAt: row.graduatedAt?.trim() || undefined,
    }));
}

export function normalizeEmploymentExperiences(
  rows?: EmploymentExperience[] | null,
): EmploymentExperience[] {
  if (!rows?.length) return [];
  return rows
    .filter(isEmploymentExperienceFilled)
    .map((row) => ({
      id: row.id || emptyEmploymentExperience().id,
      company: row.company?.trim() || undefined,
      title: row.title?.trim() || undefined,
      startAt: row.startAt?.trim() || undefined,
      endAt: row.endAt?.trim() || undefined,
    }));
}

export function formatEducationExperienceLine(row: EducationExperience) {
  const parts = [
    row.school?.trim(),
    educationDegreeLabel(row.degree),
    row.major?.trim(),
    row.graduatedAt?.trim() ? `${row.graduatedAt} 毕业` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function formatEmploymentExperienceLine(row: EmploymentExperience) {
  const period =
    row.startAt || row.endAt
      ? `${row.startAt?.trim() || "?"} – ${row.endAt?.trim() || "至今"}`
      : "";
  const parts = [row.company?.trim(), row.title?.trim(), period].filter(Boolean);
  return parts.join(" · ");
}

/** 校验可选多条记录：有填写的行需完整（学校/公司为选填） */
export function validateEducationExperiences(
  rows: EducationExperience[],
): string | null {
  for (const row of rows) {
    if (!isEducationExperienceFilled(row)) continue;
    if (!row.degree) return "请选择学历，或清空未完成的毕业经历";
    if (!row.major?.trim()) return "请填写专业，或清空未完成的毕业经历";
    if (!row.graduatedAt?.trim())
      return "请填写毕业时间，或清空未完成的毕业经历";
  }
  return null;
}

export function validateEmploymentExperiences(
  rows: EmploymentExperience[],
): string | null {
  for (const row of rows) {
    if (!isEmploymentExperienceFilled(row)) continue;
    if (!row.title?.trim()) return "请填写职务，或清空未完成的任职经历";
    if (!row.startAt?.trim()) return "请填写任职开始时间，或清空未完成的任职经历";
    if (row.endAt?.trim() && row.startAt && row.endAt < row.startAt) {
      return "任职结束时间不能早于开始时间";
    }
  }
  return null;
}
