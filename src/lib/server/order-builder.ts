import "server-only";
import { buildMonthlyStages } from "@/lib/monthly-billing";
import { generateProjectId } from "@/lib/project-id";
import type {
  BillingMode,
  HalfDaySlot,
  Order,
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
  /** 期望交付日期（缺省按下单日 +30 天） */
  expectedDeliveryAt?: string;
  /** 扫码下单等自定义付款阶段（ratio 为 0–1 或百分数 30 表示 30%） */
  customStageRatios?: { name: string; ratio: number }[];
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** 默认三阶段托管：预付款 30% / 中期成果 40% / 尾款 30% */
function buildStages(orderId: string, total: number): PaymentStage[] {
  const prepay = Math.round(total * 0.3);
  const mid = Math.round(total * 0.4);
  const final = total - prepay - mid;
  return [
    {
      id: `${orderId}_s1`,
      name: "预付款",
      amount: prepay,
      ratio: 0.3,
      status: "pending",
    },
    {
      id: `${orderId}_s2`,
      name: "中期成果",
      amount: mid,
      ratio: 0.4,
      status: "pending",
    },
    {
      id: `${orderId}_s3`,
      name: "尾款验收",
      amount: final,
      ratio: 0.3,
      status: "pending",
    },
  ];
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
  if (input.customStageRatios?.length) {
    return buildCustomStages(orderId, input.totalAmount, input.customStageRatios);
  }
  if (input.billingMode === "monthly" && input.selectedMonths?.length) {
    return buildMonthlyStages(orderId, input.totalAmount, input.selectedMonths);
  }
  return buildStages(orderId, input.totalAmount);
}

function resolveInitialStatus(input: CreateOrderInput): OrderStatus {
  const source = input.orderSource ?? "directed";
  if (source === "regular" || source === "bounty") return "matching";
  if (source === "scan") return "pending_schedule";
  return "pending_schedule";
}

function initialSystemMessage(source: OrderSource, hasDesigner: boolean): string {
  if (source === "regular") {
    return "常规委托已发布，等待平台匹配设计师并确认费用。";
  }
  if (source === "bounty") {
    return "悬赏委托已发布，设计师可报名，确认人选后进入签约。";
  }
  if (source === "scan") {
    return "扫码订单已创建，等待设计师确认付款阶段与档期。";
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
  const expected =
    input.expectedDeliveryAt ??
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  const orderSource = input.orderSource ?? "directed";
  const designerId = input.designerId ?? "";
  const status: OrderStatus = resolveInitialStatus(input);

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
    totalAmount: input.totalAmount,
    feeRate: 0.08,
    createdAt: now.toISOString(),
    expectedDeliveryAt: expected,
    contractId: "",
    stages: resolveStages(input, id),
    revisions: [],
    messages: [
      {
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: initialSystemMessage(orderSource, !!designerId),
        createdAt: now.toISOString(),
      },
    ],
    description: input.description,
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
