/**
 * 种子脚本：将既有 mock 数据导入数据库。
 * 运行：npm run db:seed
 *
 * 演示账号（验证码统一为 .env 中的 DEMO_VERIFICATION_CODE，默认 888888）：
 *   - 个人设计师（陈牧之）：13900010000
 *   - 设计团队（王舒景观施工图团队）：13900040000
 *   - 设计公司（远境建筑设计有限公司）：13900090000
 *   - 委托人：手机号 138 + 4 位序号（首个为 client_lin → 13800010000）
 *   - 管理员：登录名 FDmanage / 密码 FD4006801230（亦可用手机 13700000000 + 验证码）
 *   - 超级管理员：登录名 FDadmin / 密码 FD4006801231
 * 控制台会打印完整账号清单；右下角演示身份切换器与 src/lib/demo-accounts.ts 保持一致。
 */
import { PrismaClient } from "@prisma/client";
import { designers } from "../src/mocks/designers";
import { formatClientCode } from "../src/lib/client-code";
import { formatDesignerCode } from "../src/lib/designer-code";
import { clients } from "../src/mocks/clients";
import { orders } from "../src/mocks/orders";
import { bounties } from "../src/mocks/bounties";
import { serviceProviders } from "../src/mocks/service-providers";
import { reviewQueue } from "../src/mocks/reviews";
import { getDesignerReviews } from "../src/mocks/designer-reviews";
import {
  clientWalletByOwnerId,
  designerWalletByOwnerId,
} from "../src/mocks/wallet";
import { DEFAULT_PLATFORM_PRICING_CONFIG } from "../src/lib/platform-pricing";
import { cloneDefaultContractTemplates } from "../src/lib/contract-templates";
import { cloneDefaultPlatformContent } from "../src/lib/platform-content";
import { cloneDefaultLevelManagement } from "../src/lib/level-management";
import { demoFeedbackMessages } from "../src/mocks/feedback-messages";
import { demoDisputes } from "../src/mocks/disputes";
import {
  PLATFORM_ADMIN_DEFAULT_PASSWORD,
  PLATFORM_ADMIN_LOGIN_NAME,
  SUPER_ADMIN_DEFAULT_PASSWORD,
  SUPER_ADMIN_LOGIN_NAME,
} from "../src/lib/admin-accounts";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

function pad(n: number) {
  return String(n).padStart(4, "0");
}

function designerPhone(i: number) {
  return `139${pad(i + 1)}0000`.slice(0, 11).padEnd(11, "0");
}
function clientPhone(i: number) {
  return `138${pad(i + 1)}0000`.slice(0, 11).padEnd(11, "0");
}

async function reset() {
  // 顺序删除（无强外键约束，直接清空）
  await prisma.session.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.scheduleRequest.deleteMany();
  await prisma.scanOrder.deleteMany();
  await prisma.designerReview.deleteMany();
  await prisma.reviewItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bounty.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.designer.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformPricing.deleteMany();
  await prisma.levelManagement.deleteMany();
  await prisma.platformContent.deleteMany();
  await prisma.contractTemplates.deleteMany();
  await prisma.withdrawalRequest.deleteMany();
  await prisma.feedbackMessage.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payment.deleteMany();
}

async function main() {
  console.log("开始播种数据...");
  await reset();

  const accountList: { role: string; phone: string; name: string; id: string }[] = [];

  // 委托人
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const phone = clientPhone(i);
    const code = c.code ?? formatClientCode(i + 1);
    const clientPayload = { ...c, code };
    const user = await prisma.user.create({
      data: {
        phone,
        name: c.type === "enterprise" ? c.contactName ?? c.name : c.name,
        avatar: c.avatar,
        role: "client",
        status: "active",
      },
    });
    await prisma.client.create({
      data: {
        id: c.id,
        userId: user.id,
        name: c.name,
        avatar: c.avatar,
        type: c.type,
        verified: c.verified,
        level: c.level ?? "normal",
        data: JSON.stringify(clientPayload),
      },
    });
    accountList.push({ role: "委托人", phone, name: c.name, id: c.id });
  }

  // 设计师
  for (let i = 0; i < designers.length; i++) {
    const d = designers[i];
    const phone = designerPhone(i);
    const user = await prisma.user.create({
      data: {
        phone,
        name: d.name,
        avatar: d.avatar,
        role: "designer",
        status: "active",
      },
    });
    const code = d.code ?? formatDesignerCode(i + 1);
    const designerPayload = { ...d, code };
    await prisma.designer.create({
      data: {
        id: d.id,
        userId: user.id,
        name: d.name,
        avatar: d.avatar,
        subjectType: d.subjectType ?? "individual",
        specialty: d.specialty,
        level: d.level,
        regionTier: d.regionTier,
        location: d.location,
        acceptingOrders: d.acceptingOrders ?? true,
        rating: d.rating,
        dailyRate: d.dailyRate,
        monthlyRate: d.monthlyRate,
        reviewStatus: "approved",
        code,
        data: JSON.stringify(designerPayload),
      },
    });
    accountList.push({ role: "设计师", phone, name: d.name, id: d.id });

    // 设计师历史评价
    const reviews = getDesignerReviews(d.id);
    for (const r of reviews) {
      await prisma.designerReview.create({
        data: {
          id: r.id,
          designerId: d.id,
          orderCode: r.orderCode,
          overall: r.overall,
          data: JSON.stringify(r),
        },
      });
    }
  }

  // 服务方（审图师 / 项目管理员）
  for (const sp of serviceProviders) {
    await prisma.serviceProvider.create({
      data: {
        id: sp.id,
        name: (sp as any).name ?? sp.id,
        role: (sp as any).role ?? "auditor",
        data: JSON.stringify(sp),
      },
    });
  }

  // 订单
  for (const o of orders) {
    await prisma.order.create({
      data: {
        id: o.id,
        code: o.code,
        title: o.title,
        clientId: o.clientId,
        designerId: o.designerId,
        status: o.status,
        orderSource: o.orderSource,
        specialty: o.specialty,
        totalAmount: o.totalAmount,
        data: JSON.stringify(o),
      },
    });
  }

  // 悬赏
  for (const b of bounties) {
    await prisma.bounty.create({
      data: {
        id: b.id,
        code: b.code,
        title: b.title,
        publisherId: b.publisherId,
        status: b.status,
        specialty: b.specialty,
        reward: b.reward,
        data: JSON.stringify(b),
      },
    });
  }

  // 钱包流水：按委托人 / 设计师 ID 分别播种，保证跨角色数据一致
  for (const [ownerId, txs] of Object.entries(clientWalletByOwnerId)) {
    for (const t of txs) {
      await prisma.walletTransaction.create({
        data: {
          id: t.id,
          ownerId,
          ownerType: "client",
          type: t.type,
          amount: t.amount,
          status: t.status,
          data: JSON.stringify(t),
        },
      });
    }
  }
  for (const [ownerId, txs] of Object.entries(designerWalletByOwnerId)) {
    for (const t of txs) {
      await prisma.walletTransaction.create({
        data: {
          id: t.id,
          ownerId,
          ownerType: "designer",
          type: t.type,
          amount: t.amount,
          status: t.status,
          data: JSON.stringify(t),
        },
      });
    }
  }

  // 入驻审核工单
  for (const r of reviewQueue) {
    await prisma.reviewItem.create({
      data: {
        id: r.id,
        type: r.type,
        name: r.name,
        status: r.status,
        data: JSON.stringify(r),
      },
    });
  }

  // 平台管理员
  await prisma.user.create({
    data: {
      phone: "13700000000",
      loginName: PLATFORM_ADMIN_LOGIN_NAME,
      passwordHash: await hashPassword(PLATFORM_ADMIN_DEFAULT_PASSWORD),
      name: "平台管理员",
      role: "admin",
      status: "active",
      avatar:
        "https://api.dicebear.com/7.x/initials/png?seed=管理员&backgroundColor=1f2937&textColor=ffffff",
    },
  });
  accountList.push({
    role: "管理员",
    phone: `${PLATFORM_ADMIN_LOGIN_NAME} / 13700000000`,
    name: "平台管理员",
    id: "-",
  });

  await prisma.user.create({
    data: {
      phone: "13700000001",
      loginName: SUPER_ADMIN_LOGIN_NAME,
      passwordHash: await hashPassword(SUPER_ADMIN_DEFAULT_PASSWORD),
      name: "超级管理员",
      role: "super_admin",
      status: "active",
      avatar:
        "https://api.dicebear.com/7.x/initials/png?seed=超管&backgroundColor=7c2d12&textColor=ffffff",
    },
  });
  accountList.push({
    role: "超级管理员",
    phone: `${SUPER_ADMIN_LOGIN_NAME} / 13700000001`,
    name: "超级管理员",
    id: "-",
  });

  // 平台计价参数
  await prisma.platformPricing.create({
    data: {
      id: "default",
      data: JSON.stringify(DEFAULT_PLATFORM_PRICING_CONFIG),
    },
  });

  // 等级管理
  await prisma.levelManagement.create({
    data: {
      id: "default",
      data: JSON.stringify(cloneDefaultLevelManagement()),
    },
  });

  // 平台内容
  await prisma.platformContent.create({
    data: {
      id: "default",
      data: JSON.stringify(cloneDefaultPlatformContent()),
    },
  });

  await prisma.contractTemplates.create({
    data: {
      id: "default",
      data: JSON.stringify(cloneDefaultContractTemplates()),
    },
  });

  // 纠纷演示数据
  for (const d of demoDisputes) {
    await prisma.dispute.create({
      data: {
        id: d.id,
        orderId: d.orderId,
        orderCode: d.orderCode,
        clientId: d.clientId,
        designerId: d.designerId,
        status: d.status,
        raisedAt: new Date(d.raisedAt),
        data: JSON.stringify(d),
      },
    });
  }

  // 意见反馈（联系客服留言演示）
  for (const item of demoFeedbackMessages) {
    await prisma.feedbackMessage.create({
      data: {
        id: item.id,
        audience: item.audience,
        identityId: item.identityId,
        userName: item.userName,
        phone: item.phone,
        message: item.message,
        status: item.status,
        replyNote: item.replyNote,
        createdAt: new Date(item.createdAt),
        repliedAt: item.repliedAt ? new Date(item.repliedAt) : null,
      },
    });
  }

  console.log("\n播种完成！演示账号清单（验证码统一为 888888）：");
  console.table(accountList);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
