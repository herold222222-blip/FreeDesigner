"use client";

import { useEffect } from "react";
import { useRoleStore } from "@/store/role-store";
import { useFavoritesStore } from "@/store/favorites-store";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import {
  fetchClientFavoritesRequest,
  fetchPlatformPricingRequest,
} from "@/lib/api-client";
import { normalizePricingConfig } from "@/lib/platform-pricing";

/** 应用启动：同步登录态，并拉取平台参数 / 委托人收藏等业务数据。 */
export function AuthBootstrap() {
  const hydrateFromServer = useRoleStore((s) => s.hydrateFromServer);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const role = useRoleStore((s) => s.role);
  const setDesignerIds = useFavoritesStore((s) => s.setDesignerIds);
  const setPricingConfig = usePlatformPricingStore((s) => s.setConfig);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  useEffect(() => {
    if (!bootstrapped) return;
    fetchPlatformPricingRequest()
      .then((config) => setPricingConfig(normalizePricingConfig(config)))
      .catch(() => {
        /* 使用 store 默认值 */
      });
  }, [bootstrapped, setPricingConfig]);

  useEffect(() => {
    if (!bootstrapped || role !== "client") return;
    fetchClientFavoritesRequest()
      .then((res) => setDesignerIds(res.designerIds))
      .catch(() => setDesignerIds([]));
  }, [bootstrapped, role, setDesignerIds]);

  return null;
}
