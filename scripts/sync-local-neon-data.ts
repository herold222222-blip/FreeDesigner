/**
 * 本地 SQLite ↔ Neon(PostgreSQL) 数据同步辅助。
 *
 * 用法（由外层脚本编排 generate，避免同一进程切换 datasource）：
 *   DATABASE_URL=file:./dev.db npx tsx scripts/sync-local-neon-data.ts dump tmp/local-db-dump.json
 *   DATABASE_URL=<neon> npx tsx scripts/sync-local-neon-data.ts restore tmp/local-db-dump.json
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const MODELS = [
  "user",
  "session",
  "verificationCode",
  "designer",
  "client",
  "serviceProvider",
  "order",
  "bounty",
  "designerReview",
  "walletTransaction",
  "reviewItem",
  "scheduleRequest",
  "scanOrder",
  "platformPricing",
  "levelManagement",
  "platformContent",
  "contractTemplates",
  "withdrawalRequest",
  "inboxMessage",
  "feedbackMessage",
  "dispute",
  "payment",
  "invoiceRequest",
] as const;

type ModelName = (typeof MODELS)[number];

/** 有外键依赖：先删子表 */
const DELETE_ORDER: ModelName[] = [
  "session",
  "designer",
  "client",
  "verificationCode",
  "invoiceRequest",
  "payment",
  "dispute",
  "inboxMessage",
  "feedbackMessage",
  "withdrawalRequest",
  "scheduleRequest",
  "scanOrder",
  "designerReview",
  "walletTransaction",
  "reviewItem",
  "order",
  "bounty",
  "serviceProvider",
  "platformPricing",
  "levelManagement",
  "platformContent",
  "contractTemplates",
  "user",
];

/** 写入顺序：先父表 */
const CREATE_ORDER: ModelName[] = [
  "user",
  "verificationCode",
  "designer",
  "client",
  "session",
  "serviceProvider",
  "order",
  "bounty",
  "designerReview",
  "walletTransaction",
  "reviewItem",
  "scheduleRequest",
  "scanOrder",
  "platformPricing",
  "levelManagement",
  "platformContent",
  "contractTemplates",
  "withdrawalRequest",
  "inboxMessage",
  "feedbackMessage",
  "dispute",
  "payment",
  "invoiceRequest",
];

const BATCH = 100;

function delegate(prisma: PrismaClient, name: ModelName) {
  return (prisma as unknown as Record<string, { findMany: Function; deleteMany: Function; createMany: Function }>)[
    name
  ];
}

function reviveDates(rows: Record<string, unknown>[]) {
  const dateKeys = new Set([
    "createdAt",
    "updatedAt",
    "expiresAt",
    "occurredAt",
    "submittedAt",
    "raisedAt",
    "paidAt",
    "issuedAt",
    "readAt",
    "repliedAt",
  ]);
  return rows.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const key of Object.keys(next)) {
      const v = next[key];
      if (dateKeys.has(key) && typeof v === "string") {
        next[key] = new Date(v);
      }
    }
    return next;
  });
}

async function dump(outPath: string) {
  const prisma = new PrismaClient();
  try {
    const payload: Record<string, unknown[]> = {};
    for (const name of MODELS) {
      const rows = await delegate(prisma, name).findMany();
      payload[name] = rows;
      console.log(`[dump] ${name}: ${rows.length}`);
    }
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload));
    console.log(`[dump] wrote ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function restore(inPath: string) {
  if (!existsSync(inPath)) {
    throw new Error(`dump file not found: ${inPath}`);
  }
  const payload = JSON.parse(readFileSync(inPath, "utf8")) as Record<
    string,
    Record<string, unknown>[]
  >;
  const prisma = new PrismaClient();
  try {
    console.log("[restore] clearing Neon tables…");
    for (const name of DELETE_ORDER) {
      const n = await delegate(prisma, name).deleteMany({});
      console.log(`[restore] deleted ${name}: ${n.count}`);
    }

    for (const name of CREATE_ORDER) {
      const rows = reviveDates(payload[name] ?? []);
      if (!rows.length) {
        console.log(`[restore] ${name}: 0`);
        continue;
      }
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        await delegate(prisma, name).createMany({ data: chunk });
        inserted += chunk.length;
      }
      console.log(`[restore] ${name}: ${inserted}`);
    }
    console.log("[restore] done");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [, , cmd, fileArg] = process.argv;
  const file = resolve(
    fileArg ?? "tmp/local-db-dump.json",
  );
  if (cmd === "dump") {
    await dump(file);
    return;
  }
  if (cmd === "restore") {
    await restore(file);
    return;
  }
  console.error(
    "Usage: tsx scripts/sync-local-neon-data.ts <dump|restore> [file]",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
