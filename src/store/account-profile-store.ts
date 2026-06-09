"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountProfileState {
  phoneByIdentity: Record<string, string>;
  logoByIdentity: Record<string, string>;
  setPhone: (identityId: string, phone: string) => void;
  setLogo: (identityId: string, logoUrl: string) => void;
  getPhone: (identityId: string, fallback: string) => string;
  getLogo: (identityId: string, fallback: string) => string;
}

export const useAccountProfileStore = create<AccountProfileState>()(
  persist(
    (set, get) => ({
      phoneByIdentity: {},
      logoByIdentity: {},
      setPhone: (identityId, phone) =>
        set({
          phoneByIdentity: { ...get().phoneByIdentity, [identityId]: phone },
        }),
      setLogo: (identityId, logoUrl) =>
        set({
          logoByIdentity: { ...get().logoByIdentity, [identityId]: logoUrl },
        }),
      getPhone: (identityId, fallback) =>
        get().phoneByIdentity[identityId] ?? fallback,
      getLogo: (identityId, fallback) =>
        get().logoByIdentity[identityId] ?? fallback,
    }),
    { name: "lezyou-account-profile" },
  ),
);

/** 简单手机号校验（中国大陆 11 位） */
export function isValidMobilePhone(phone: string) {
  return /^1\d{10}$/.test(phone.replace(/\s/g, ""));
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)} **** ${digits.slice(-4)}`;
}
