import type { Role } from "@/lib/types";

/** 演示身份切换器支持的键（含设计师子类型，会话 role 仍为 designer） */
export type DemoIdentityKey =
  | "client"
  | "designer"
  | "designer_team"
  | "designer_company"
  | "admin"
  | "super_admin"
  | "guest";

export type DemoIdentityOption = {
  key: DemoIdentityKey;
  label: string;
  description: string;
  route: string;
  /** 建立会话时写入的角色 */
  sessionRole: Role;
  /** 种子账号手机号（guest 无） */
  phone?: string;
  /** 设计师身份 ID（仅设计师类演示账号） */
  designerId?: string;
};

/** 与 prisma/seed.ts 中设计师序号对应的手机号 */
export const DEMO_IDENTITIES: DemoIdentityOption[] = [
  {
    key: "client",
    label: "委托人 · 林先生",
    description: "个人委托人，正在装修上海徐汇复式住宅。",
    route: "/client",
    sessionRole: "client",
    phone: "13800010000",
  },
  {
    key: "designer",
    label: "设计师 · 陈牧之",
    description: "12 年景观施工图（园建+绿化），手上 3 单进行中。",
    route: "/designer",
    sessionRole: "designer",
    phone: "13900010000",
    designerId: "designer_chen",
  },
  {
    key: "designer_team",
    label: "设计团队 · 王舒景观施工图团队",
    description: "21–50 人景观团队，市政与文旅给排水及夜景照明施工图。",
    route: "/designer",
    sessionRole: "designer",
    phone: "13900040000",
    designerId: "designer_wang",
  },
  {
    key: "designer_company",
    label: "设计公司 · 远境建筑设计有限公司",
    description: "甲级资质建筑公司，方案到施工图全流程，多专业一体化交付。",
    route: "/designer",
    sessionRole: "designer",
    phone: "13900090000",
    designerId: "designer_yuanjing",
  },
  {
    key: "admin",
    label: "管理员 · 平台总后台",
    description: "审核入驻、监管订单、处理纠纷。",
    route: "/admin",
    sessionRole: "admin",
    phone: "13700000000",
  },
  {
    key: "super_admin",
    label: "超级管理员 · 平台参数中心",
    description: "拥有管理员全部能力，并可修改全局计费参数。",
    route: "/super-admin",
    sessionRole: "super_admin",
    phone: "13700000001",
  },
  {
    key: "guest",
    label: "访客 · 公开浏览",
    description: "未登录状态，只能浏览设计师与悬赏。",
    route: "/",
    sessionRole: "guest",
  },
];

export function resolveDemoIdentity(key: DemoIdentityKey): DemoIdentityOption {
  const found = DEMO_IDENTITIES.find((d) => d.key === key);
  if (!found) return DEMO_IDENTITIES[DEMO_IDENTITIES.length - 1];
  return found;
}

/** 根据当前会话推断演示身份键（用于切换器高亮） */
export function inferDemoIdentityKey(role: Role, identityId: string): DemoIdentityKey {
  if (role === "designer") {
    const match = DEMO_IDENTITIES.find(
      (d) => d.designerId && d.designerId === identityId,
    );
    return match?.key ?? "designer";
  }
  if (role === "guest") return "guest";
  return role;
}
