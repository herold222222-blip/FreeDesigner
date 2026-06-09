import type { Designer, SubjectType } from "@/lib/types";

export type DesignerGender = "male" | "female";

export function isIndividualDesigner(
  subjectType: SubjectType | undefined,
): boolean {
  return (subjectType ?? "individual") === "individual";
}

/** 个人设计师展示用性别；未登记时默认男 */
export function resolveDesignerGender(
  designer: Pick<Designer, "subjectType" | "gender">,
): DesignerGender | undefined {
  if (!isIndividualDesigner(designer.subjectType)) return undefined;
  return designer.gender ?? "male";
}

export function designerGenderSymbol(gender: DesignerGender): string {
  return gender === "female" ? "♀" : "♂";
}

export function designerGenderLabel(gender: DesignerGender): string {
  return gender === "female" ? "女" : "男";
}
