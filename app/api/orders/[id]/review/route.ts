import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { submitOrderReview } from "@/lib/server/order-service";
import type { RatingBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 委托人提交项目评价 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await req.json()) as {
      overall: number;
      breakdown: RatingBreakdown;
      content: string;
      impressionTags?: string[];
      clientDisplayName?: string;
    };
    const order = await submitOrderReview(params.id, session.identityId, body);
    return ok(order);
  });
}
