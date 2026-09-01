import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { placeDesignerSelfOrder } from "@/lib/server/order-service";
import type { CreateOrderBody } from "@/lib/api-client";
import type { CreateOrderInput } from "@/lib/server/order-builder";
import { buildSelfOrderShareUrl } from "@/lib/self-order-share";

export const dynamic = "force-dynamic";

/** 设计师自己下单：填写项目后生成委托人确认链接 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") {
      return fail(403, "仅设计师可发起自己下单");
    }
    const body = (await req.json()) as Partial<CreateOrderBody> &
      Partial<CreateOrderInput>;
    if (!body.title?.trim()) return fail(400, "请填写项目名称");
    const expectedDeliveryAt = body.expectedDeliveryAt?.trim() ?? "";
    if (!expectedDeliveryAt && body.orderSource !== "scan") {
      return fail(400, "请填写预期交付时间或开始服务时间");
    }
    const billingMode = body.billingMode ?? "daily";
    const result = await placeDesignerSelfOrder(session.identityId, {
      title: body.title.trim(),
      specialty:
        (body.specialty as CreateOrderInput["specialty"]) ?? "architecture",
      subSpecialty: body.subSpecialty as CreateOrderInput["subSpecialty"],
      projectType: body.projectType ?? "",
      serviceMode: body.serviceMode ?? "online",
      billingMode,
      orderSource: body.orderSource ?? "directed",
      totalAmount: body.totalAmount ?? 0,
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
    });
    return ok(
      {
        ...result.order,
        share: {
          ...result.share,
          url: buildSelfOrderShareUrl(result.share.shareId, req.nextUrl.origin),
        },
      },
      { status: 201 },
    );
  });
}
