"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/types";
import {
  fetchMe,
  logoutRequest,
  switchRoleRequest,
} from "@/lib/api-client";

interface RoleState {
  role: Role;
  identityId: string;
  /** 是否已与服务端会话同步完成 */
  bootstrapped: boolean;
  /** 本地设置角色（登录/注册成功后由调用方填入服务端返回的身份） */
  setRole: (role: Role, identityId?: string) => void;
  /** 启动时与服务端会话同步 */
  hydrateFromServer: () => Promise<void>;
  /** 切换当前生效角色（调用服务端会话切换） */
  switchRole: (role: Role, identityId?: string) => Promise<void>;
  /** 退出登录 */
  logout: () => Promise<void>;
}

const DEFAULT_IDENTITY_BY_ROLE: Record<Role, string> = {
  guest: "",
  client: "client_lin",
  designer: "designer_chen",
  admin: "admin_root",
  super_admin: "admin_super_root",
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: "guest",
      identityId: "",
      bootstrapped: false,
      setRole: (role, identityId) =>
        set({
          role,
          identityId: identityId ?? DEFAULT_IDENTITY_BY_ROLE[role],
        }),
      hydrateFromServer: async () => {
        try {
          const { user } = await fetchMe();
          if (user) {
            set({
              role: user.role,
              identityId: user.identityId,
              bootstrapped: true,
            });
          } else {
            set({ role: "guest", identityId: "", bootstrapped: true });
          }
        } catch {
          // 服务端不可用时保留本地持久化的角色，仅标记已尝试
          set({ bootstrapped: true });
        }
      },
      switchRole: async (role, identityId) => {
        const res = await switchRoleRequest(role, identityId);
        set({ role: res.role, identityId: res.identityId });
      },
      logout: async () => {
        try {
          await logoutRequest();
        } catch {
          /* 忽略 */
        }
        set({ role: "guest", identityId: "" });
      },
    }),
    {
      name: "lezyou-role",
      partialize: (s) => ({ role: s.role, identityId: s.identityId }),
    },
  ),
);
