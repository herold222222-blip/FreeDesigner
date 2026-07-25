import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { verifyCode } from "@/lib/server/verification";
import {
  createSession,
  getSessionUser,
  hashPassword,
  switchSessionRole,
} from "@/lib/server/auth";
import { allocateClientCode, allocateDesignerCode } from "@/lib/server/repo";
import { resolveRegistrationAvatar } from "@/lib/default-profile-images";
import type { Client, Designer, Role, SubjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  /** 新用户注册必填；已登录账号挂载身份且手机号未变更时可省略 */
  code: z.string().optional(),
  /** 已登录普通账号完善业务身份 */
  attach: z.boolean().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  kind: z.enum([
    "client",
    "designer_individual",
    "designer_team",
    "designer_company",
  ]),
  clientType: z.enum(["individual", "enterprise"]).optional(),
  location: z.string().optional(),
  companyName: z.string().optional(),
  avatar: z.string().min(1).optional(),
  gender: z.enum(["male", "female"]).optional(),
  teamName: z.string().optional(),
  contactName: z.string().optional(),
  foundedYear: z.number().int().min(1980).max(2100).optional(),
  teamSize: z
    .enum(["1-10", "11-20", "21-50", "51-100", "101-200", "200+"])
    .optional(),
  locationScope: z.enum(["domestic", "overseas"]).optional(),
  overseasCountry: z.string().optional(),
  creditCode: z.string().optional(),
  businessScope: z.string().optional(),
  companyQualificationNone: z.boolean().optional(),
  companyQualifications: z
    .array(
      z.object({
        fieldId: z.string(),
        fieldLabel: z.string(),
        categoryId: z.string(),
        categoryLabel: z.string(),
        levelId: z.string(),
        levelLabel: z.string(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, parsed.error.errors[0]?.message ?? "参数错误");
    }
    const {
      phone,
      code,
      attach,
      kind,
      clientType,
      location,
      companyName,
      avatar,
      gender,
      teamName,
      contactName,
      foundedYear,
      teamSize,
      locationScope,
      overseasCountry,
      creditCode,
      businessScope,
      companyQualificationNone,
      companyQualifications,
    } = parsed.data;

    if (kind === "designer_company") {
      const hasQualificationChoice =
        companyQualificationNone === true ||
        (companyQualifications?.length ?? 0) > 0;
      if (!hasQualificationChoice) {
        return fail(400, "请选择公司资质或无资质");
      }
    }

    const session = await getSessionUser();
    const attachMode = Boolean(attach);

    const isClient = kind === "client";
    const role: Role = isClient ? "client" : "designer";
    const isDesignerTeam = kind === "designer_team";
    const isDesignerCompany = kind === "designer_company";
    const name =
      (isDesignerTeam
        ? teamName?.trim()
        : isDesignerCompany
          ? companyName?.trim()
          : parsed.data.name?.trim()) ||
      (isClient ? "新委托人" : "新设计师");
    const accountName =
      (isDesignerTeam || isDesignerCompany ? contactName?.trim() : undefined) ||
      name;
    const isOrgProfile =
      clientType === "enterprise" ||
      kind === "designer_team" ||
      kind === "designer_company";
    const resolvedAvatar = resolveRegistrationAvatar({
      avatar,
      gender,
      useOrgLogo: isOrgProfile,
      name,
    });

    let userId: string;

    if (attachMode) {
      if (!session) return fail(401, "请先登录后再完善身份");
      if (session.role === "admin" || session.role === "super_admin") {
        return fail(403, "管理员账号无需注册业务身份");
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
      });
      if (!user) return fail(404, "用户不存在");

      if (isClient) {
        const existingClient = await prisma.client.findUnique({
          where: { userId: user.id },
        });
        if (existingClient) return fail(409, "该账号已具备委托人身份");
      } else {
        const existingDesigner = await prisma.designer.findUnique({
          where: { userId: user.id },
        });
        if (existingDesigner) return fail(409, "该账号已具备设计师身份");
      }

      if (phone === user.phone) {
        // 已登录且沿用账号手机号，无需再验短信
      } else {
        if (!code || code.length < 4) {
          return fail(400, "更换手机号需填写短信验证码");
        }
        const valid = await verifyCode(phone, code, "register");
        if (!valid) return fail(401, "验证码错误或已过期");
        const phoneTaken = await prisma.user.findFirst({
          where: { phone, NOT: { id: user.id } },
        });
        if (phoneTaken) return fail(409, "该手机号已被其他账号使用");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone,
          name: accountName,
          avatar: resolvedAvatar,
          role,
          status: isClient ? "active" : "pending",
        },
      });
      userId = user.id;
    } else {
      if (!code || code.length < 4) return fail(400, "请输入验证码");
      const valid = await verifyCode(phone, code, "register");
      if (!valid) return fail(401, "验证码错误或已过期");

      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) return fail(409, "该手机号已注册，请直接登录");

      const passwordHash = parsed.data.password
        ? await hashPassword(parsed.data.password)
        : null;

      const user = await prisma.user.create({
        data: {
          phone,
          name: accountName,
          avatar: resolvedAvatar,
          role,
          passwordHash,
          status: isClient ? "active" : "pending",
        },
      });
      userId = user.id;
    }

    let identityId = userId;

    if (isClient) {
      const isEnterprise = clientType === "enterprise";
      const clientCode = await allocateClientCode();
      const clientData: Client = {
        id: `client_${userId}`,
        code: clientCode,
        name,
        avatar: resolvedAvatar,
        type: isEnterprise ? "enterprise" : "individual",
        verified: !isEnterprise,
        companyName: isEnterprise ? companyName?.trim() || name : undefined,
        contactName: isEnterprise
          ? contactName?.trim() || accountName
          : undefined,
        location: location?.trim() || undefined,
        gender: !isEnterprise && gender ? gender : undefined,
        joinedAt: new Date().toISOString(),
        level: "normal",
        favoriteDesignerIds: [],
      };
      const c = await prisma.client.create({
        data: {
          id: clientData.id,
          userId,
          name,
          avatar: resolvedAvatar,
          type: clientData.type,
          verified: clientData.verified,
          level: "normal",
          data: JSON.stringify(clientData),
        },
      });
      identityId = c.id;
    } else {
      const subjectType: SubjectType =
        kind === "designer_team"
          ? "team"
          : kind === "designer_company"
            ? "company"
            : "individual";
      const designerCode = await allocateDesignerCode();
      const designerData: Partial<Designer> = {
        id: `designer_${userId}`,
        code: designerCode,
        name,
        avatar: resolvedAvatar,
        subjectType,
        gender: subjectType === "individual" && gender ? gender : undefined,
        teamSize: teamSize ?? undefined,
        foundedYear: foundedYear ?? undefined,
        creditCode:
          subjectType === "company" ? creditCode?.trim() || undefined : undefined,
        businessScope:
          subjectType === "company"
            ? businessScope?.trim() || undefined
            : undefined,
        companyQualificationNone:
          subjectType === "company" ? companyQualificationNone : undefined,
        companyQualifications:
          subjectType === "company" && companyQualifications?.length
            ? companyQualifications
            : undefined,
        contactName: contactName?.trim() || undefined,
        locationScope: locationScope ?? undefined,
        overseasCountry: overseasCountry?.trim() || undefined,
        location: location?.trim() || "",
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
      const d = await prisma.designer.create({
        data: {
          id: designerData.id!,
          userId,
          name,
          avatar: resolvedAvatar,
          subjectType,
          level: "intern",
          specialty: "architecture",
          acceptingOrders: false,
          reviewStatus: "pending",
          code: designerCode,
          data: JSON.stringify(designerData),
        },
      });
      identityId = d.id;
    }

    if (attachMode && session) {
      await switchSessionRole(role, identityId);
    } else {
      await createSession({ userId, role, identityId });
    }

    return ok({
      userId,
      role,
      identityId,
      name,
      avatar: resolvedAvatar,
      needsOnboarding: !isClient,
    });
  });
}
