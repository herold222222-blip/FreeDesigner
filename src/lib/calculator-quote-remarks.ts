export type CalculatorQuoteRemarkVariant = "construction" | "scheme" | "both";

export interface CalculatorQuoteRemarkVariantConfig {
  /** 备注第 1 条：修改与增项条款 */
  modificationClause: string;
  /** 备注第 2 条；使用 {tax} 占位符插入所选税率文案 */
  taxLineTemplate: string;
  /** 备注第 3 条标题 */
  excludedHeading: string;
  /** 备注第 3 条下列举项 */
  excludedItems: string[];
}

export interface CalculatorQuoteRemarksConfig {
  construction: CalculatorQuoteRemarkVariantConfig;
  scheme: CalculatorQuoteRemarkVariantConfig;
  both: CalculatorQuoteRemarkVariantConfig;
}

const SHARED_MODIFICATION =
  "本协议按甲方已确定的方案实施，在甲方及建设方验收确认前免费修改，后因非乙方原因造成调整工作量超过10%，需另行收取设计费用。若需增加设计内容，则增加费用以上述单价费用为基础，甲乙双方协商确认。";

const EXCLUDED_HEADING = "设计费不含以下内容：";

const DEFAULT_TAX_TEMPLATE = "设计费包含的税费：{tax}。";

export const DEFAULT_CALCULATOR_QUOTE_REMARKS: CalculatorQuoteRemarksConfig = {
  construction: {
    modificationClause: SHARED_MODIFICATION,
    taxLineTemplate: DEFAULT_TAX_TEMPLATE,
    excludedHeading: EXCLUDED_HEADING,
    excludedItems: [
      "园林设计资质费用",
      "差旅费、驻场费、图纸打印费、专家顾问费、甲方要求调整方案费用",
      "地下室顶板的防水及排渗水层工程",
      "弱电工程及声光电智能设计、音乐喷泉、艺术水体的艺术效果及其控制设备的设计、水处理及净化系统工程、雨水回收处理设计",
      "专业艺术造型设计、膜结构、标识系统设计",
      "体量超出一般景观构筑物范畴之单体设计、建筑及室内装修设计、与建筑大楼相连通的连廊、雨篷等构筑物设计、建筑各入户的出入方式、别墅样板庭院设计、与建筑大楼相连通的残疾人坡道设计、入地库的非机动车道",
      "岩土工程，如特殊地基加固处理：如软基、膨胀土、冻胀土等基础处理",
      "高度超过3米的挡土墙、跨度大于等于8米的桥体结构、车行桥体结构、地库顶板结构加固以及超过5米的钢结构以及架空楼板超载加固非景观专业范畴内的设计内容",
      "其它超出景观园林施工图设计的内容（一般包括市政工程，水利设计、河道设计、河道改造设计、排洪设计、地下工程等项目）",
      "多媒体动画、项目沙盘、竣工图纸的绘制",
      "所有工程用料的品质保证和验收",
      "绿色建筑设计",
      "项目概算，预算，结算",
    ],
  },
  scheme: {
    modificationClause: SHARED_MODIFICATION,
    taxLineTemplate: DEFAULT_TAX_TEMPLATE,
    excludedHeading: EXCLUDED_HEADING,
    excludedItems: [
      "园林设计资质费用",
      "差旅费、驻场费、图纸打印费、专家顾问费",
      "弱电工程及声光电智能设计、音乐喷泉、艺术水体的艺术效果及其控制设备的设计、水处理及净化系统工程、雨水回收处理设计",
      "专业艺术造型设计、膜结构、标识系统设计",
      "体量超出一般景观构筑物范畴之单体设计、建筑及室内装修设计、与建筑大楼相连通的连廊、雨篷等构筑物设计、建筑各入户的出入方式、别墅样板庭院设计、与建筑大楼相连通的残疾人坡道设计、入地库的非机动车道",
      "岩土工程，如特殊地基加固处理：如软基、膨胀土、冻胀土等基础处理",
      "其它超出景观园林设计的内容（一般包括市政工程，水利设计、河道设计、河道改造设计、排洪设计、地下工程等项目）",
      "多媒体动画、项目沙盘、施工图，竣工图纸的绘制",
      "所有工程用料的品质保证和验收",
      "绿色建筑设计",
      "项目概算，预算，结算",
    ],
  },
  both: {
    modificationClause: SHARED_MODIFICATION,
    taxLineTemplate: DEFAULT_TAX_TEMPLATE,
    excludedHeading: EXCLUDED_HEADING,
    excludedItems: [
      "园林设计资质费用",
      "差旅费、驻场费、图纸打印费、专家顾问费",
      "地下室顶板的防水及排渗水层工程",
      "弱电工程及声光电智能设计、音乐喷泉、艺术水体的艺术效果及其控制设备的设计、水处理及净化系统工程、雨水回收处理设计",
      "专业艺术造型设计、膜结构、标识系统设计",
      "体量超出一般景观构筑物范畴之单体设计、建筑及室内装修设计、与建筑大楼相连通的连廊、雨篷等构筑物设计、建筑各入户的出入方式、别墅样板庭院设计、与建筑大楼相连通的残疾人坡道设计、入地库的非机动车道",
      "岩土工程，如特殊地基加固处理：如软基、膨胀土、冻胀土等基础处理",
      "高度超过3米的挡土墙、跨度大于等于8米的桥体结构、车行桥体结构、地库顶板结构加固以及超过5米的钢结构以及架空楼板超载加固非景观专业范畴内的设计内容",
      "其它超出景观园林施工图设计的内容（一般包括市政工程，水利设计、河道设计、河道改造设计、排洪设计、地下工程等项目）",
      "多媒体动画、项目沙盘、竣工图纸的绘制",
      "所有工程用料的品质保证和验收",
      "绿色建筑设计",
      "项目概算，预算，结算",
    ],
  },
};

function mergeVariantConfig(
  base: CalculatorQuoteRemarkVariantConfig,
  patch?: Partial<CalculatorQuoteRemarkVariantConfig>,
): CalculatorQuoteRemarkVariantConfig {
  if (!patch) return base;
  return {
    modificationClause: patch.modificationClause?.trim() || base.modificationClause,
    taxLineTemplate: patch.taxLineTemplate?.trim() || base.taxLineTemplate,
    excludedHeading: patch.excludedHeading?.trim() || base.excludedHeading,
    excludedItems:
      patch.excludedItems?.length && patch.excludedItems.some((x) => x.trim())
        ? patch.excludedItems.filter((x) => x.trim())
        : base.excludedItems,
  };
}

export function normalizeCalculatorQuoteRemarks(
  input?: Partial<CalculatorQuoteRemarksConfig>,
): CalculatorQuoteRemarksConfig {
  const base = DEFAULT_CALCULATOR_QUOTE_REMARKS;
  if (!input) return base;
  return {
    construction: mergeVariantConfig(base.construction, input.construction),
    scheme: mergeVariantConfig(base.scheme, input.scheme),
    both: mergeVariantConfig(base.both, input.both),
  };
}

export function formatQuoteTaxLine(template: string, taxLabel: string) {
  if (template.includes("{tax}")) {
    return template.replace(/\{tax\}/g, taxLabel);
  }
  return `${template}${taxLabel}`;
}

export function getCalculatorQuoteRemarks(
  variant: CalculatorQuoteRemarkVariant,
  taxLabel: string,
  config: CalculatorQuoteRemarksConfig = DEFAULT_CALCULATOR_QUOTE_REMARKS,
) {
  const set = config[variant];
  return {
    modificationClause: set.modificationClause,
    taxLine: formatQuoteTaxLine(set.taxLineTemplate, taxLabel),
    excludedHeading: set.excludedHeading,
    excludedItems: set.excludedItems,
  };
}

export function resolveCalculatorQuoteRemarkVariant(
  hasConstruction: boolean,
  hasScheme: boolean,
): CalculatorQuoteRemarkVariant | null {
  if (hasConstruction && hasScheme) return "both";
  if (hasConstruction) return "construction";
  if (hasScheme) return "scheme";
  return null;
}

export const CALCULATOR_QUOTE_REMARK_VARIANT_LABELS: Record<
  CalculatorQuoteRemarkVariant,
  string
> = {
  construction: "仅施工图设计费",
  scheme: "仅方案设计费",
  both: "方案 + 施工图设计费",
};
