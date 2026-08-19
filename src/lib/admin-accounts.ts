import type { Role } from "@/lib/types";

export type PresetAccountDef = {
  loginName: string;
  password: string;
  role: Role;
  name: string;
  /** 无 Client/Designer 资料，登录后引导注册身份 */
  needsOnboarding?: boolean;
};

/**
 * 种子预设账号（账号 + 密码可直接登录）
 * FD001 超管 · FD002–FD004 管理员 · FD005–FD020 普通账号（可再注册委托/设计身份）
 */
export const PRESET_ACCOUNTS: PresetAccountDef[] = [
  {
    loginName: "FD001",
    password: "FD19076652",
    role: "super_admin",
    name: "乐平",
  },
  {
    loginName: "FD002",
    password: "FD4006801231",
    role: "admin",
    name: "普通管理员 A",
  },
  {
    loginName: "FD003",
    password: "FD4006801231",
    role: "admin",
    name: "普通管理员 B",
  },
  {
    loginName: "FD004",
    password: "FD4006801231",
    role: "admin",
    name: "普通管理员 C",
  },
  ...Array.from({ length: 16 }, (_, i) => {
    const n = i + 5;
    const loginName = `FD${String(n).padStart(3, "0")}`;
    return {
      loginName,
      password: "4006801231",
      role: "client" as const,
      name: `普通账号 ${String(n).padStart(2, "0")}`,
      needsOnboarding: true,
    };
  }),
];

/** 兼容旧引用：超级管理员默认账号 */
export const SUPER_ADMIN_LOGIN_NAME = "FD001";
export const SUPER_ADMIN_DEFAULT_PASSWORD = "FD19076652";

/** 兼容旧引用：平台管理员默认账号 */
export const PLATFORM_ADMIN_LOGIN_NAME = "FD002";
export const PLATFORM_ADMIN_DEFAULT_PASSWORD = "FD4006801231";
