"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type {
  AdminClientRow,
  AdminDesignerRow,
  Bounty,
  Client,
  Designer,
  DesignerProjectReview,
  Dispute,
  Order,
  PlatformAdminAccount,
  ScheduleRequest,
} from "@/lib/types";
import type { ServiceProvider } from "@/mocks/service-providers";
import type { FeedbackMessage, ReviewItem, WalletTransaction } from "@/lib/types";
import type { ContractTemplatesConfig } from "@/lib/contract-templates";
import { cloneDefaultContractTemplates } from "@/lib/contract-templates";
import type { PlatformContentConfig } from "@/lib/platform-content";
import { cloneDefaultPlatformContent } from "@/lib/platform-content";
import type { WithdrawalRequest } from "@/lib/withdrawal-requests";
import { cloneDefaultLevelManagement } from "@/lib/level-management";
import type { CategoryLevelStats } from "@/lib/level-management";
import type { LevelManagementConfig } from "@/lib/level-management";

export interface WalletSummary {
  totalIncome: number;
  pendingFrozen: number;
  available: number;
  withdrawn: number;
  feeAccumulated: number;
  topUpBalance: number;
  totalSpent: number;
  pendingPayments: number;
  refundableEscrow: number;
  monthlyTrend: { month: string; income: number; withdraw: number }[];
}

export interface WalletPayload {
  transactions: WalletTransaction[];
  summary: WalletSummary;
}

const EMPTY_WALLET: WalletPayload = {
  transactions: [],
  summary: {
    totalIncome: 0,
    pendingFrozen: 0,
    available: 0,
    withdrawn: 0,
    feeAccumulated: 0,
    topUpBalance: 0,
    totalSpent: 0,
    pendingPayments: 0,
    refundableEscrow: 0,
    monthlyTrend: [],
  },
};

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** 通用：拉取一个返回 { ok, data } 的 GET 端点 */
function useApi<T>(path: string | null, fallback: T): AsyncState<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiFetch<T>(path)
      .then((d) => {
        if (active) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, nonce]);

  return { data, loading, error, refresh: () => setNonce((n) => n + 1) };
}

export function useDesigners() {
  return useApi<Designer[]>("/api/designers", []);
}

/** 管理员用户管理：含设计师注册手机号与账号状态 */
export function useAdminDesigners() {
  return useApi<AdminDesignerRow[]>("/api/admin/designers", []);
}

export function useDesigner(id: string | null | undefined) {
  return useApi<Designer | null>(id ? `/api/designers/${id}` : null, null);
}

export function useDesignerReviews(id: string | null | undefined) {
  return useApi<DesignerProjectReview[]>(
    id ? `/api/designers/${id}/reviews` : null,
    []
  );
}

export function useBounties() {
  return useApi<Bounty[]>("/api/bounties", []);
}

export function useBounty(id: string | null | undefined) {
  return useApi<Bounty | null>(id ? `/api/bounties/${id}` : null, null);
}

export function useOrders() {
  return useApi<Order[]>("/api/orders", []);
}

export function useOrder(id: string | null | undefined) {
  return useApi<Order | null>(id ? `/api/orders/${id}` : null, null);
}

export function useScheduleRequests() {
  return useApi<ScheduleRequest[]>("/api/schedule-requests", []);
}

export function useServiceProviders() {
  return useApi<ServiceProvider[]>("/api/service-providers", []);
}

export function useClient(id: string | null | undefined) {
  return useApi<Client | null>(id ? `/api/clients/${id}` : null, null);
}

export function useClients(enabled = true) {
  return useApi<Client[]>(enabled ? "/api/clients" : null, []);
}

/** 管理员用户管理：含委托人注册手机号与统计 */
export function useAdminClients() {
  return useApi<AdminClientRow[]>("/api/admin/clients", []);
}

/** 平台管理员列表（仅超级管理员控制台） */
export function usePlatformAdmins(enabled = true) {
  return useApi<PlatformAdminAccount[]>(
    enabled ? "/api/platform-admins" : null,
    [],
  );
}

export function useReviewItems() {
  return useApi<ReviewItem[]>("/api/review-items", []);
}

export function useDisputes() {
  return useApi<Dispute[]>("/api/disputes", []);
}

export function useDisputeCounts(enabled = true) {
  return useApi<{ active: number }>(
    enabled ? "/api/disputes/counts" : null,
    { active: 0 },
  );
}

export function useWallet() {
  return useApi<WalletPayload>("/api/wallet", EMPTY_WALLET);
}

export function usePlatformContent() {
  return useApi<PlatformContentConfig>(
    "/api/platform-content",
    cloneDefaultPlatformContent(),
  );
}

export function useFeedbackMessages() {
  return useApi<FeedbackMessage[]>("/api/feedback", []);
}

export function useLevelManagement() {
  return useApi<LevelManagementConfig>(
    "/api/level-management",
    cloneDefaultLevelManagement(),
  );
}

export function useLevelManagementStats() {
  return useApi<CategoryLevelStats[]>("/api/level-management/stats", []);
}

export function useWithdrawalRequests() {
  return useApi<WithdrawalRequest[]>("/api/withdrawal-requests", []);
}

export function useContractTemplates() {
  return useApi<ContractTemplatesConfig>(
    "/api/contract-templates",
    cloneDefaultContractTemplates(),
  );
}
