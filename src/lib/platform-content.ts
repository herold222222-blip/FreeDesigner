export type OnboardingAgreementAudience =
  | "designer_individual"
  | "designer_team"
  | "designer_company"
  | "client_individual"
  | "client_enterprise";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
  order: number;
}

export interface PlatformContentConfig {
  faqs: FaqItem[];
  agreements: Record<OnboardingAgreementAudience, string>;
  aboutUs: string;
}

export const ONBOARDING_AGREEMENT_AUDIENCES: {
  key: OnboardingAgreementAudience;
  label: string;
}[] = [
  { key: "designer_individual", label: "个人设计师" },
  { key: "designer_team", label: "设计团队" },
  { key: "designer_company", label: "设计公司" },
  { key: "client_individual", label: "个人委托人" },
  { key: "client_enterprise", label: "企业委托人" },
];

export function cloneDefaultPlatformContent(): PlatformContentConfig {
  return {
    faqs: [
      {
        id: "faq_1",
        question: "平台如何保障交易安全？",
        answer:
          "委托人对每个付款阶段发起支付后，资金进入平台托管；验收确认后解冻并结算给设计师。",
        enabled: true,
        order: 1,
      },
      {
        id: "faq_2",
        question: "见习设计师有什么限制？",
        answer: "见习设计师同时仅可承接 1 单，完成首单后可申请晋级为中级。",
        enabled: true,
        order: 2,
      },
      {
        id: "faq_3",
        question: "企业委托人如何发布委托？",
        answer:
          "完成企业认证并上传营业执照后，即可发布常规委托与悬赏委托。",
        enabled: true,
        order: 3,
      },
    ],
    agreements: {
      designer_individual:
        "个人设计师入驻协议（演示）\n\n1. 您应保证提交的身份与资质信息真实有效。\n2. 接单后须按平台分阶段交付并配合验收。\n3. 平台有权对违规行为进行处理。",
      designer_team:
        "设计团队入驻协议（演示）\n\n1. 团队负责人对团队成员资质与交付负责。\n2. 团队信息变更须及时更新。\n3. 遵守平台结算与纠纷处理规则。",
      designer_company:
        "设计公司入驻协议（演示）\n\n1. 须上传有效营业执照并完成资质核验。\n2. 公司对外展示信息须与证照一致。\n3. 按平台费率与冻结规则结算。",
      client_individual:
        "个人委托人服务协议（演示）\n\n1. 发布需求须如实描述项目范围与预算。\n2. 按阶段验收并支付托管款项。\n3. 争议可发起平台调解。",
      client_enterprise:
        "企业委托人服务协议（演示）\n\n1. 企业认证通过后方可发布委托。\n2. 合同与发票信息以认证主体为准。\n3. 遵守平台资金托管与验收流程。",
    },
    aboutUs:
      "乐自由是面向建筑、景观、室内等设计领域的专业撮合与托管平台。\n\n我们连接委托人与设计师，提供分阶段托管、资质审核与纠纷调解服务，让设计合作更透明、更安全。",
  };
}

export function normalizePlatformContent(
  input?: Partial<PlatformContentConfig> | null,
): PlatformContentConfig {
  const defaults = cloneDefaultPlatformContent();
  if (!input) return defaults;
  return {
    faqs: input.faqs?.length ? input.faqs : defaults.faqs,
    agreements: {
      ...defaults.agreements,
      ...(input.agreements ?? {}),
    },
    aboutUs: input.aboutUs?.trim() ? input.aboutUs : defaults.aboutUs,
  };
}
