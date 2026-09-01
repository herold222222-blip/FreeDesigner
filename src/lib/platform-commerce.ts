/** 平台商务规则：费率之外的付款节点、托管与售后（参数中心「商务设置」） */

export interface PlatformCommerceSettings {
  /** 首月预付：开始服务日前几天 */
  monthlyFirstPrepayLeadDays: number;
  /** 此后每月几号预付下月（1–28） */
  monthlyPrepayDay: number;
  /** 按天：签约预付比例 0–1 */
  dailyPrepayRatio: number;
  /** 按天：服务结束后几天内付清尾款 */
  dailySettlementGraceDays: number;
  /** 委托人付款后资金托管天数 */
  escrowDays: number;
  /** 售后 / 验收有效天数（确认最终成果后起算） */
  afterSalesDays: number;
  /** 设计师提交最终 / 返修成果后，委托人未确认则自动确认的天数 */
  deliverableConfirmDays: number;
  /** 最后一笔费用支付后可评价的天数 */
  clientReviewDays: number;
  /** 支付截止钟点（0–23，默认 17） */
  billingCutoffHour: number;
}

export const DEFAULT_PLATFORM_COMMERCE: PlatformCommerceSettings = {
  monthlyFirstPrepayLeadDays: 3,
  monthlyPrepayDay: 25,
  dailyPrepayRatio: 0.3,
  dailySettlementGraceDays: 3,
  escrowDays: 30,
  afterSalesDays: 10,
  deliverableConfirmDays: 20,
  clientReviewDays: 30,
  billingCutoffHour: 17,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampRatio(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1) return Math.min(0.95, Math.max(0.05, n / 100));
  return Math.min(0.95, Math.max(0.05, n));
}

export function normalizeCommerceSettings(
  input?: Partial<PlatformCommerceSettings> | null,
): PlatformCommerceSettings {
  const base = DEFAULT_PLATFORM_COMMERCE;
  if (!input) return { ...base };
  return {
    monthlyFirstPrepayLeadDays: clampInt(
      input.monthlyFirstPrepayLeadDays,
      1,
      15,
      base.monthlyFirstPrepayLeadDays,
    ),
    monthlyPrepayDay: clampInt(input.monthlyPrepayDay, 1, 28, base.monthlyPrepayDay),
    dailyPrepayRatio: clampRatio(input.dailyPrepayRatio, base.dailyPrepayRatio),
    dailySettlementGraceDays: clampInt(
      input.dailySettlementGraceDays,
      1,
      30,
      base.dailySettlementGraceDays,
    ),
    escrowDays: clampInt(input.escrowDays, 1, 180, base.escrowDays),
    afterSalesDays: clampInt(input.afterSalesDays, 1, 180, base.afterSalesDays),
    deliverableConfirmDays: clampInt(
      input.deliverableConfirmDays,
      1,
      180,
      base.deliverableConfirmDays,
    ),
    clientReviewDays: clampInt(
      input.clientReviewDays,
      1,
      180,
      base.clientReviewDays,
    ),
    billingCutoffHour: clampInt(input.billingCutoffHour, 0, 23, base.billingCutoffHour),
  };
}

function cutoffLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatMonthlyBillingRule(
  input?: Partial<PlatformCommerceSettings> | null,
): string {
  const s = normalizeCommerceSettings(input);
  return `首月须在开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天 ${cutoffLabel(s.billingCutoffHour)} 前预付一个月；此后每月 ${s.monthlyPrepayDay} 日 ${cutoffLabel(s.billingCutoffHour)} 前预付下一个月服务费，直至服务结束。遇周末或法定节假日均提前至前一个工作日。按月服务不含周末与法定节假日，调休上班日照常服务`;
}

export function formatMonthlyBillingRuleFull(
  input?: Partial<PlatformCommerceSettings> | null,
): string {
  return `${formatMonthlyBillingRule(input)}。委托人可在当天 ${cutoffLabel(normalizeCommerceSettings(input).billingCutoffHour)} 前终止并结算；不足整月按工作日计，日费 = 月费 ÷ 21。`;
}

export function formatDailyBillingRule(
  input?: Partial<PlatformCommerceSettings> | null,
): string {
  const s = normalizeCommerceSettings(input);
  const prepay = Math.round(s.dailyPrepayRatio * 100);
  return `签约预付 ${prepay}% 后开工；委托人确认服务成果后 ${s.dailySettlementGraceDays} 日内付清尾款。延长服务须在结束日前一日 ${cutoffLabel(s.billingCutoffHour)} 前申请（半天为计费单元），服务完成后补付延长费用。`;
}

function addCalendarDays(from: string, days: number): string | null {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** 已托管阶段的验收期解冻截止：确认最终成果后起算 */
export function resolveStageEscrowEndsAt(
  stage: {
    status?: string;
    paidAt?: string;
    acceptanceDeadlineAt?: string;
    deliverablesConfirmedAt?: string;
  },
  commerce?: Partial<PlatformCommerceSettings> | null,
  options?: { requiresDeliverables?: boolean },
): string | null {
  if (stage.status !== "frozen") return null;
  const days = normalizeCommerceSettings(commerce).afterSalesDays;
  if (!stage.deliverablesConfirmedAt) {
    if (options?.requiresDeliverables) return null;
    return stage.acceptanceDeadlineAt ?? null;
  }
  const confirmedMs = Date.parse(stage.deliverablesConfirmedAt);
  const storedMs = stage.acceptanceDeadlineAt
    ? Date.parse(stage.acceptanceDeadlineAt)
    : NaN;
  if (Number.isFinite(storedMs) && storedMs >= confirmedMs) {
    return stage.acceptanceDeadlineAt!;
  }
  return addCalendarDays(stage.deliverablesConfirmedAt, days);
}

/** 设计师提交最终 / 返修成果后，委托人确认截止（超时自动确认） */
export function resolveDeliverableConfirmDeadlineAt(
  stage: {
    status?: string;
    deliverablesConfirmedAt?: string;
    deliverables?: Array<{ kind?: string; uploadedAt?: string }>;
  },
  commerce?: Partial<PlatformCommerceSettings> | null,
  options?: { pendingRevision?: boolean },
): string | null {
  if (stage.status === "released") return null;
  if (stage.deliverablesConfirmedAt) return null;
  if (options?.pendingRevision) return null;
  const submittedAt = getLatestConfirmableSubmitAt(stage);
  if (!submittedAt) return null;
  const days = normalizeCommerceSettings(commerce).deliverableConfirmDays;
  return addCalendarDays(submittedAt, days);
}

function getLatestConfirmableSubmitAt(stage: {
  deliverables?: Array<{ kind?: string; uploadedAt?: string }>;
}): string | null {
  let latest: string | null = null;
  for (const file of stage.deliverables ?? []) {
    const kind = file.kind ?? "final";
    if (kind === "preliminary") continue;
    const stamp = file.uploadedAt;
    if (!stamp) continue;
    if (!latest || stamp > latest) latest = stamp;
  }
  return latest;
}

export function formatEscrowRemaining(
  endsAt: string,
  now = Date.now(),
  expiredLabel = "即将解冻",
): string {
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return expiredLabel;
  const totalMin = Math.max(1, Math.floor(ms / 60_000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) {
    return hours > 0 ? `剩 ${days} 天 ${hours} 小时` : `剩 ${days} 天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `剩 ${hours} 小时 ${minutes} 分` : `剩 ${hours} 小时`;
  }
  return `剩 ${minutes} 分钟`;
}
