import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { migrateLevelUsers } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import type { LevelCategory } from "@/lib/level-management";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole("super_admin");
    const body = (await req.json()) as {
      category: LevelCategory;
      fromLevelId: string;
      toLevelId: string;
    };
    if (!body.category || !body.fromLevelId || !body.toLevelId) {
      throw new Error("请指定分类、原等级与目标等级");
    }
    if (body.fromLevelId === body.toLevelId) {
      throw new Error("目标等级不能与原等级相同");
    }
    return ok(
      await migrateLevelUsers({
        category: body.category,
        fromLevelId: body.fromLevelId,
        toLevelId: body.toLevelId,
      }),
    );
  });
}
