/** 增值服务人员（审图师 / 施工图项目管理员，非设计师库） */
export interface ServiceProvider {
  id: string;
  name: string;
  avatar: string;
  role: "auditor" | "project_manager";
  title: string;
  credential?: string;
}

export const serviceProviders: ServiceProvider[] = [
  {
    id: "sp_audit_garden",
    name: "冯建",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=FJ&backgroundColor=d97706&textColor=ffffff",
    role: "auditor",
    title: "注册审图师 · 景观园建",
    credential: "一级注册建筑师 / 景观审图 12 年",
  },
  {
    id: "sp_audit_green",
    name: "叶青",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=YQ&backgroundColor=059669&textColor=ffffff",
    role: "auditor",
    title: "注册审图师 · 景观绿化",
    credential: "高级工程师 / 绿化专项审图",
  },
  {
    id: "sp_audit_drain",
    name: "石波",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=SB&backgroundColor=0284c7&textColor=ffffff",
    role: "auditor",
    title: "注册审图师 · 景观给排水",
    credential: "给排水高级工程师 / 海绵城市专项",
  },
  {
    id: "sp_audit_elec",
    name: "雷鸣",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=LM&backgroundColor=7c3aed&textColor=ffffff",
    role: "auditor",
    title: "注册审图师 · 景观电气",
    credential: "电气高级工程师 / 夜景照明审图",
  },
  {
    id: "sp_pm_001",
    name: "顾航",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=GH&backgroundColor=6366f1&textColor=ffffff",
    role: "project_manager",
    title: "施工图项目管理员",
    credential: "景观施工图 PM · 8 年 / 上海本地",
  },
];

export function getServiceProviderById(id: string) {
  return serviceProviders.find((p) => p.id === id);
}
