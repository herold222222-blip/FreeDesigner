import { DIRECTED_PLATFORM_SERVICE_RATE } from "@/lib/directed-platform-fee";
import type { Bounty, BountyInvoiceType } from "@/lib/types";

/** 悬赏发布发票选项 */
export const BOUNTY_INVOICE_OPTIONS = [
  { value: "none", label: "不开发票", invoiceRate: 0, special: false },
  { value: "ordinary_1", label: "1%普票", invoiceRate: 0.01, special: false },
  { value: "special_1", label: "1%专票", invoiceRate: 0.01, special: true },
  { value: "special_3", label: "3%专票", invoiceRate: 0.03, special: true },
] as const;

export type { BountyInvoiceType };

export function isBountyInvoiceType(value: unknown): value is BountyInvoiceType {
  return BOUNTY_INVOICE_OPTIONS.some((o) => o.value === value);
}

export function parseBountyInvoiceType(
  value: unknown,
): BountyInvoiceType | null {
  return isBountyInvoiceType(value) ? value : null;
}

/** 旧悬赏未选发票时按 1%普票（与定向默认一致） */
export function resolveBountyInvoiceType(
  bounty?: Pick<Bounty, "invoiceType"> | null,
): BountyInvoiceType {
  return parseBountyInvoiceType(bounty?.invoiceType) ?? "ordinary_1";
}

export function bountyInvoiceOption(type: BountyInvoiceType) {
  return (
    BOUNTY_INVOICE_OPTIONS.find((o) => o.value === type) ??
    BOUNTY_INVOICE_OPTIONS[1]
  );
}

export function bountyInvoiceLabel(
  bounty?: Pick<Bounty, "invoiceType"> | null,
) {
  return bountyInvoiceOption(resolveBountyInvoiceType(bounty)).label;
}

/** 平台管理费费率：与定向委托相同，5% + 发票税点（不开发票税点为 0） */
export function bountyPlatformFeeRate(type: BountyInvoiceType) {
  return DIRECTED_PLATFORM_SERVICE_RATE + bountyInvoiceOption(type).invoiceRate;
}

/** 税金：普票 / 不开发票为 0；专票为对应费率 + 1% */
export function bountyTaxRate(type: BountyInvoiceType) {
  const opt = bountyInvoiceOption(type);
  if (!opt.special) return 0;
  return opt.invoiceRate + 0.01;
}

/** 设计师到手扣减合计（平台管理费 + 税金） */
export function bountyDesignerDeductionRate(type: BountyInvoiceType) {
  return bountyPlatformFeeRate(type) + bountyTaxRate(type);
}

export function bountyTaxCoefficient(type: BountyInvoiceType) {
  if (type === "special_1") return 1.02;
  if (type === "special_3") return 1.04;
  return 1;
}

export function bountyDesignerTakeHome(
  reward: number,
  type: BountyInvoiceType,
) {
  const gross = Math.max(0, Math.round(reward) || 0);
  const platform = Math.round(gross * bountyPlatformFeeRate(type));
  const tax = Math.round(gross * bountyTaxRate(type));
  return Math.max(0, gross - platform - tax);
}

export function bountyDesignerTakeHomeFromBounty(
  bounty: Pick<Bounty, "reward" | "invoiceType">,
) {
  return bountyDesignerTakeHome(
    bounty.reward,
    resolveBountyInvoiceType(bounty),
  );
}
