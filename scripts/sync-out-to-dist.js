/**
 * 将 Next.js 静态导出目录 `out/` 复制到 `dist/`（递归 copyFile，避免个别环境下 fs.cpSync 崩溃）
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const distDir = path.join(root, "dist");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

if (!fs.existsSync(outDir)) {
  console.error("未找到 out/：请先运行 next build（需配置 output: \"export\"）。");
  process.exit(1);
}

try {
  fs.rmSync(distDir, { recursive: true, force: true });
} catch (_) {
  /* ignore */
}

fs.mkdirSync(distDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  copyRecursive(path.join(outDir, name), path.join(distDir, name));
}

console.log("已从 out/ 复制到 dist/，可将 dist 设为 Netlify 发布目录。");
