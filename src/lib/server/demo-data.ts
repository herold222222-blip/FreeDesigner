import "server-only";

/** 是否合并演示 mock 数据（生产环境请设 DEMO_CODE_ENABLED=off） */
export function demoDataEnabled(): boolean {
  return process.env.DEMO_CODE_ENABLED !== "off";
}
