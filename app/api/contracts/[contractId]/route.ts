import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import {
  findOrderByContractId,
  getClient,
  getDesigner,
} from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 按合同编号查询订单签约信息（供合同页展示） */
export async function GET(
  _req: NextRequest,
  { params }: { params: { contractId: string } },
) {
  return handle(async () => {
    await requireSession();
    const order = await findOrderByContractId(params.contractId);
    if (!order) return fail(404, "合同不存在或尚未生成");

    const [client, designer] = await Promise.all([
      getClient(order.clientId),
      order.designerId ? getDesigner(order.designerId) : null,
    ]);

    return ok({
      order,
      client: client
        ? { id: client.id, name: client.name, type: client.type }
        : null,
      designer: designer
        ? { id: designer.id, name: designer.name, location: designer.location }
        : null,
    });
  });
}
