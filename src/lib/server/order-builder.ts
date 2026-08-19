import "server-only";
import { generateProjectId } from "@/lib/project-id";
import { buildDefaultPaymentStages } from "@/lib/order-payment-stages";
import type {
  BillingMode,
  BountyAttachment,
  HalfDaySlot,
  Order,
  OrderQuote,
  OrderSource,
  OrderStatus,
  PaymentStage,
  ServiceMode,
  Specialty,
  SubSpecialty,
} from "@/lib/types";

export interface CreateOrderInput {
  designerId?: string;
  clientId: string;
  title: string;
  specialty: Specialty;
  subSpecialty?: SubSpecialty;
  projectType: string;
  serviceMode: ServiceMode;
  billingMode: BillingMode;
  orderSource?: OrderSource;
  totalAmount: number;
  description: string;
  projectAreaSqm?: number;
  selectedSlots?: HalfDaySlot[];
  selectedMonths?: string[];
  address?: string;
  scheduleFrom?: string;
  scheduleTo?: string;
  withAuditService?: boolean;
  withProjectManagement?: boolean;
  /** 期望交付日期；线下驻场为开始服务时间。不预填，须委托人主动填写。 */
  expectedDeliveryAt?: string;
  /** 扫码下单等自定义付款阶段（ratio 为 0–1 或百分数 30 表示 30%） */
  customStageRatios?: { name: string; ratio: number }[];
  /** 委托人实际上传的项目附件 */
  attachments?: BountyAttachment[];
  /** 系统报价单（按天/按月常规委托，兼容中级卡） */
  quote?: OrderQuote;
  /** 多档等级报价卡 */
  levelQuotes?: OrderQuote[];
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function normalizeRatio(r: number): number {
  return r > 1 ? r / 100 : r;
}

function buildCustomStages(
  orderId: string,
  total: number,
  defs: { name: string; ratio: number }[],
): PaymentStage[] {
  const normalized = defs.map((d) => ({
    name: d.name,
    ratio: normalizeRatio(d.ratio),
  }));
  const sum = normalized.reduce((s, d) => s + d.ratio, 0);
  const scale = sum > 0 ? 1 / sum : 1 / normalized.length;
  let allocated = 0;
  return normalized.map((d, i) => {
    const amount =
      i === normalized.length - 1
        ? total - allocated
        : Math.round(total * d.ratio * scale);
    allocated += amount;
    return {
      id: `${orderId}_s${i + 1}`,
      name: d.name,
      amount,
      ratio: d.ratio * scale,
      status: "pending" as const,
    };
  });
}

function resolveStages(input: CreateOrderInput, orderId: string): PaymentStage[] {
  if (
    input.orderSource === "scan" &&
    input.totalAmount === 0 &&
    !input.customStageRatios?.length
  ) {
    return [];
  }
  if (input.customStageRatios?.length) {
    return buildCustomStages(orderId, input.totalAmount, input.customStageRatios);
  }
  return buildDefaultPaymentStages({
    orderId,
    totalAmount: input.totalAmount,
    billingMode: input.billingMode,
    selectedMonths: input.selectedMonths,
  });
}

function resolveInitialStatus(input: CreateOrderInput): OrderStatus {
  const source = input.orderSource ?? "directed";
  if (
    source === "regular" &&
    input.quote &&
    (input.billingMode === "daily" || input.billingMode === "monthly")
  ) {
    return "pending_quote";
  }
  if (source === "regular" || source === "bounty") return "matching";
  if (source === "scan") return "pending_schedule";
  return "pending_schedule";
}

function initialSystemMessage(
  source: OrderSource,
  hasDesigner: boolean,
  status: OrderStatus,
): string {
  if (source === "regular" && status === "pending_quote") {
    return "系统已根据需求生成报价单，请委托人确认后进入设计师匹配。";
  }
  if (source === "regular") {
    return "常规委托已发布，等待平台匹配设计师并确认费用。";
  }
  if (source === "bounty") {
    return "悬赏委托已发布，设计师可报名，确认人选后进入签约。";
  }
  if (source === "scan") {
    return "扫码订单已创建，等待设计师确认费用与付款阶段。";
  }
  if (hasDesigner) {
    return "订单已创建，等待设计师确认档期。";
  }
  return "订单已创建。";
}

/**
 * 由下单输入构建一个完整的订单对象（落库前的标准化）。
 * 定向下单：pending_schedule → 签约 → 预付 → 进行中；
 * 常规/悬赏：matching → 匹配 → 签约 → 预付 → 进行中。
 */
export function buildOrder(input: CreateOrderInput): Order {
  const now = new Date();
  const id = randomId("order");
  const expected = input.expectedDeliveryAt?.trim() ?? "";

  const orderSource = input.orderSource ?? "directed";
  const designerId = input.designerId ?? "";
  const status: OrderStatus = resolveInitialStatus(input);
  const totalAmount =
    status === "pending_quote" && input.quote
      ? input.quote.total
      : input.totalAmount;

  return {
    id,
    code: generateProjectId(input.specialty),
    title: input.title,
    specialty: input.specialty,
    subSpecialty: input.subSpecialty,
    projectType: input.projectType,
    designerId,
    clientId: input.clientId,
    status,
    serviceMode: input.serviceMode,
    billingMode: input.billingMode,
    orderSource,
    projectAreaSqm: input.projectAreaSqm,
    totalAmount,
    feeRate: 0.08,
    createdAt: now.toISOString(),
    expectedDeliveryAt: expected,
    contractId: "",
    stages: resolveStages({ ...input, totalAmount }, id),
    revisions: [],
    messages: [
      {
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: initialSystemMessage(orderSource, !!designerId, status),
        createdAt: now.toISOString(),
      },
    ],
    description: input.description,
    quote: input.quote,
    levelQuotes: input.levelQuotes?.length ? input.levelQuotes : undefined,
    attachments: input.attachments?.length ? input.attachments : undefined,
    onsiteSchedule:
      input.serviceMode === "onsite" && input.address
        ? {
            from: input.scheduleFrom ?? "",
            to: input.scheduleTo ?? "",
            address: input.address,
          }
        : undefined,
    selectedSlots: input.selectedSlots,
    selectedMonths: input.selectedMonths,
    withAuditService: input.withAuditService,
    withProjectManagement: input.withProjectManagement,
  };
}
