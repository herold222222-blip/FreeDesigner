import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getClient, saveClient, toggleClientFavorite } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 当前委托人的收藏设计师列表 */
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可查看收藏");
    const client = await getClient(session.identityId);
    if (!client) return fail(404, "委托人资料不存在");
    return ok({ designerIds: client.favoriteDesignerIds ?? [] });
  });
}

/** 批量设置收藏列表（如清空） */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可管理收藏");
    const body = (await req.json()) as { designerIds?: string[] };
    const client = await getClient(session.identityId);
    if (!client) return fail(404, "委托人资料不存在");
    client.favoriteDesignerIds = body.designerIds ?? [];
    await saveClient(client);
    return ok({ designerIds: client.favoriteDesignerIds });
  });
}

/** 切换收藏状态 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可收藏设计师");
    const body = (await req.json()) as { designerId?: string };
    if (!body.designerId) return fail(400, "请指定设计师");
    const client = await toggleClientFavorite(
      session.identityId,
      body.designerId,
    );
    if (!client) return fail(404, "委托人资料不存在");
    return ok({ designerIds: client.favoriteDesignerIds ?? [] });
  });
}
