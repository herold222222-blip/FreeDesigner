import type { Designer } from "@/lib/types";

/** 设计师主页需覆盖的项目类型（作品集 category 与之对应） */
export function getRequiredProjectTypes(designer: Designer): string[] {
  return designer.projectTypeTags ?? [];
}

/** 尚未上传案例的项目类型 */
export function getMissingPortfolioProjectTypes(designer: Designer): string[] {
  const portfolio = designer.portfolio ?? [];
  const covered = new Set(portfolio.map((p) => p.category));
  const required = getRequiredProjectTypes(designer);
  if (required.length === 0) return [];

  return required.filter((t) => !covered.has(t));
}

/** 是否已具备接单 / 平台匹配所需的作品案例 */
export function designerCanAcceptOrders(designer: Designer): boolean {
  const portfolio = designer.portfolio ?? [];
  if (portfolio.length === 0) return false;

  const required = getRequiredProjectTypes(designer);
  if (required.length === 0) return true;

  const covered = new Set(portfolio.map((p) => p.category));
  return required.every((t) => covered.has(t));
}

export function portfolioReadinessHint(designer: Designer): string {
  const missing = getMissingPortfolioProjectTypes(designer);
  if ((designer.portfolio ?? []).length === 0) {
    return "请先在作品管理中按项目类型上传至少 1 个案例，审核展示通过后方可接单与匹配平台项目。";
  }
  if (missing.length > 0) {
    return `请补充以下项目类型的案例：${missing.join("、")}`;
  }
  return "";
}
