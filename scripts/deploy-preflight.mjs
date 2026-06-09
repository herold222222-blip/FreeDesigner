/**
 * 部署前检查（在服务器项目根目录执行）
 *   node scripts/deploy-preflight.mjs              # 内测
 *   node scripts/deploy-preflight.mjs --production # 正式
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const production = process.argv.includes("--production");
const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");

const errors = [];
const warns = [];

function loadEnv() {
  if (!existsSync(envPath)) {
    errors.push("缺少 .env，请执行：cp .env.internal.example .env");
    return {};
  }
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();

const required = ["POSTGRES_PASSWORD", "AUTH_SECRET", "PUBLIC_BASE_URL"];
for (const key of required) {
  const v = env[key];
  if (!v || v.includes("请改")) {
    errors.push(`${key} 未填写或使用占位符`);
  }
}

if (production && env.DEMO_CODE_ENABLED !== "off") {
  warns.push("正式环境建议 DEMO_CODE_ENABLED=off");
}
if (production && env.NEXT_PUBLIC_DEMO_MODE !== "off") {
  warns.push("正式环境建议 NEXT_PUBLIC_DEMO_MODE=off（需重新 docker compose build）");
}
if (production && env.COOKIE_SECURE !== "true") {
  warns.push("正式环境建议 COOKIE_SECURE=true");
}
if (production && !(env.PUBLIC_BASE_URL || "").startsWith("https://")) {
  warns.push("正式环境 PUBLIC_BASE_URL 建议使用 https:// 域名");
}

if (env.DEMO_CODE_ENABLED === "off" && !env.SMS_PROVIDER) {
  errors.push("DEMO_CODE_ENABLED=off 但未配置 SMS_PROVIDER，用户将无法收验证码");
}

if (env.COOKIE_SECURE === "true" && (env.PUBLIC_BASE_URL || "").startsWith("http://")) {
  warns.push("COOKIE_SECURE=true 但 PUBLIC_BASE_URL 为 http，登录可能失败");
}

if (env.COOKIE_SECURE === "false" && (env.PUBLIC_BASE_URL || "").startsWith("https://")) {
  warns.push("PUBLIC_BASE_URL 为 https 但 COOKIE_SECURE=false，建议改为 true");
}

if (!env.CRON_SECRET || env.CRON_SECRET.includes("请改")) {
  warns.push("未设置 CRON_SECRET，订单超时不会自动处理（可后补 crontab）");
}

console.log(`\n=== 乐自由 · ${production ? "正式" : "内测"}部署预检 ===\n`);
if (errors.length) {
  console.log("❌ 必须修复：");
  errors.forEach((e) => console.log("  -", e));
}
if (warns.length) {
  console.log("\n⚠️  建议关注：");
  warns.forEach((w) => console.log("  -", w));
}
if (!errors.length && !warns.length) {
  console.log("✓ .env 检查通过，可以执行 docker compose up -d --build");
}
console.log("");

process.exit(errors.length ? 1 : 0);
