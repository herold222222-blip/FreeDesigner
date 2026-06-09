import type { Client } from "@/lib/types";

export const clients: Client[] = [
  {
    id: "client_lin",
    code: "CL000001",
    name: "林家三口",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=林家&backgroundColor=E11D48&textColor=ffffff",
    type: "individual",
    verified: true,
    location: "广东省 · 深圳市 · 南山区",
    joinedAt: "2025-09-12",
    level: "premium",
    favoriteDesignerIds: ["designer_li", "designer_zhao"],
    yearlyPaidAmount: 280_000,
  },
  {
    id: "client_yu",
    code: "CL000002",
    name: "禹生文旅集团",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=禹生&backgroundColor=0a0a0a&textColor=ffffff",
    type: "enterprise",
    verified: true,
    companyName: "禹生文旅产业（深圳）有限公司",
    contactName: "万先生",
    location: "广东省 · 深圳市 · 福田区",
    joinedAt: "2024-11-03",
    level: "strategic",
    favoriteDesignerIds: ["designer_he", "designer_chen", "designer_wang"],
    yearlyPaidAmount: 1_280_000,
  },
  {
    id: "client_qing",
    code: "CL000003",
    name: "青源置业",
    avatar:
      "https://api.dicebear.com/7.x/initials/png?seed=青源&backgroundColor=525252&textColor=ffffff",
    type: "enterprise",
    verified: false,
    companyName: "青源置业（杭州）有限公司",
    contactName: "彭先生",
    location: "浙江省 · 杭州市 · 西湖区",
    joinedAt: "2026-04-21",
    level: "normal",
    favoriteDesignerIds: [],
    yearlyPaidAmount: 0,
  },
];

export function getClientById(id: string) {
  return clients.find((c) => c.id === id);
}
