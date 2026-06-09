import type { CompanyQualification } from "@/lib/types";

export type CompanyQualificationLevel = {
  id: string;
  label: string;
};

export type CompanyQualificationCategory = {
  id: string;
  label: string;
  levels: CompanyQualificationLevel[];
};

export type CompanyQualificationField = {
  id: string;
  label: string;
  categories: CompanyQualificationCategory[];
};

export type { CompanyQualification };

const KEY_SEP = "::";

export const COMPANY_QUALIFICATION_NONE_KEY = "none";

/** 设计公司资质选项（设计领域 → 资质类别 → 级别） */
export const COMPANY_QUALIFICATION_FIELDS: CompanyQualificationField[] = [
  {
    id: "architecture",
    label: "建筑设计",
    categories: [
      {
        id: "comprehensive",
        label: "工程设计综合资质",
        levels: [{ id: "a", label: "甲级" }],
      },
      {
        id: "industry_arch",
        label: "工程设计行业资质（建筑行业）",
        levels: [
          { id: "a", label: "甲级" },
          { id: "b", label: "乙级" },
          { id: "c", label: "丙级" },
        ],
      },
      {
        id: "professional_arch_eng",
        label: "工程设计专业资质（建筑工程专业）",
        levels: [
          { id: "a", label: "甲级" },
          { id: "b", label: "乙级" },
          { id: "c", label: "丙级" },
          { id: "d", label: "丁级" },
        ],
      },
    ],
  },
  {
    id: "landscape",
    label: "风景园林设计",
    categories: [
      {
        id: "landscape_special",
        label: "风景园林工程设计专项资质",
        levels: [
          { id: "a", label: "甲级" },
          { id: "b", label: "乙级" },
        ],
      },
    ],
  },
  {
    id: "interior_mohurd",
    label: "室内设计（住建）",
    categories: [
      {
        id: "decoration_special",
        label: "建筑装饰工程设计专项资质",
        levels: [
          { id: "a", label: "甲级" },
          { id: "b", label: "乙级" },
          { id: "c", label: "丙级" },
        ],
      },
    ],
  },
];

export function companyQualificationKey(
  fieldId: string,
  categoryId: string,
  levelId: string,
) {
  return `${fieldId}${KEY_SEP}${categoryId}${KEY_SEP}${levelId}`;
}

export function parseCompanyQualificationKey(
  key: string,
): CompanyQualification | null {
  const parts = key.split(KEY_SEP);
  if (parts.length !== 3) return null;
  const [fieldId, categoryId, levelId] = parts;
  const field = COMPANY_QUALIFICATION_FIELDS.find((f) => f.id === fieldId);
  const category = field?.categories.find((c) => c.id === categoryId);
  const level = category?.levels.find((l) => l.id === levelId);
  if (!field || !category || !level) return null;
  return {
    fieldId,
    fieldLabel: field.label,
    categoryId,
    categoryLabel: category.label,
    levelId,
    levelLabel: level.label,
  };
}

export function qualificationsFromKeys(keys: string[]): CompanyQualification[] {
  return keys
    .map(parseCompanyQualificationKey)
    .filter((q): q is CompanyQualification => q !== null);
}

export function companyQualificationDisplayLabel(q: CompanyQualification) {
  return `${q.fieldLabel} · ${q.categoryLabel} · ${q.levelLabel}`;
}
