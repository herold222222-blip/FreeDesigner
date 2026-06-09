"use client";

import { create } from "zustand";
import {
  cloneDefaultPricingConfig,
  normalizePricingConfig,
  type PlatformPricingConfig,
} from "@/lib/platform-pricing";

interface PlatformPricingState {
  config: PlatformPricingConfig;
  setConfig: (config: PlatformPricingConfig) => void;
  resetConfig: () => void;
}

/** 平台费率由 auth-bootstrap 从 API 灌入，不再持久化到 localStorage */
export const usePlatformPricingStore = create<PlatformPricingState>()((set) => ({
  config: cloneDefaultPricingConfig(),
  setConfig: (config) => set({ config: normalizePricingConfig(config) }),
  resetConfig: () => set({ config: cloneDefaultPricingConfig() }),
}));
