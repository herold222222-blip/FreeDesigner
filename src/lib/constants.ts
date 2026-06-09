import type {
  ClientLevel,
  DesignerLevel,
  RegionTier,
  Specialty,
  SubSpecialty,
  SubjectType,
} from "./types";

/* ------------------------------------------------------------------ */
/* 服务主体类型（团队规模）                                            */
/* ------------------------------------------------------------------ */

export const SUBJECT_TYPE_META: Record<
  SubjectType,
  { label: string; description: string }
> = {
  individual: { label: "独立设计师", description: "个人独立承接与交付" },
  team: { label: "设计团队", description: "多人协作小组，分工交付" },
  company: { label: "设计公司", description: "公司化运营，资质齐全" },
};

export const SUBJECT_TYPE_OPTIONS: { value: SubjectType; label: string }[] = [
  { value: "individual", label: SUBJECT_TYPE_META.individual.label },
  { value: "team", label: SUBJECT_TYPE_META.team.label },
  { value: "company", label: SUBJECT_TYPE_META.company.label },
];

/* ------------------------------------------------------------------ */
/* 一级专业（v1.1 由 3 个扩展为 5 个）                                  */
/* ------------------------------------------------------------------ */

export const SPECIALTIES: { value: Specialty; label: string; description: string }[] = [
  {
    value: "architecture",
    label: "建筑设计",
    description: "方案设计、扩初、施工图、竣工图四大阶段全覆盖",
  },
  {
    value: "landscape",
    label: "景观设计",
    description: "园建、绿化、给排水、电气一体化施工图（v1.1 已开放报价）",
  },
  {
    value: "interior",
    label: "室内设计",
    description: "住宅、商业空间、办公精装与软装陈设",
  },
  {
    value: "rendering",
    label: "效果图 / 动画",
    description: "建筑·景观·室内 效果图与漫游动画一站式表达",
  },
  {
    value: "cost_consulting",
    label: "造价咨询",
    description: "建筑·景观·室内 概算与全过程造价咨询",
  },
];

/* ------------------------------------------------------------------ */
/* 三级专业体系（v1.1）                                                */
/* ------------------------------------------------------------------ */

export interface SpecialtyTrackL3 {
  value: string;
  label: string;
  /** 该三级专业的施工图基准计费范围，仅展示用 */
  description?: string;
}

export interface SpecialtyTrackL2 {
  value: string;
  label: string;
  l3: SpecialtyTrackL3[];
}

export interface SpecialtyTrackL1 {
  value: Specialty;
  label: string;
  l2: SpecialtyTrackL2[];
}

export const SPECIALTY_TRACKS: SpecialtyTrackL1[] = [
  {
    value: "architecture",
    label: "建筑设计",
    l2: [
      {
        value: "scheme",
        label: "方案设计",
        l3: [
          { value: "scheme_lead", label: "方案主创" },
          { value: "scheme_doc", label: "方案文本" },
          { value: "scheme_model", label: "方案深化建模" },
          { value: "scheme_model_render", label: "方案深化建模 + 效果图" },
        ],
      },
      {
        value: "construction_doc",
        label: "施工图设计",
        l3: [
          { value: "arch_cd", label: "建筑（施工图）专业" },
          { value: "arch_struct", label: "建筑结构专业" },
          { value: "arch_mep", label: "建筑机电专业" },
          { value: "arch_hvac", label: "建筑暖通专业" },
          { value: "arch_drainage", label: "建筑给排水专业" },
        ],
      },
    ],
  },
  {
    value: "landscape",
    label: "景观设计",
    l2: [
      {
        value: "scheme",
        label: "方案设计",
        l3: [
          { value: "scheme_lead", label: "方案主创" },
          { value: "scheme_doc", label: "方案文本" },
          { value: "scheme_model", label: "方案深化建模" },
          { value: "scheme_model_render", label: "方案深化建模 + 效果图" },
        ],
      },
      {
        value: "construction_doc",
        label: "施工图设计",
        l3: [
          { value: "ls_garden", label: "景观园建专业" },
          { value: "ls_garden_struct", label: "景观园建专业（含简单结构）" },
          { value: "ls_greening", label: "景观绿化专业" },
          { value: "ls_drainage", label: "景观给排水专业" },
          { value: "ls_drainage_irrigation", label: "景观给排水 + 自动喷灌" },
          { value: "ls_electrical", label: "景观电气专业" },
          { value: "ls_struct", label: "景观结构专业" },
        ],
      },
    ],
  },
  {
    value: "interior",
    label: "室内设计",
    l2: [
      {
        value: "scheme",
        label: "方案设计",
        l3: [
          { value: "scheme_lead", label: "方案主创" },
          { value: "scheme_doc", label: "方案文本" },
          { value: "scheme_model", label: "方案深化建模" },
          { value: "scheme_model_render", label: "方案深化建模 + 效果图" },
        ],
      },
      {
        value: "construction_doc",
        label: "施工图设计",
        l3: [
          { value: "in_decoration", label: "装饰施工图专业" },
          { value: "in_drainage", label: "室内给排水专业" },
          { value: "in_electrical", label: "室内电气专业" },
          { value: "in_soft", label: "室内软装专业" },
        ],
      },
    ],
  },
  {
    value: "rendering",
    label: "效果图 / 动画",
    l2: [
      {
        value: "render",
        label: "效果图专业",
        l3: [
          { value: "render_arch", label: "建筑效果图" },
          { value: "render_ls", label: "景观效果图" },
          { value: "render_in", label: "室内效果图" },
        ],
      },
      {
        value: "animation",
        label: "漫游动画专业",
        l3: [
          { value: "anim_arch", label: "建筑漫游动画" },
          { value: "anim_ls", label: "景观漫游动画" },
          { value: "anim_in", label: "室内漫游动画" },
        ],
      },
    ],
  },
  {
    value: "cost_consulting",
    label: "造价咨询",
    l2: [
      {
        value: "arch_cost",
        label: "建筑造价",
        l3: [
          { value: "estimate", label: "概算" },
          { value: "full_process", label: "造价全过程" },
        ],
      },
      {
        value: "ls_cost",
        label: "景观造价",
        l3: [
          { value: "estimate", label: "概算" },
          { value: "full_process", label: "造价全过程" },
        ],
      },
      {
        value: "in_cost",
        label: "室内造价",
        l3: [
          { value: "estimate", label: "概算" },
          { value: "full_process", label: "造价全过程" },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 旧版二级专业（保留兼容旧 mock 数据 / 旧组件）                       */
/* ------------------------------------------------------------------ */

export const SUB_SPECIALTIES: Record<Specialty, { value: SubSpecialty; label: string }[]> = {
  architecture: [
    { value: "concept", label: "方案概念" },
    { value: "construction_doc", label: "建筑施工图" },
    { value: "model", label: "建筑模型" },
  ],
  landscape: [
    { value: "garden_construction", label: "园建施工图" },
    { value: "greening", label: "绿化施工图" },
    { value: "drainage", label: "给排水施工图" },
    { value: "electrical", label: "电气施工图" },
  ],
  interior: [
    { value: "concept", label: "方案概念" },
    { value: "construction_doc", label: "室内施工图" },
    { value: "soft_decoration", label: "软装陈设" },
  ],
  rendering: [
    { value: "model", label: "效果图 / 动画" },
  ],
  cost_consulting: [
    { value: "concept", label: "造价咨询" },
  ],
};

export const LANDSCAPE_PROJECT_TYPES = [
  "高层住宅",
  "公寓",
  "市政公园",
  "道路景观",
  "滨水步道",
  "湿地公园",
  "医院",
  "学校",
  "办公景观",
  "商业景观",
  "度假酒店及别墅区",
  "美丽乡村",
  "私人会所",
  "营地",
  "文旅",
  "自然风景区",
  "养老地产",
  "工厂产业园",
  "创新高科园区",
  "儿童乐园",
  "温泉度假",
  "主题乐园",
  "私宅别墅",
  "民宿花园",
  "其他",
];

export const ARCHITECTURE_PROJECT_TYPES = [
  "高层住宅",
  "公寓",
  "办公建筑",
  "商业综合体",
  "酒店度假",
  "学校",
  "医院",
  "工业厂房",
  "别墅",
  "民宿",
  "改造更新",
  "城市设计",
  "其他",
];

export const INTERIOR_PROJECT_TYPES = [
  "私宅住宅",
  "别墅大宅",
  "公寓样板间",
  "办公空间",
  "商业空间",
  "餐饮空间",
  "酒店客房",
  "民宿",
  "医美诊所",
  "教育空间",
  "展厅",
  "其他",
];

export function getProjectTypes(specialty: Specialty) {
  switch (specialty) {
    case "architecture":
      return ARCHITECTURE_PROJECT_TYPES;
    case "landscape":
      return LANDSCAPE_PROJECT_TYPES;
    case "interior":
      return INTERIOR_PROJECT_TYPES;
    case "rendering":
    case "cost_consulting":
      return [...ARCHITECTURE_PROJECT_TYPES, ...LANDSCAPE_PROJECT_TYPES, ...INTERIOR_PROJECT_TYPES];
  }
}

/** 解析三级专业体系的展示名称 */
export function resolveTrackLabels(l1: Specialty, l2: string, l3: string) {
  const l1Node = SPECIALTY_TRACKS.find((s) => s.value === l1);
  const l2Node = l1Node?.l2.find((x) => x.value === l2);
  const l3Node = l2Node?.l3.find((x) => x.value === l3);
  return {
    l1Label: l1Node?.label ?? l1,
    l2Label: l2Node?.label ?? l2,
    l3Label: l3Node?.label ?? l3,
  };
}

/* ------------------------------------------------------------------ */
/* 设计师等级（v1.1 新增）                                              */
/* ------------------------------------------------------------------ */

export const DESIGNER_LEVEL_META: Record<
  DesignerLevel,
  { label: string; coefficient: number; description: string; tone: "muted" | "amber" | "brand" | "violet" }
> = {
  intern: {
    label: "见习设计师",
    coefficient: 0.85,
    description: "注册后审核通过即可",
    tone: "muted",
  },
  mid_v1: {
    label: "中级设计师v1",
    coefficient: 1.0,
    description:
      "完成至少 5 单、单评 ≥4.0、均评 >4.5 可申请，管理员审批",
    tone: "brand",
  },
  senior_v1: {
    label: "高级设计师v1",
    coefficient: 1.3,
    description:
      "完成至少 5 单、单评 ≥4.3、均评 >4.7 可申请，管理员审批",
    tone: "amber",
  },
  specialist: {
    label: "特级设计师",
    coefficient: 1.5,
    description:
      "完成至少 5 单、单评 ≥4.3、均评 >4.7 可申请，管理员审批",
    tone: "violet",
  },
};

/* ------------------------------------------------------------------ */
/* 客户等级（v1.1 新增）                                                */
/* ------------------------------------------------------------------ */

export const CLIENT_LEVEL_META: Record<
  ClientLevel,
  { label: string; coefficient: number; description: string }
> = {
  strategic: {
    label: "战略客户",
    coefficient: 0.9,
    description: "前一年支付 ≥ 50 万",
  },
  premium: {
    label: "优质客户",
    coefficient: 0.95,
    description: "连续 3 次按时付款",
  },
  normal: {
    label: "普通客户",
    coefficient: 1.0,
    description: "初次注册",
  },
  secondary: {
    label: "次级客户",
    coefficient: 1.1,
    description: "2 次延迟 0-1 个月",
  },
  graylist: {
    label: "灰名单",
    coefficient: 1.1,
    description: "订单支付超时 ≥ 3 个月",
  },
};

/* ------------------------------------------------------------------ */
/* 地区梯队（v1.1 新增）                                                */
/* ------------------------------------------------------------------ */

export const REGION_TIER_META: Record<
  RegionTier,
  { label: string; coefficient: number; cities: string[] }
> = {
  tier1: {
    label: "第一梯队",
    coefficient: 1.2,
    cities: ["北京", "上海", "广州", "深圳"],
  },
  tier2: {
    label: "第二梯队",
    coefficient: 1.0,
    cities: [
      "成都",
      "杭州",
      "重庆",
      "苏州",
      "武汉",
      "西安",
      "南京",
      "长沙",
      "天津",
      "郑州",
      "东莞",
      "无锡",
      "宁波",
      "青岛",
      "合肥",
    ],
  },
  tier3: {
    label: "第三梯队",
    coefficient: 0.9,
    cities: [
      "佛山",
      "沈阳",
      "昆明",
      "济南",
      "厦门",
      "福州",
      "温州",
      "常州",
      "大连",
      "石家庄",
      "南宁",
      "哈尔滨",
      "金华",
      "南昌",
      "长春",
      "南通",
      "泉州",
      "贵阳",
      "嘉兴",
      "太原",
      "惠州",
      "徐州",
      "绍兴",
      "中山",
      "台州",
      "烟台",
      "珠海",
      "保定",
      "潍坊",
      "兰州",
    ],
  },
  tier4: {
    label: "第四梯队",
    coefficient: 0.8,
    cities: [
      "乌鲁木齐",
      "临沂",
      "海口",
      "湖州",
      "扬州",
      "盐城",
      "洛阳",
      "唐山",
      "济宁",
      "廊坊",
      "泰州",
      "赣州",
      "呼和浩特",
      "镇江",
      "芜湖",
      "汕头",
      "邯郸",
      "江门",
      "淄博",
      "银川",
      "南阳",
      "淮安",
      "绵阳",
      "连云港",
      "阜阳",
      "新乡",
      "咸阳",
      "三亚",
      "威海",
      "桂林",
      "漳州",
      "遵义",
      "宜昌",
      "宿迁",
      "沧州",
      "衡阳",
      "柳州",
      "襄阳",
      "莆田",
      "九江",
      "菏泽",
      "滁州",
      "湛江",
      "上饶",
      "德州",
      "肇庆",
      "揭阳",
      "邢台",
      "泰安",
      "周口",
      "株洲",
      "岳阳",
      "聊城",
      "宁德",
      "商丘",
      "荆州",
      "常德",
      "宜春",
      "六安",
      "蚌埠",
      "东营",
      "枣庄",
      "马鞍山",
      "丽水",
      "鄂尔多斯",
      "安庆",
      "信阳",
      "包头",
      "南充",
      "安阳",
    ],
  },
  tier5: {
    label: "第五梯队",
    coefficient: 0.75,
    cities: [
      "舟山",
      "清远",
      "衢州",
      "驻马店",
      "德阳",
      "宜宾",
      "龙岩",
      "日照",
      "黄石",
      "鞍山",
      "茂名",
      "郴州",
      "滨州",
      "黄冈",
      "西宁",
      "秦皇岛",
      "吉林",
      "开封",
      "宿州",
      "泸州",
      "湘潭",
      "大庆",
      "许昌",
      "邵阳",
      "亳州",
      "孝感",
      "晋中",
      "平顶山",
      "乐山",
      "运城",
      "榆林",
      "曲靖",
      "宣城",
      "南平",
      "淮南",
      "吉安",
      "宝鸡",
      "张家口",
      "抚州",
      "衡水",
      "黔南",
      "十堰",
      "怀化",
      "渭南",
      "韶关",
      "三明",
      "红河",
      "濮阳",
      "黔东南",
      "焦作",
      "拉萨",
      "眉山",
      "营口",
      "咸宁",
      "梅州",
      "潮州",
      "益阳",
      "长治",
      "赤峰",
      "北海",
      "河源",
      "景德镇",
      "大同",
      "达州",
      "盘锦",
      "凉山",
      "玉林",
      "恩施",
      "娄底",
      "永州",
      "黄山",
      "阳江",
      "临汾",
      "内江",
      "延边",
      "承德",
      "荆门",
      "齐齐哈尔",
      "锦州",
      "大理",
      "鄂州",
      "铜陵",
      "丹东",
      "淮北",
      "晋城",
      "汕尾",
      "毕节",
      "玉溪",
      "新余",
      "汉中",
    ],
  },
  tier6: {
    label: "第六梯队",
    coefficient: 0.7,
    cities: [],
  },
};

/**
 * 从地级市或直辖市全称（如「杭州市」「北京市」「红河哈尼族彝族自治州」）匹配文档 REGION_TIER_META 城市名录，
 * 得到设计师区域梯队系数对应的梯队；未录入名录的归为第六梯队。
 */
export function inferTierFromPrefectureCityName(prefectureFullName: string): RegionTier {
  const trimmed = prefectureFullName.trim();
  if (!trimmed) return "tier6";
  const noParen = trimmed.replace(/（.*?）/g, "").trim();
  const core =
    noParen
      .replace(/市$/u, "")
      .replace(/特别行政区$/u, "")
      .replace(/自治州$/u, "")
      .replace(/地区$/u, "")
      .replace(/盟$/u, "")
      .replace(/土家族苗族自治县$/u, "")
      .replace(/自治县$/u, "") || noParen.replace(/市$/u, "");

  const candidates = Array.from(new Set([core, noParen.replace(/市$/u, "")]));

  for (const tier of ["tier1", "tier2", "tier3", "tier4", "tier5"] as RegionTier[]) {
    const rows = REGION_TIER_META[tier].cities;
    for (const name of candidates) {
      if (rows.includes(name)) return tier;
    }
  }

  return "tier6";
}

/** 根据城市名（如 "上海市 · 徐汇区" / "杭州" / "苏州市"）匹配地区梯队 — 兼容旧表单仅填城市前缀 */
export function inferRegionTier(location: string): RegionTier {
  const segments = location.split(/[ ··]+/).map((s) => s.trim()).filter(Boolean);

  /** 若为「省 · 市 · 区县」链路，第二位一般为地级市（或直辖市重复的市名），优先按其推算梯队 */
  if (segments.length >= 2) {
    const fromPrefecture = inferTierFromPrefectureCityName(segments[1]!);
    if (fromPrefecture !== "tier6") return fromPrefecture;
  }

  const head = segments[0]?.replace(/市$/, "") ?? "";
  for (const tier of ["tier1", "tier2", "tier3", "tier4", "tier5"] as RegionTier[]) {
    if (REGION_TIER_META[tier].cities.includes(head)) return tier;
  }
  return "tier6";
}

/* ------------------------------------------------------------------ */
/* 项目类型系数（景观，v1.1 新增）                                      */
/* ------------------------------------------------------------------ */

export const LANDSCAPE_PROJECT_TYPE_COEFFICIENT: Record<string, number> = {
  高层住宅: 1.0,
  公寓: 1.0,
  市政公园: 0.9,
  道路景观: 0.9,
  滨水步道: 1.1,
  湿地公园: 0.95,
  医院: 0.8,
  学校: 0.8,
  办公景观: 0.9,
  商业景观: 1.1,
  度假酒店及别墅区: 1.1,
  美丽乡村: 0.7,
  私人会所: 1.5,
  营地: 0.9,
  文旅: 0.9,
  自然风景区: 0.6,
  养老地产: 0.9,
  工厂产业园: 0.7,
  创新高科园区: 0.9,
  儿童乐园: 1.1,
  温泉度假: 1.2,
  主题乐园: 1.5,
  私宅别墅: 1.0,
  民宿花园: 1.0,
  其他: 1.0,
};

/* ------------------------------------------------------------------ */
/* 景观施工图设计费基数（按面积阶梯，v1.1）                             */
/* ------------------------------------------------------------------ */

export interface LandscapeBasePricing {
  hardscape: number; // 园建
  softscape: number; // 绿化
  drainage: number; // 给排水
  electrical: number; // 电气
}

/** 当面积 ≤ 10000 ㎡ 时为一口价；> 10000 ㎡ 时为单位 元/㎡ */
export const LANDSCAPE_PRICING_TIERS: {
  upperBound: number;
  /** 是否为单位价（true => 元/㎡，false => 一口价） */
  isUnitPrice: boolean;
  pricing: LandscapeBasePricing;
  label: string;
}[] = [
  { upperBound: 1000, isUnitPrice: false, pricing: { hardscape: 10000, softscape: 3500, drainage: 1000, electrical: 1000 }, label: "< 1000 ㎡" },
  { upperBound: 3000, isUnitPrice: false, pricing: { hardscape: 15000, softscape: 4000, drainage: 1200, electrical: 1200 }, label: "1000–3000 ㎡" },
  { upperBound: 5000, isUnitPrice: false, pricing: { hardscape: 18000, softscape: 4500, drainage: 1200, electrical: 1200 }, label: "3000–5000 ㎡" },
  { upperBound: 7000, isUnitPrice: false, pricing: { hardscape: 20000, softscape: 5000, drainage: 1500, electrical: 1500 }, label: "5000–7000 ㎡" },
  { upperBound: 10000, isUnitPrice: false, pricing: { hardscape: 22000, softscape: 6000, drainage: 1500, electrical: 1500 }, label: "7000–10000 ㎡" },
  { upperBound: 20000, isUnitPrice: true, pricing: { hardscape: 2.4, softscape: 0.6, drainage: 0.18, electrical: 0.18 }, label: "10000–20000 ㎡" },
  { upperBound: 30000, isUnitPrice: true, pricing: { hardscape: 2.2, softscape: 0.58, drainage: 0.16, electrical: 0.16 }, label: "20000–30000 ㎡" },
  { upperBound: 50000, isUnitPrice: true, pricing: { hardscape: 2.0, softscape: 0.56, drainage: 0.15, electrical: 0.15 }, label: "30000–50000 ㎡" },
  { upperBound: 80000, isUnitPrice: true, pricing: { hardscape: 1.8, softscape: 0.52, drainage: 0.15, electrical: 0.15 }, label: "50000–80000 ㎡" },
  { upperBound: Infinity, isUnitPrice: true, pricing: { hardscape: 1.5, softscape: 0.48, drainage: 0.13, electrical: 0.13 }, label: "> 80000 ㎡" },
];

/* ------------------------------------------------------------------ */
/* 景观方案设计费基数（v1.1 · 7.2.2）                                   */
/* ------------------------------------------------------------------ */

export const LANDSCAPE_SCHEME_PRICING_TIERS: {
  upperBound: number;
  isUnitPrice: boolean;
  /** 一口价（元）或单位价（元/㎡） */
  amount: number;
  label: string;
}[] = [
  { upperBound: 1000, isUnitPrice: false, amount: 30000, label: "< 1000 ㎡" },
  { upperBound: 3000, isUnitPrice: false, amount: 40000, label: "1000–3000 ㎡" },
  { upperBound: 5000, isUnitPrice: false, amount: 50000, label: "3000–5000 ㎡" },
  { upperBound: 7000, isUnitPrice: false, amount: 60000, label: "5000–7000 ㎡" },
  { upperBound: 10000, isUnitPrice: false, amount: 70000, label: "7000–10000 ㎡" },
  { upperBound: 20000, isUnitPrice: true, amount: 9, label: "1万–2万 ㎡" },
  { upperBound: 30000, isUnitPrice: true, amount: 8.5, label: "2万–3万 ㎡" },
  { upperBound: 50000, isUnitPrice: true, amount: 8, label: "3万–5万 ㎡" },
  { upperBound: 80000, isUnitPrice: true, amount: 7.5, label: "5万–8万 ㎡" },
  { upperBound: Infinity, isUnitPrice: true, amount: 7, label: "> 8万 ㎡" },
];

/** 方案难度系数（按景观单方造价 元/㎡） */
export const LANDSCAPE_SCHEME_DIFFICULTY = [
  {
    key: "ultra_high",
    label: "超高",
    coefficient: 1.5,
    minCostPerSqm: 1500,
    remark: "造价 1500 元/㎡ 以上",
  },
  {
    key: "high",
    label: "高",
    coefficient: 1.3,
    minCostPerSqm: 1000,
    maxCostPerSqm: 1500,
    remark: "造价 1000–1500 元/㎡",
  },
  {
    key: "medium",
    label: "中",
    coefficient: 1.0,
    minCostPerSqm: 500,
    maxCostPerSqm: 1000,
    remark: "造价 500–1000 元/㎡",
  },
  {
    key: "low",
    label: "低",
    coefficient: 0.8,
    minCostPerSqm: 300,
    maxCostPerSqm: 500,
    remark: "造价 300–500 元/㎡",
  },
  {
    key: "very_low",
    label: "极低",
    coefficient: 0.6,
    maxCostPerSqm: 300,
    remark: "造价 300 元/㎡ 以下",
  },
] as const;

export type LandscapeSchemeDifficultyKey =
  (typeof LANDSCAPE_SCHEME_DIFFICULTY)[number]["key"];

/** 景观施工图按面积 / 按时间项目付款阶段（默认 30 / 40 / 30） */
export const LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES = [
  { name: "预付款", ratio: 0.3, note: "合同签订并双方签署后 2 个工作日内支付" },
  {
    name: "中期款",
    ratio: 0.4,
    note: "阶段成果上传并通过委托人确认后 5 个工作日内支付",
  },
  { name: "尾款", ratio: 0.3, note: "终稿验收通过后 5 个工作日内支付" },
];

/** 景观方案按面积项目付款阶段（7.2.2 §5） */
export const LANDSCAPE_SCHEME_PAYMENT_STAGES = [
  { name: "预付款", ratio: 0.25, note: "合同签订后 2 个工作日内支付" },
  { name: "概念方案阶段", ratio: 0.3, note: "收到概念方案 PDF 确认后 5 个工作日内支付" },
  { name: "深化方案阶段", ratio: 0.35, note: "收到深化方案 PDF 确认后 5 个工作日内支付" },
  { name: "施工图交接阶段", ratio: 0.1, note: "完成对施工图交底后 5 个工作日内支付" },
];

/* ------------------------------------------------------------------ */
/* 景观按时间计费费率（v1.1）                                           */
/* ------------------------------------------------------------------ */

export const LANDSCAPE_DAILY_RATE = {
  remote: { hardscape: 500, softscape: 500, drainage: 500, electrical: 500, structure: 800 },
  onsite: { hardscape: 800, softscape: 800, drainage: 800, electrical: 800, structure: 1200 },
};

export const LANDSCAPE_MONTHLY_RATE = {
  remote: { hardscape: 8000, softscape: 8000, drainage: 8000, electrical: 8000, structure: 12000 },
  onsite: { hardscape: 12000, softscape: 12000, drainage: 12000, electrical: 12000, structure: 15000 },
};

/* ------------------------------------------------------------------ */
/* 税率系数（v1.1）                                                     */
/* ------------------------------------------------------------------ */

export const TAX_OPTIONS = [
  { value: "ordinary_1", label: "默认 1% 普票", coefficient: 1.0 },
  { value: "special_1", label: "1% 专票", coefficient: 1.02 },
  { value: "special_3", label: "3% 专票", coefficient: 1.04 },
];

/* ------------------------------------------------------------------ */
/* 多语言（v1.1 新增）                                                  */
/* ------------------------------------------------------------------ */

export const SUPPORTED_LANGUAGES = [
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
];

/* ------------------------------------------------------------------ */
/* 订单 / 负荷 / 活跃度元数据                                           */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_META = {
  matching: { label: "待匹配设计师", tone: "muted" as const },
  pending_schedule: { label: "待确认档期", tone: "blue" as const },
  pending_contract: { label: "待签约", tone: "amber" as const },
  in_progress: { label: "进行中", tone: "brand" as const },
  pending_review: { label: "待成果确认", tone: "blue" as const },
  in_revision: { label: "返修修改中", tone: "violet" as const },
  completed: { label: "已完成", tone: "emerald" as const },
  terminated: { label: "已终止", tone: "rose" as const },
  cancelled: { label: "已取消", tone: "muted" as const },
};

export const WORKLOAD_META = {
  free: { label: "空闲接单", color: "bg-emerald-500" },
  normal: { label: "接单正常", color: "bg-amber-500" },
  busy: { label: "接单饱满", color: "bg-rose-500" },
};

export const ACTIVITY_META = {
  green: { label: "近 3 天活跃", color: "bg-emerald-500" },
  yellow: { label: "3-15 天内登录", color: "bg-amber-400" },
  red: { label: "15 天以上未登录", color: "bg-rose-500" },
};

export const PLATFORM_FEE_RATE = 0.08;
export const FROZEN_PERIOD_DAYS = 30;

/** 平台管理费费率（v1.1：出图费的 10%） */
export const PLATFORM_MANAGEMENT_RATE = 0.1;
/** 商务费率：出图费 × 3% / 97%（v1.1） */
export const BUSINESS_FEE_RATE = 0.03 / 0.97;
/** 审图服务比例（v1.1：出图费的 8%） */
export const AUDIT_SERVICE_RATE = 0.08;
/** 项目管理服务比例（v1.1：出图费的 20%） */
export const PROJECT_MANAGEMENT_RATE = 0.2;
/** 景观扩初占施工图比例（v1.1：75%） */
export const LANDSCAPE_PRELIMINARY_RATE = 0.75;
/** 景观竣工图占施工图比例（v1.1：20%） */
export const LANDSCAPE_AS_BUILT_RATE = 0.2;
/** 园建协调附加系数（v1.1：1.1） */
export const GARDEN_COORDINATION_COEFFICIENT = 1.1;
