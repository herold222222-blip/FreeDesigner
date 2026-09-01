import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getClient, listOrders } from "@/lib/server/repo";
import { AuthError, requireSession } from "@/lib/server/auth";
import { placeOrder } from "@/lib/server/order-service";
import type { CreateOrderInput } from "@/lib/server/order-builder";
import type { CreateOrderBody } from "@/lib/api-client";
import {
  buildRegularAreaQuote,
  buildRegularAreaQuotesByLevel,
  buildRegularTimeQuote,
  buildRegularTimeQuotesByLevel,
} from "@/lib/regular-entrust-quote";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    // 按当前身份过滤：委托人看自己的单，设计师看分配给自己的单，管理员看全部
    if (session.role === "client") {
      return ok(await listOrders({ clientId: session.identityId }));
    }
    if (session.role === "designer") {
      return ok(await listOrders({ designerId: session.identityId }));
    }
    return ok(await listOrders());
  });
}

/** 委托人下单（定向下单 / 常规委托）：创建订单并生成档期申请 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可下单，请先登录委托人账号");
    }
    const body = (await req.json()) as Partial<CreateOrderBody> &
      Partial<CreateOrderInput>;
    const source = body.orderSource ?? "directed";
    const needsDesigner = source === "directed" || source === "scan";
    const billingMode = body.billingMode ?? "daily";
    const isTimeBilling =
      billingMode === "daily" || billingMode === "monthly";

    let quote: CreateOrderInput["quote"];
    let levelQuotes: CreateOrderInput["levelQuotes"];
    let totalAmount =
      source === "scan" ? (body.totalAmount ?? 0) : (body.totalAmount ?? 1);

    if (source === "regular" && isTimeBilling && body.timeQuote?.lines?.length) {
      try {
        const client = await getClient(session.identityId);
        const quoteInput = {
          unit: body.timeQuote.unit,
          serviceMode:
            body.serviceMode === "onsite" ? ("onsite" as const) : ("remote" as const),
          withDrawing: body.timeQuote.withDrawing,
          withAudit: body.withAuditService,
          withPM: body.withProjectManagement,
          lines: body.timeQuote.lines,
          taxCoefficient: body.timeQuote.taxCoefficient,
          clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
        };
        levelQuotes = buildRegularTimeQuotesByLevel(quoteInput);
        quote =
          levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
          levelQuotes[0] ??
          buildRegularTimeQuote({ ...quoteInput, designerLevel: "mid_v1" });
        totalAmount = quote.total;
      } catch (e) {
        throw new AuthError(
          400,
          e instanceof Error ? e.message : "无法生成报价单",
        );
      }
    }

    if (
      source === "regular" &&
      billingMode === "area" &&
      body.areaQuote &&
      (body.areaQuote.tracks?.length || body.areaQuote.structure)
    ) {
      try {
        const client = await getClient(session.identityId);
        const quoteInput = {
          area: body.areaQuote.area,
          projectType: body.areaQuote.projectType || body.projectType || "",
          buildType: body.areaQuote.buildType,
          tracks: body.areaQuote.tracks ?? [],
          structure: body.areaQuote.structure,
          withAudit: body.withAuditService,
          withPM: body.withProjectManagement,
          taxCoefficient: body.areaQuote.taxCoefficient,
          clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
        };
        levelQuotes = buildRegularAreaQuotesByLevel(quoteInput);
        quote =
          levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
          levelQuotes[0] ??
          buildRegularAreaQuote({ ...quoteInput, designerLevel: "mid_v1" });
        totalAmount = quote.total;
      } catch (e) {
        throw new AuthError(
          400,
          e instanceof Error ? e.message : "无法生成报价单",
        );
      }
    }

    if (
      !body.title ||
      (source !== "scan" && totalAmount == null) ||
      (needsDesigner && !body.designerId)
    ) {
      return fail(400, "缺少必要的下单参数");
    }
    const expectedDeliveryAt = body.expectedDeliveryAt?.trim() ?? "";
    if (!expectedDeliveryAt && source !== "scan") {
      return fail(400, "请填写预期交付时间或开始服务时间");
    }

    const order = await placeOrder({
      designerId: body.designerId,
      clientId: session.identityId,
      title: body.title,
      specialty: (body.specialty as CreateOrderInput["specialty"]) ?? "architecture",
      subSpecialty: body.subSpecialty as CreateOrderInput["subSpecialty"],
      projectType: body.projectType ?? "",
      serviceMode: body.serviceMode ?? "online",
      billingMode,
      orderSource: body.orderSource ?? "directed",
      totalAmount,
      description: body.description ?? "",
      projectAreaSqm: body.projectAreaSqm,
      selectedSlots: body.selectedSlots as CreateOrderInput["selectedSlots"],
      selectedMonths: body.selectedMonths,
      address: body.address,
      scheduleFrom: body.scheduleFrom,
      scheduleTo: body.scheduleTo,
      withAuditService: body.withAuditService,
      withProjectManagement: body.withProjectManagement,
      customStageRatios: body.customStageRatios,
      attachments: body.attachments,
      expectedDeliveryAt,
      taxCoefficient: body.taxCoefficient,
      quote,
      levelQuotes,
    });
    return ok(order, { status: 201 });
  });
}
