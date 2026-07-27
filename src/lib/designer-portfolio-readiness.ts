import type { Designer } from "@/lib/types";

/** 从作品集推导擅长项目类型（与 projectTypeTags 同步） */
export function projectTypesFromPortfolio(designer: Designer): string[] {
  return [
    ...new Set(
      (designer.portfolio ?? []).map((p) => p.category).filter(Boolean),
    ),
  ];
}

/**
 * 设计师当前可接单的项目类型 = 已上传作品案例的项目类型。
 * 优先使用内存中的 projectTypeTags，若为空则回退到作品集推导。
 */
export function getAcceptableProjectTypes(designer: Designer): string[] {
  const tags = designer.projectTypeTags ?? [];
  if (tags.length > 0) return [...new Set(tags.filter(Boolean))];
  return projectTypesFromPortfolio(designer);
}

/** @deprecated 使用 getAcceptableProjectTypes；保留别名兼容旧调用 */
export function getRequiredProjectTypes(designer: Designer): string[] {
  return getAcceptableProjectTypes(designer);
}

/** 是否已具备基础接单资格（至少 1 个作品案例） */
export function designerCanAcceptOrders(designer: Designer): boolean {
  return getAcceptableProjectTypes(designer).length > 0;
}

/** 设计师是否可承接指定项目类型的订单 / 悬赏 */
export function designerCoversProjectType(
  designer: Designer,
  projectType?: string | null,
): boolean {
  const type = projectType?.trim();
  if (!type) return designerCanAcceptOrders(designer);
  return getAcceptableProjectTypes(designer).includes(type);
}

/** 尚未上传案例时的提示（不再要求「预先声明再补齐」） */
export function getMissingPortfolioProjectTypes(_designer: Designer): string[] {
  return [];
}

export function portfolioReadinessHint(designer: Designer): string {
  const types = getAcceptableProjectTypes(designer);
  if (types.length === 0) {
    return "请先在作品管理中按项目类型上传至少 1 个案例。上传后的项目类型将同步为擅长类型，并决定您可承接的订单类型。";
  }
  return `当前可接单项目类型：${types.join("、")}`;
}

export function projectTypeMismatchMessage(projectType: string): string {
  return `该设计师尚未上传「${projectType}」类型案例，无法承接此类订单。请选择已覆盖该项目类型的设计师，或请设计师先补充对应作品。`;
}
