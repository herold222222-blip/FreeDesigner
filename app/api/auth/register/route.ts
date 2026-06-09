import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, fail } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { verifyCode } from "@/lib/server/verification";
import { createSession, hashPassword } from "@/lib/server/auth";
import { allocateClientCode, allocateDesignerCode } from "@/lib/server/repo";
import { resolveRegistrationAvatar } from "@/lib/default-profile-images";
import type { Client, Designer, Role, SubjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  code: z.string().min(4, "请输入验证码"),
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

    const valid = await verifyCode(phone, code, "register");
    if (!valid) return fail(401, "验证码错误或已过期");

    if (kind === "designer_company") {
      const hasQualificationChoice =
        companyQualificationNone === true ||
        (companyQualifications?.length ?? 0) > 0;
      if (!hasQualificationChoice) {
        return fail(400, "请选择公司资质或无资质");
      }
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return fail(409, "该手机号已注册，请直接登录");

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
        // 设计师需审核后才能接单
        status: isClient ? "active" : "pending",
      },
    });

    let identityId = user.id;

    if (isClient) {
      const isEnterprise = clientType === "enterprise";
      const clientCode = await allocateClientCode();
      const clientData: Client = {
        id: `client_${user.id}`,
        code: clientCode,
        name,
        avatar: resolvedAvatar,
        type: isEnterprise ? "enterprise" : "individual",
        verified: !isEnterprise,
        companyName: isEnterprise ? companyName?.trim() || name : undefined,
        contactName: isEnterprise ? contactName?.trim() || accountName : undefined,
        location: location?.trim() || undefined,
        gender: !isEnterprise && gender ? gender : undefined,
        joinedAt: new Date().toISOString(),
        level: "normal",
        favoriteDesignerIds: [],
      };
      const c = await prisma.client.create({
        data: {
          id: clientData.id,
          userId: user.id,
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
        kind === "designer_team" ? "team" : kind === "designer_company" ? "company" : "individual";
      const designerCode = await allocateDesignerCode();
      const designerData: Partial<Designer> = {
        id: `designer_${user.id}`,
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
        // 新注册主体（设计师/团队/公司）统一从见习等级起步
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
          userId: user.id,
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

    await createSession({ userId: user.id, role, identityId });

    return ok({
      userId: user.id,
      role,
      identityId,
      name,
      avatar: resolvedAvatar,
      needsOnboarding: !isClient,
    });
  });
}
