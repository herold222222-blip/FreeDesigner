import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { listDesignerReviews } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const reviews = await listDesignerReviews(params.id);
    return ok(reviews);
  });
}
