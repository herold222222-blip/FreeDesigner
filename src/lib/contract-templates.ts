export type ContractTemplateCategory =
  | "standard"
  | "bounty"
  | "scan_order"
  | "monthly"
  | "back_to_back"
  | "onsite";

export interface ContractTemplate {
  id: string;
  name: string;
  category: ContractTemplateCategory;
  description: string;
  content: string;
  enabled: boolean;
  order: number;
  updatedAt: string;
}

export interface ContractTemplatesConfig {
  templates: ContractTemplate[];
}

export const CONTRACT_TEMPLATE_CATEGORIES: {
  key: ContractTemplateCategory;
  label: string;
}[] = [
  { key: "standard", label: "标准设计服务" },
  { key: "bounty", label: "悬赏选定" },
  { key: "scan_order", label: "扫码下单" },
  { key: "monthly", label: "按月雇佣" },
  { key: "back_to_back", label: "背靠背项目" },
  { key: "onsite", label: "线下上门" },
];

const CATEGORY_LABELS = Object.fromEntries(
  CONTRACT_TEMPLATE_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<ContractTemplateCategory, string>;

export function contractTemplateCategoryLabel(
  category: ContractTemplateCategory,
) {
  return CATEGORY_LABELS[category] ?? category;
}

export function cloneDefaultContractTemplates(): ContractTemplatesConfig {
  const now = new Date().toISOString();
  return {
    templates: [
      {
        id: "ct_standard",
        name: "乐自由工程设计服务合同（标准版）",
        category: "standard",
        description:
          "适用于定向下单、常规委托等按阶段托管的标准设计服务。",
        enabled: true,
        order: 1,
        updatedAt: now,
        content: `乐自由工程设计服务合同

甲方（委托人）：{{clientName}}
乙方（设计方）：{{designerName}}
项目编号：{{orderCode}}

一、项目概况
项目名称：{{projectTitle}}
设计专业：{{specialty}}
合同总额：人民币 {{totalAmount}} 元（含税）

二、付款阶段
{{paymentStages}}

三、交付与验收
乙方按约定阶段提交成果，甲方在平台确认验收后，对应款项解冻结算。

四、知识产权
成果著作权归甲方所有，乙方保留作品集展示权（经甲方同意）。

五、争议解决
协商不成时，提交平台调解；调解不成按中华人民共和国法律处理。

签署日期：{{signedAt}}`,
      },
      {
        id: "ct_bounty",
        name: "悬赏选定设计服务合同",
        category: "bounty",
        description: "悬赏委托选定设计师后生成的服务合同。",
        enabled: true,
        order: 2,
        updatedAt: now,
        content: `悬赏选定设计服务合同

本合同由悬赏项目 {{bountyTitle}} 选定乙方 {{designerName}} 后自动生成。
悬赏编号：{{bountyCode}}
合同总额：{{totalAmount}} 元

付款按平台默认阶段（预付款 / 中期 / 尾款）执行，验收规则同标准合同。`,
      },
      {
        id: "ct_scan",
        name: "扫码快捷下单服务合同",
        category: "scan_order",
        description: "设计师扫码报价、委托人确认后的电子合同。",
        enabled: true,
        order: 3,
        updatedAt: now,
        content: `扫码快捷下单服务合同

报价设计师：{{designerName}}
委托人：{{clientName}}
报价金额：{{totalAmount}} 元
付款阶段：{{customStages}}

双方扫码确认后本合同生效，预付款到账即启动服务。`,
      },
      {
        id: "ct_monthly",
        name: "按月雇佣设计服务合同",
        category: "monthly",
        description: "按月驻场或远程雇佣的设计师服务合同。",
        enabled: true,
        order: 4,
        updatedAt: now,
        content: `按月雇佣设计服务合同

雇佣周期：{{hirePeriod}}
月费标准：{{monthlyRate}} 元/月
服务方式：{{serviceMode}}

按月预付，每月验收后结算；提前终止须提前 15 日书面通知。`,
      },
      {
        id: "ct_b2b",
        name: "背靠背项目服务合同",
        category: "back_to_back",
        description: "战略客户背靠背项目，费率上浮 30%。",
        enabled: true,
        order: 5,
        updatedAt: now,
        content: `背靠背项目服务合同

甲方为平台认证战略客户，适用背靠背结算条款。
项目总价已含费率上浮 30%，付款可享延期支付特权。

上游合同编号：{{upstreamContractId}}
本项目编号：{{orderCode}}`,
      },
      {
        id: "ct_onsite",
        name: "线下上门服务合同",
        category: "onsite",
        description: "含上门勘场、驻场设计的线下服务合同。",
        enabled: true,
        order: 6,
        updatedAt: now,
        content: `线下上门服务合同

服务地址：{{onsiteAddress}}
上门档期：{{onsiteSchedule}}
日费率：{{dailyRate}} 元/天

差旅与住宿费用由 {{travelPayer}} 承担，明细见附件。`,
      },
    ],
  };
}

export function normalizeContractTemplates(
  input?: Partial<ContractTemplatesConfig> | null,
): ContractTemplatesConfig {
  const defaults = cloneDefaultContractTemplates();
  if (!input?.templates?.length) return defaults;
  return {
    templates: input.templates.map((t, i) => ({
      ...defaults.templates.find((d) => d.id === t.id),
      ...t,
      order: t.order ?? i + 1,
      enabled: t.enabled ?? true,
    })),
  };
}
