"use client";

import type { ContractTemplatesConfig } from "@/lib/contract-templates";
import type { PlatformContentConfig } from "@/lib/platform-content";
import type { WithdrawalRequest } from "@/lib/withdrawal-requests";
import type {
  CategoryLevelStats,
  LevelCategory,
  LevelManagementConfig,
} from "@/lib/level-management";
import type {
  BillingMode,
  Bounty,
  CompanyQualification,
  CreateInvoiceInput,
  Designer,
  FeedbackMessage,
  InvoiceRequest,
  Dispute,
  DisputeResolution,
  Order,
  PlatformAdminAccount,
  Role,
  ServiceMode,
  TeamSizeOption,
} from "@/lib/types";

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** 统一请求封装：自动带 cookie、解析 { ok, data } 信封 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let body: ApiResult<T> | null = null;
  try {
    body = (await res.json()) as ApiResult<T>;
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `请求失败 (${res.status})`);
  }
  return body.data as T;
}

/* --------------- 鉴权相关 --------------- */

export interface SessionUserDTO {
  userId: string;
  role: Role;
  identityId: string;
  name: string;
  avatar?: string | null;
  phone?: string;
}

export function sendCode(phone: string, purpose: "login" | "register") {
  return apiFetch<{ sent: boolean; demoCode?: string }>("/api/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, purpose }),
  });
}

export function verifyCodeRequest(params: {
  phone: string;
  code: string;
  purpose?: "login" | "register";
}) {
  return apiFetch<{ verified: boolean }>("/api/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({
      phone: params.phone,
      code: params.code,
      purpose: params.purpose ?? "register",
    }),
  });
}

export function loginRequest(params: {
  phone?: string;
  loginName?: string;
  code?: string;
  password?: string;
  role?: Role;
}) {
  return apiFetch<SessionUserDTO>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function registerRequest(params: {
  phone: string;
  code: string;
  kind: "client" | "designer_individual" | "designer_team" | "designer_company";
  name?: string;
  clientType?: "individual" | "enterprise";
  location?: string;
  companyName?: string;
  avatar?: string;
  gender?: "male" | "female";
  teamName?: string;
  contactName?: string;
  foundedYear?: number;
  teamSize?: TeamSizeOption;
  locationScope?: "domestic" | "overseas";
  overseasCountry?: string;
  creditCode?: string;
  businessScope?: string;
  companyQualificationNone?: boolean;
  companyQualifications?: CompanyQualification[];
}) {
  return apiFetch<SessionUserDTO & { needsOnboarding?: boolean }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

export function fetchMe() {
  return apiFetch<{ user: SessionUserDTO | null }>("/api/auth/me");
}

export function logoutRequest() {
  return apiFetch<{ loggedOut: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export function switchRoleRequest(role: Role, identityId?: string) {
  return apiFetch<{ role: Role; identityId: string }>("/api/auth/switch-role", {
    method: "POST",
    body: JSON.stringify({ role, identityId }),
  });
}

/* --------------- 订单写操作 --------------- */

export interface CreateOrderBody {
  designerId?: string;
  title: string;
  specialty?: string;
  subSpecialty?: string;
  projectType?: string;
  serviceMode?: ServiceMode;
  billingMode?: BillingMode;
  orderSource?: string;
  totalAmount: number;
  description?: string;
  projectAreaSqm?: number;
  selectedSlots?: unknown[];
  selectedMonths?: string[];
  address?: string;
  scheduleFrom?: string;
  scheduleTo?: string;
  withAuditService?: boolean;
  withProjectManagement?: boolean;
  customStageRatios?: { name: string; ratio: number }[];
}

export function createOrderRequest(body: CreateOrderBody) {
  return apiFetch<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function acceptOrderRequest(orderId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/accept`, { method: "POST" });
}

export function rejectOrderScheduleRequest(orderId: string, reason?: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/reject-schedule`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchScheduleRequestsRequest() {
  return apiFetch<import("@/lib/types").ScheduleRequest[]>(
    "/api/schedule-requests",
  );
}

export function createBountyRequest(body: Partial<import("@/lib/types").Bounty>) {
  return apiFetch<import("@/lib/types").Bounty>("/api/bounties", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function signOrderRequest(orderId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/sign`, { method: "POST" });
}

export function payStageRequest(orderId: string, stageId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/stages/${stageId}/pay`, {
    method: "POST",
  });
}

/* --------------- 支付（微信 / 支付宝 / 沙箱）--------------- */

export interface PayIntentDTO {
  paymentId: string;
  provider: "sandbox" | "wechat" | "alipay";
  status: "pending" | "paid";
  amount: number;
  qrCodeContent?: string;
  redirectUrl?: string;
  sandbox: boolean;
}

export function createPayIntentRequest(orderId: string, stageId: string) {
  return apiFetch<PayIntentDTO>(
    `/api/orders/${orderId}/stages/${stageId}/pay-intent`,
    { method: "POST" }
  );
}

export function getPaymentRequest(paymentId: string) {
  return apiFetch<{ paymentId: string; status: string; provider: string }>(
    `/api/payments/${paymentId}`
  );
}

export function resolveReviewItemRequest(
  id: string,
  action: "approve" | "reject",
) {
  return apiFetch<{ id: string; status: string }>(
    `/api/review-items/${id}/resolve`,
    { method: "POST", body: JSON.stringify({ action }) },
  );
}

export function setDesignerLevelRequest(designerId: string, level: string) {
  return apiFetch<Designer>(`/api/designers/${designerId}`, {
    method: "PATCH",
    body: JSON.stringify({ level }),
  });
}

export function updateAdminDesignerRequest(
  designerId: string,
  body: {
    accountStatus?: "active" | "disabled";
    name?: string;
    phone?: string;
    level?: string;
    designer?: Designer;
  },
) {
  return apiFetch<Designer>(`/api/admin/designers/${designerId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAdminDesignerRequest(designerId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/designers/${designerId}`, {
    method: "DELETE",
  });
}

export function updateAdminClientRequest(
  clientId: string,
  body: {
    accountStatus?: "active" | "disabled";
    name?: string;
    phone?: string;
    level?: string;
    client?: import("@/lib/types").Client;
  },
) {
  return apiFetch<import("@/lib/types").Client>(`/api/admin/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAdminClientRequest(clientId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/clients/${clientId}`, {
    method: "DELETE",
  });
}

export interface AdminClientPaymentsPayload {
  client: import("@/lib/types").Client;
  transactions: import("@/lib/types").WalletTransaction[];
  totalPaidAmount: number;
}

export function fetchAdminClientPayments(clientId: string) {
  return apiFetch<AdminClientPaymentsPayload>(
    `/api/admin/clients/${clientId}/payments`,
  );
}

export function sandboxConfirmRequest(paymentId: string) {
  return apiFetch<{ paymentId: string; status: string }>(
    `/api/payments/${paymentId}/sandbox-confirm`,
    { method: "POST" }
  );
}

export function releaseStageRequest(orderId: string, stageId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/stages/${stageId}/release`, {
    method: "POST",
  });
}

export function designerSignOrderRequest(orderId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/designer-sign`, {
    method: "POST",
  });
}

export function submitStageDeliverablesRequest(
  orderId: string,
  stageId: string,
  files?: import("@/lib/types").DeliverableFile[],
) {
  return apiFetch<Order>(
    `/api/orders/${orderId}/stages/${stageId}/deliverables`,
    {
      method: "POST",
      body: JSON.stringify({ files }),
    },
  );
}

export function requestStageRevisionRequest(
  orderId: string,
  stageId: string,
  description?: string,
) {
  return apiFetch<Order>(
    `/api/orders/${orderId}/stages/${stageId}/revision`,
    {
      method: "POST",
      body: JSON.stringify({ description }),
    },
  );
}

export function confirmFinalSettlementRequest(orderId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/complete`, { method: "POST" });
}

export function requestProjectSettlementRequest(orderId: string) {
  return apiFetch<Order>(`/api/orders/${orderId}/settlement-request`, {
    method: "POST",
  });
}

export function submitOrderReviewRequest(
  orderId: string,
  body: {
    overall: number;
    breakdown: import("@/lib/types").RatingBreakdown;
    content: string;
    impressionTags?: string[];
    clientDisplayName?: string;
  },
) {
  return apiFetch<Order>(`/api/orders/${orderId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function awardBountyRequest(bountyId: string, designerId: string) {
  return apiFetch<Order>(`/api/bounties/${bountyId}/award`, {
    method: "POST",
    body: JSON.stringify({ designerId }),
  });
}

export function fetchPlatformPricingRequest() {
  return apiFetch<import("@/lib/platform-pricing").PlatformPricingConfig>(
    "/api/platform-pricing",
  );
}

export function savePlatformPricingRequest(
  config: import("@/lib/platform-pricing").PlatformPricingConfig,
) {
  return apiFetch<import("@/lib/platform-pricing").PlatformPricingConfig>(
    "/api/platform-pricing",
    { method: "PUT", body: JSON.stringify(config) },
  );
}

export function fetchClientFavoritesRequest() {
  return apiFetch<{ designerIds: string[] }>("/api/clients/me/favorites");
}

export function toggleClientFavoriteRequest(designerId: string) {
  return apiFetch<{ designerIds: string[] }>("/api/clients/me/favorites", {
    method: "POST",
    body: JSON.stringify({ designerId }),
  });
}

export function setClientFavoritesRequest(designerIds: string[]) {
  return apiFetch<{ designerIds: string[] }>("/api/clients/me/favorites", {
    method: "PUT",
    body: JSON.stringify({ designerIds }),
  });
}

export function updateDesignerProfileRequest(
  designerId: string,
  body: {
    profile?: import("@/lib/designer-profile-draft").DesignerProfileDraft;
    ratePercents?: Record<string, number>;
    calendar?: import("@/lib/types").Designer["calendar"];
    workCalendarEvents?: import("@/lib/types").Designer["workCalendarEvents"];
    calendarBatchSettings?: import("@/lib/types").Designer["calendarBatchSettings"];
  },
) {
  return apiFetch<import("@/lib/types").Designer>(
    `/api/designers/${designerId}/profile`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export interface ContractViewPayload {
  order: import("@/lib/types").Order;
  client: { id: string; name: string; type: string } | null;
  designer: { id: string; name: string; location?: string } | null;
}

export function fetchContractViewRequest(contractId: string) {
  return apiFetch<ContractViewPayload>(`/api/contracts/${contractId}`);
}

export function assignDesignerToOrderRequest(
  orderId: string,
  designerId: string,
  totalAmount?: number,
) {
  return apiFetch<Order>(`/api/orders/${orderId}/assign`, {
    method: "POST",
    body: JSON.stringify({ designerId, totalAmount }),
  });
}

/* --------------- 等级管理 --------------- */

export function saveLevelManagementRequest(config: LevelManagementConfig) {
  return apiFetch<LevelManagementConfig>("/api/level-management", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function fetchLevelManagementStatsRequest() {
  return apiFetch<CategoryLevelStats[]>("/api/level-management/stats");
}

export function migrateLevelUsersRequest(body: {
  category: LevelCategory;
  fromLevelId: string;
  toLevelId: string;
}) {
  return apiFetch<{ migrated: number }>("/api/level-management/migrate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* --------------- 平台内容与意见反馈 --------------- */

export function fetchPlatformContentRequest() {
  return apiFetch<PlatformContentConfig>("/api/platform-content");
}

export function savePlatformContentRequest(config: PlatformContentConfig) {
  return apiFetch<PlatformContentConfig>("/api/platform-content", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function submitFeedbackRequest(body: {
  message: string;
  userName?: string;
  phone?: string;
  identityId?: string;
}) {
  return apiFetch<FeedbackMessage>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateFeedbackRequest(
  id: string,
  body: { status?: FeedbackMessage["status"]; replyNote?: string },
) {
  return apiFetch<FeedbackMessage>(`/api/feedback/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* --------------- 提现审批 --------------- */

export function resolveWithdrawalRequest(
  id: string,
  action: "approve" | "reject" | "pay",
  rejectReason?: string,
) {
  return apiFetch<WithdrawalRequest>(`/api/withdrawal-requests/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, rejectReason }),
  });
}

/* --------------- 合同模板 --------------- */

export function saveContractTemplatesRequest(config: ContractTemplatesConfig) {
  return apiFetch<ContractTemplatesConfig>("/api/contract-templates", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/* --------------- 悬赏写操作 --------------- */

export function applyBountyRequest(
  bountyId: string,
  body: {
    appliedL3: string;
    proposal?: string;
    quotedAmount?: number;
    estimatedDays?: number;
  }
) {
  return apiFetch<Bounty>(`/api/bounties/${bountyId}/apply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function pauseBountyRequest(bountyId: string) {
  return apiFetch<Bounty>(`/api/bounties/${bountyId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "pause" }),
  });
}

export function resumeBountyRequest(bountyId: string) {
  return apiFetch<Bounty>(`/api/bounties/${bountyId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "resume" }),
  });
}

export function updateBountyRequest(
  bountyId: string,
  body: {
    title?: string;
    description?: string;
    reward?: number;
    deadline?: string;
    requirements?: string[];
  },
) {
  return apiFetch<Bounty>(`/api/bounties/${bountyId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "update", ...body }),
  });
}

export function deleteBountyRequest(bountyId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/bounties/${bountyId}`, {
    method: "DELETE",
  });
}

/* --------------- 平台管理员（超级管理员） --------------- */

export function fetchPlatformAdmins() {
  return apiFetch<PlatformAdminAccount[]>("/api/platform-admins");
}

export function createPlatformAdminRequest(body: {
  loginName: string;
  name: string;
  password: string;
  phone?: string;
}) {
  return apiFetch<PlatformAdminAccount>("/api/platform-admins", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePlatformAdminRequest(
  id: string,
  body: { password?: string; status?: "active" | "disabled" },
) {
  return apiFetch<PlatformAdminAccount>(`/api/platform-admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePlatformAdminRequest(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/platform-admins/${id}`, {
    method: "DELETE",
  });
}

/* --------------- 纠纷 --------------- */

export function fetchDisputesRequest(status?: Dispute["status"]) {
  const q = status ? `?status=${status}` : "";
  return apiFetch<Dispute[]>(`/api/disputes${q}`);
}

export function fetchDisputeCountsRequest() {
  return apiFetch<{ active: number }>("/api/disputes/counts");
}

export function createDisputeRequest(body: {
  orderId: string;
  type: string;
  description: string;
  evidence?: { name: string }[];
  stageId?: string;
}) {
  return apiFetch<Dispute>("/api/disputes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function acceptDisputeRequest(id: string) {
  return apiFetch<Dispute>(`/api/disputes/${id}/accept`, { method: "POST" });
}

export function resolveDisputeRequest(
  id: string,
  body: {
    resolution: DisputeResolution;
    clientSharePercent?: number;
    note?: string;
  },
) {
  return apiFetch<Dispute>(`/api/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* --------------- 电子发票 --------------- */

export function fetchInvoices() {
  return apiFetch<InvoiceRequest[]>("/api/invoices");
}

export function createInvoiceRequest(body: CreateInvoiceInput) {
  return apiFetch<InvoiceRequest>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchInvoiceById(id: string) {
  return apiFetch<InvoiceRequest>(`/api/invoices/${id}`);
}
