/**
 * 种子脚本：仅写入预设账号 FD001–FD010 与平台基础配置。
 * 不导入演示委托人 / 设计师 / 订单 / 悬赏等业务样例。
 * 运行：npm run db:seed 或 npm run prod:db:seed
 *
 * 预设账号：
 *   FD001 超管 FD19076652
 *   FD002–FD004 管理员 FD4006801231
 *   FD005–FD010 普通账号 4006801231（登录后自行注册委托人/设计师）
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PLATFORM_PRICING_CONFIG } from "../src/lib/platform-pricing";
import { cloneDefaultContractTemplates } from "../src/lib/contract-templates";
import { cloneDefaultPlatformContent } from "../src/lib/platform-content";
import { cloneDefaultLevelManagement } from "../src/lib/level-management";
import { PRESET_ACCOUNTS } from "../src/lib/admin-accounts";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function reset() {
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
  console.log("开始播种（仅预设账号 + 平台配置）...");
  await reset();

  const accountList: { role: string; account: string; name: string }[] = [];

  for (let i = 0; i < PRESET_ACCOUNTS.length; i++) {
    const preset = PRESET_ACCOUNTS[i];
    const phone = `1370000${String(i + 1).padStart(4, "0")}`;
    await prisma.user.create({
      data: {
        phone,
        loginName: preset.loginName,
        passwordHash: await hashPassword(preset.password),
        name: preset.name,
        role: preset.role,
        status: "active",
        avatar: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(
          preset.loginName,
        )}&backgroundColor=1f2937&textColor=ffffff`,
      },
    });
    accountList.push({
      role:
        preset.role === "super_admin"
          ? "超级管理员"
          : preset.role === "admin"
            ? "管理员"
            : "普通账号",
      account: `${preset.loginName} / ${preset.password}`,
      name: preset.name,
    });
  }

  await prisma.platformPricing.create({
    data: {
      id: "default",
      data: JSON.stringify(DEFAULT_PLATFORM_PRICING_CONFIG),
    },
  });

  await prisma.levelManagement.create({
    data: {
      id: "default",
      data: JSON.stringify(cloneDefaultLevelManagement()),
    },
  });

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

  console.log("\n播种完成！库中仅保留以下预设账号（无演示业务数据）：");
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
