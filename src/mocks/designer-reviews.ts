import { designers } from "@/mocks/designers";
import type { DesignerProjectReview, RatingBreakdown } from "@/lib/types";

const CLIENT_NAMES = [
  "林家三口",
  "星河地产",
  "云栖文旅",
  "青禾置业",
  "周先生",
  "陈女士",
  "汇景集团",
  "沐光工作室",
];

const PROJECT_TITLES: Record<string, string[]> = {
  architecture: [
    "徐汇复式住宅整装设计",
    "滨江商业综合体方案深化",
    "古城片区更新可研+方案",
    "度假酒店建筑扩初全套",
  ],
  landscape: [
    "湖岸公园景观施工图",
    "高端住宅大区园建绿化",
    "市政道路绿化提升",
  ],
  interior: [
    "精装样板间软装方案",
    "总部办公空间室内设计",
    "民宿客房改造软装",
  ],
  rendering: ["商业综合体效果图包", "住宅示范区渲染"],
  cost_consulting: ["综合体造价咨询", "景观工程清单编制"],
};

const REVIEW_SNIPPETS = [
  "沟通非常专业，节点把控清晰，交付图纸质量高，现场问题响应及时。",
  "方案阶段创意到位，后续施工图修改耐心细致，整体合作顺畅。",
  "对需求理解准确，能在预算范围内给出可落地的优化建议，推荐合作。",
  "时间观念强，周末也能及时回复，各阶段成果超出预期。",
  "审美与规范兼顾，审图意见消化快，项目顺利推进至验收。",
  "配合度高，与各专业协调主动，委托人省心。",
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function buildBreakdown(base: number, seed: number): RatingBreakdown {
  const jitter = (seed % 5) * 0.02 - 0.04;
  return {
    professional: round1(Math.min(5, base + jitter)),
    service: round1(Math.min(5, base + 0.02)),
    responsiveness: round1(Math.max(4, base - 0.05 + (seed % 3) * 0.02)),
  };
}

function reviewsForDesigner(
  designerId: string,
  count: number,
  baseRating: number,
  specialty: keyof typeof PROJECT_TITLES,
): DesignerProjectReview[] {
  const titles = PROJECT_TITLES[specialty] ?? PROJECT_TITLES.architecture;
  const list: DesignerProjectReview[] = [];
  for (let i = 0; i < count; i++) {
    const seed = designerId.length + i * 7;
    const breakdown = buildBreakdown(baseRating, seed);
    const overall = round1(
      (breakdown.professional + breakdown.service + breakdown.responsiveness) / 3,
    );
    const month = ((i % 12) + 1).toString().padStart(2, "0");
    const day = ((i % 27) + 1).toString().padStart(2, "0");
    list.push({
      id: `rev_${designerId}_${i + 1}`,
      designerId,
      orderCode: `ORD-${2024 - (i % 3)}${month}${day}-${(1000 + i).toString(36).toUpperCase()}`,
      projectTitle: titles[i % titles.length],
      projectType: titles[i % titles.length].split(/[·\s]/)[0] ?? "设计服务",
      clientDisplayName: CLIENT_NAMES[i % CLIENT_NAMES.length],
      completedAt: `202${5 - (i % 3)}-${month}-${day}T10:00:00+08:00`,
      overall,
      breakdown,
      content: REVIEW_SNIPPETS[i % REVIEW_SNIPPETS.length],
      impressionTags:
        i % 3 === 0 ? ["沟通顺畅", "图纸严谨"] : i % 3 === 1 ? ["经验丰富"] : undefined,
    });
  }
  return list.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
}

const REVIEW_CACHE = new Map<string, DesignerProjectReview[]>();

export function getDesignerReviews(designerId: string): DesignerProjectReview[] {
  if (REVIEW_CACHE.has(designerId)) return REVIEW_CACHE.get(designerId)!;
  const designer = designers.find((d) => d.id === designerId);
  if (!designer) return [];
  const count = Math.min(designer.reviewCount, 24);
  const list = reviewsForDesigner(
    designerId,
    count,
    designer.rating,
    designer.specialty as keyof typeof PROJECT_TITLES,
  );
  REVIEW_CACHE.set(designerId, list);
  return list;
}
