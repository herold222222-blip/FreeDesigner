import { AREA_ROOTS } from "@/lib/administrative-area";
import type { Bounty, BountyLocation, BountyTrack, Specialty } from "@/lib/types";

function makeLocation(provinceName: string, cityName?: string): BountyLocation {
  const p = AREA_ROOTS.find((r) => r.text === provinceName);
  if (!p) {
    return { provinceCode: "", provinceName, label: provinceName };
  }
  if (!cityName) {
    return {
      provinceCode: p.value,
      provinceName: p.text,
      label: p.text,
    };
  }
  const cy = p.children.find((c) => c.text === cityName);
  if (!cy) {
    return { provinceCode: p.value, provinceName: p.text, label: p.text };
  }
  return {
    provinceCode: p.value,
    provinceName: p.text,
    cityCode: cy.value,
    cityName: cy.text,
    label: `${p.text} · ${cy.text}`,
  };
}

function track(
  l1: Specialty,
  l2: string | string[],
  l3: string | string[],
): BountyTrack {
  return {
    l1,
    l2: Array.isArray(l2) ? l2 : [l2],
    l3: Array.isArray(l3) ? l3 : [l3],
  };
}

export const bounties: Bounty[] = [
  {
    id: "bounty_001",
    code: "BTY-20260428-7821",
    title: "苏州相城区 8 万㎡ 城市公园方案征集",
    specialty: "landscape",
    primaryTrack: track("landscape", "scheme", "scheme_lead"),
    designScope: "scheme",
    projectType: "城市公园",
    location: makeLocation("江苏省", "苏州市"),
    description:
      "苏州市相城区计划新建一座 8 万平米的城市综合公园,毗邻地铁与湿地,需要包含运动、儿童、市集、自然教育等复合功能。希望具有国际视野与在地表达兼具的方案。",
    reward: 80000,
    rewardModel: "fixed",
    deadline: "2026-05-25",
    publishedAt: "2026-04-28T10:00:00+08:00",
    publisherId: "client_yu",
    status: "open",
    attachments: [
      { name: "项目任务书.pdf" },
      { name: "现场地形 CAD.dwg" },
      { name: "周边环境照片.zip" },
    ],
    requirements: [
      "5 年以上市政公园经验",
      "提供 2 个同类已建成案例",
      "可在 4 周内完成方案文本与多媒体汇报",
    ],
    applicants: [
      {
        designerId: "designer_zhao",
        appliedL3: "scheme_lead",
        proposal: "拟以「水韵相城」为主题,引入江南水网肌理与现代运动空间叠合。",
        quotedAmount: 76000,
        estimatedDays: 25,
        appliedAt: "2026-04-29T10:00:00+08:00",
      },
      {
        designerId: "designer_he",
        appliedL3: "scheme_lead",
        proposal: "可调动 6 人施工图团队同步介入,保证后续施工图深度。",
        quotedAmount: 88000,
        estimatedDays: 30,
        appliedAt: "2026-04-30T11:30:00+08:00",
      },
      {
        designerId: "designer_wang",
        appliedL3: "scheme_lead",
        proposal: "可承接给排水与照明全专业,保证一次过审。",
        quotedAmount: 70000,
        estimatedDays: 28,
        appliedAt: "2026-05-01T08:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_002",
    code: "BTY-20260425-5532",
    title: "杭州滨江精品酒店室内设计征集",
    specialty: "interior",
    primaryTrack: track("interior", "scheme", "scheme_lead"),
    designScope: "full_process",
    projectType: "精品酒店",
    location: makeLocation("浙江省", "杭州市"),
    description:
      "钱塘江畔 60 间客房精品酒店,主打城市疗愈与艺术陈设。希望突出 in-house gallery 与江景视角的融合。",
    reward: 300000,
    rewardModel: "fixed",
    deadline: "2026-05-30",
    publishedAt: "2026-04-25T15:00:00+08:00",
    publisherId: "client_lin",
    status: "open",
    attachments: [{ name: "酒店建筑方案.pdf" }, { name: "品牌调性 PPT.pptx" }],
    requirements: ["有 5 星级酒店实操案例", "提供材料供应链支持", "全案设计费报价 + 可选软装独立报价"],
    applicants: [
      {
        designerId: "designer_chen",
        appliedL3: "scheme_lead",
        proposal: "可提供建筑与室内跨专业方案统筹,控制整体造价。",
        quotedAmount: 280000,
        estimatedDays: 55,
        appliedAt: "2026-04-26T09:00:00+08:00",
      },
      {
        designerId: "designer_li",
        appliedL3: "scheme_lead",
        proposal: "可联合东京 nendo 工作室出方案,材料以宋瓷与未染麻布为主线。",
        quotedAmount: 320000,
        estimatedDays: 60,
        appliedAt: "2026-04-26T10:00:00+08:00",
      },
      {
        designerId: "designer_zhou",
        appliedL3: "scheme_lead",
        proposal: "我可以独立完成软装与陈设部分,成本控制在 80 万内。",
        quotedAmount: 80000,
        estimatedDays: 35,
        appliedAt: "2026-04-27T15:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_003",
    code: "BTY-20260420-3320",
    title: "陕西延安乡村振兴民宿群方案",
    specialty: "architecture",
    primaryTrack: track("architecture", "scheme", "scheme_doc"),
    designScope: "scheme",
    projectType: "民宿改造",
    location: makeLocation("陕西省"),
    description: "在延安南泥湾片区改造 12 栋传统窑洞为精品民宿。希望保留地域文脉,新旧对话。",
    reward: 60000,
    rewardModel: "fixed",
    deadline: "2026-06-10",
    publishedAt: "2026-04-20T09:00:00+08:00",
    publisherId: "client_yu",
    status: "open",
    attachments: [{ name: "现状测绘.dwg" }, { name: "在地访谈纪录.pdf" }],
    requirements: ["乡村振兴或在地建造经验", "至少一次现场踏勘", "提交方案文本 + 1:200 实体模型"],
    applicants: [
      {
        designerId: "designer_tang",
        appliedL3: "scheme_doc",
        proposal: "扎根福建乡建 6 年,可全程驻场 2 周,材料以本地夯土为主。",
        quotedAmount: 56000,
        estimatedDays: 45,
        appliedAt: "2026-04-22T10:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_004",
    code: "BTY-20260418-2210",
    title: "上海前滩商办综合体表现图征集",
    specialty: "rendering",
    primaryTrack: track("rendering", "render", "render_arch"),
    projectType: "商办综合体",
    location: makeLocation("上海市"),
    description: "需要 8 张外景日景 + 2 张夜景表现图,5 个室内大堂角度。72 小时内交付。",
    reward: 18000,
    rewardModel: "fixed",
    deadline: "2026-05-05",
    publishedAt: "2026-04-18T16:00:00+08:00",
    publisherId: "client_yu",
    status: "in_review",
    attachments: [{ name: "建筑模型.skp" }, { name: "材料意向.pdf" }],
    requirements: ["有甲级开发商表现图经验", "提交 3 张同类案例"],
    applicants: [
      {
        designerId: "designer_lin",
        appliedL3: "render_arch",
        proposal: "AECOM 表现部出身,72 小时可全部交付。",
        quotedAmount: 17600,
        estimatedDays: 3,
        appliedAt: "2026-04-19T08:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_005",
    code: "BTY-20260410-1108",
    title: "成都郫都区 LOFT 办公装修施工图",
    specialty: "interior",
    primaryTrack: track("interior", "construction_doc", "in_decoration"),
    designScope: "construction_doc",
    projectType: "办公空间",
    location: makeLocation("四川省", "成都市"),
    description: "1800㎡ LOFT 办公,需要灵活工位 + 路演剧场 + 咖啡吧台。",
    reward: 45000,
    rewardModel: "fixed",
    deadline: "2026-05-18",
    publishedAt: "2026-04-10T11:00:00+08:00",
    publisherId: "client_lin",
    status: "open",
    attachments: [{ name: "原始建筑平面.pdf" }],
    requirements: ["3 个 LOFT 办公案例", "施工对接到位"],
    applicants: [
      {
        designerId: "designer_zhou",
        appliedL3: "in_decoration",
        proposal: "可结合本地艺术家陈设,塑造蓉城 IP 特色。",
        quotedAmount: 42000,
        estimatedDays: 30,
        appliedAt: "2026-04-12T13:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_006",
    code: "BTY-20260408-0901",
    title: "广州天河综合体建筑全过程设计",
    specialty: "architecture",
    primaryTrack: track("architecture", "construction_doc", "arch_cd"),
    designScope: "full_process",
    projectType: "商业综合体",
    location: makeLocation("广东省", "广州市"),
    description: "约 12 万㎡商业综合体,需方案深化至施工图全周期交付,含多专业协调。",
    reward: 520000,
    rewardModel: "fixed",
    deadline: "2026-06-30",
    publishedAt: "2026-04-08T09:00:00+08:00",
    publisherId: "client_qing",
    status: "open",
    attachments: [{ name: "用地红线.dwg" }, { name: "规划条件.pdf" }],
    requirements: ["甲级商业综合体经验", "可驻场每周 2 天"],
    applicants: [
      {
        designerId: "designer_chen",
        appliedL3: "arch_cd",
        proposal: "可统筹建筑与室内界面,控制节点计划。",
        quotedAmount: 498000,
        estimatedDays: 120,
        appliedAt: "2026-04-10T10:00:00+08:00",
      },
    ],
  },
  {
    id: "bounty_007",
    code: "BTY-20260402-0802",
    title: "厦门鼓浪屿景观施工图专项",
    specialty: "landscape",
    primaryTrack: track("landscape", "construction_doc", ["ls_garden", "ls_drainage"]),
    designScope: "construction_doc",
    projectType: "历史街区景观",
    location: makeLocation("福建省", "厦门市"),
    description: "历史街区慢行系统园建施工图,约 1.2 万㎡,需送审深度。",
    reward: 68000,
    rewardModel: "fixed",
    deadline: "2026-05-28",
    publishedAt: "2026-04-02T08:00:00+08:00",
    publisherId: "client_yu",
    status: "open",
    attachments: [{ name: "方案批复.pdf" }],
    requirements: ["历史街区或滨海项目经验"],
    applicants: [],
  },
];

export function getBountyById(id: string) {
  return bounties.find((b) => b.id === id);
}
