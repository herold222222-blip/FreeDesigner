import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { requireSession, switchSessionRole } from "@/lib/server/auth";
import {
  allocateClientCode,
  allocateDesignerCode,
  createDesignerOnboardingReview,
} from "@/lib/server/repo";
import type { Client, Designer, Role, SubjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["client", "designer"]),
  /** 设计师主体类型，默认个人 */
  subjectType: z.enum(["individual", "team", "company"]).optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role === "admin" || session.role === "super_admin") {
      return fail(403, "管理员账号无需认领业务身份");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const { role } = parsed.data;
    const subjectType: SubjectType = parsed.data.subjectType ?? "individual";

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return fail(404, "用户不存在");

    const displayName = user.name?.trim() || "新用户";
    const avatar =
      user.avatar?.trim() ||
      `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(displayName)}&backgroundColor=1f2937&textColor=ffffff`;

    let identityId: string;

    if (role === "client") {
      const existing = await prisma.client.findUnique({
        where: { userId: user.id },
      });
      if (existing) {
        identityId = existing.id;
      } else {
        const clientCode = await allocateClientCode();
        const clientData: Client = {
          id: `client_${user.id}`,
          code: clientCode,
          name: user.name?.trim() || "新委托人",
          avatar,
          type: "individual",
          verified: true,
          joinedAt: new Date().toISOString(),
          level: "normal",
          favoriteDesignerIds: [],
        };
        const c = await prisma.client.create({
          data: {
            id: clientData.id,
            userId: user.id,
            name: clientData.name,
            avatar,
            type: "individual",
            verified: true,
            level: "normal",
            data: JSON.stringify(clientData),
          },
        });
        identityId = c.id;
      }
    } else {
      const existing = await prisma.designer.findUnique({
        where: { userId: user.id },
      });
      if (existing) {
        identityId = existing.id;
      } else {
        const designerCode = await allocateDesignerCode();
        const designerData: Partial<Designer> = {
          id: `designer_${user.id}`,
          code: designerCode,
          name: user.name?.trim() || "新设计师",
          avatar,
          subjectType,
          location: "",
          level: "intern",
          specialty: "architecture",
          subSpecialties: [],
          yearsOfExperience: 0,
          onlineStatus: "online",
          workloadStatus: "free",
          activityIndicator: "green",
          lastActiveAt: new Date().toISOString(),
          isOpenToTravel: false,
          supportsHandDrawing: false,
          isInJob: false,
          acceptingOrders: false,
          serviceModes: ["online"],
          meetingFlexibility: "",
          tagline: "",
          bio: "",
          expertiseTags: [],
          projectTypeTags: [],
          dailyRate: 0,
          monthlyRate: 0,
          rating: 0,
          completedProjects: 0,
          reviewCount: 0,
          portfolio: [],
          calendar: [],
        };
        const designerPayload: Designer = {
          ...(designerData as Designer),
          reviewStatus: "pending",
        };
        const d = await prisma.designer.create({
          data: {
            id: designerPayload.id,
            userId: user.id,
            name: designerPayload.name,
            avatar,
            subjectType,
            level: "intern",
            specialty: "architecture",
            acceptingOrders: false,
            reviewStatus: "pending",
            code: designerCode,
            data: JSON.stringify(designerPayload),
          },
        });
        identityId = d.id;
        await createDesignerOnboardingReview(
          designerPayload,
          user.phone ?? undefined,
        );
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: role as Role },
    });
    await switchSessionRole(role, identityId);

    return ok({
      role,
      identityId,
      redirectTo: role === "client" ? "/client" : "/designer",
    });
  });
}
