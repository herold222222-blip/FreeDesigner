/**
 * 委托下单全流程 API 自检（需已 db:seed 且 dev 服务运行在 BASE_URL）
 * 用法：node scripts/verify-entrust-flow.mjs
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const CODE = process.env.DEMO_VERIFICATION_CODE || "888888";

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(phone, role) {
  await json("/api/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, purpose: "login" }),
  });
  const { res, body } = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, code: CODE, role }),
  });
  assert(res.ok && body.ok, `登录失败 ${phone}: ${body.error || res.status}`);
  const cookie = res.headers.get("set-cookie");
  assert(cookie, "无 session cookie");
  return cookie.split(";")[0];
}

async function main() {
  console.log(`\n=== 乐自由委托流程自检 @ ${BASE} ===\n`);

  const clientCookie = await login("13800010000", "client");
  const designerCookie = await login("13900010000", "designer");
  const adminCookie = await login("13700000000", "admin");
  const auth = (cookie) => ({ Cookie: cookie });

  // 1. 常规委托
  const { body: regularRes } = await json("/api/orders", {
    method: "POST",
    headers: auth(clientCookie),
    body: JSON.stringify({
      title: "自检-常规委托",
      specialty: "landscape",
      projectType: "高层住宅",
      serviceMode: "online",
      billingMode: "area",
      orderSource: "regular",
      totalAmount: 48000,
      description: "API 自检常规委托",
      projectAreaSqm: 5000,
    }),
  });
  assert(regularRes.ok, `常规委托创建失败: ${regularRes.error}`);
  const matchingId = regularRes.data.id;
  console.log("✓ 常规委托 → matching", matchingId);

  const { body: assignRes } = await json(`/api/orders/${matchingId}/assign`, {
    method: "POST",
    headers: auth(adminCookie),
    body: JSON.stringify({
      designerId: "designer_chen",
      totalAmount: 48000,
    }),
  });
  assert(assignRes.ok, `委派失败: ${assignRes.error}`);
  console.log("✓ 管理员委派 → pending_contract");

  // 2. 悬赏
  const { body: bountyRes } = await json("/api/bounties", {
    method: "POST",
    headers: auth(clientCookie),
    body: JSON.stringify({
      title: "自检-悬赏",
      specialty: "landscape",
      primaryTrack: { l1: "landscape", l2: ["construction_doc"], l3: ["ls_garden"] },
      location: { provinceCode: "33", provinceName: "浙江省", label: "浙江省 · 杭州市" },
      description: "API 自检悬赏",
      reward: 30000,
      rewardModel: "fixed",
      deadline: "2026-12-31",
      requirements: ["有案例"],
      attachments: [],
    }),
  });
  assert(bountyRes.ok, `悬赏创建失败: ${bountyRes.error}`);
  const bountyId = bountyRes.data.id;
  console.log("✓ 悬赏发布", bountyId);

  const { body: applyRes } = await json(`/api/bounties/${bountyId}/apply`, {
    method: "POST",
    headers: auth(designerCookie),
    body: JSON.stringify({
      appliedL3: "ls_garden",
      proposal: "可承接",
      quotedAmount: 28000,
      estimatedDays: 14,
    }),
  });
  assert(applyRes.ok, `设计师报名失败: ${applyRes.error}`);

  const { body: awardRes } = await json(`/api/bounties/${bountyId}/award`, {
    method: "POST",
    headers: auth(clientCookie),
    body: JSON.stringify({ designerId: "designer_chen" }),
  });
  assert(awardRes.ok, `悬赏中标失败: ${awardRes.error}`);
  const bountyOrderId = awardRes.data.id;
  console.log("✓ 悬赏中标 → 订单", bountyOrderId);

  // 3. 定向下单 + 档期 + 签约 + 预付（沙箱）
  const { body: directedRes } = await json("/api/orders", {
    method: "POST",
    headers: auth(clientCookie),
    body: JSON.stringify({
      designerId: "designer_chen",
      title: "自检-定向下单",
      specialty: "landscape",
      projectType: "别墅",
      serviceMode: "online",
      billingMode: "daily",
      orderSource: "directed",
      totalAmount: 12000,
      description: "API 自检定向下单",
      selectedSlots: [{ date: "2026-07-01", period: "am" }],
    }),
  });
  assert(directedRes.ok, `定向下单失败: ${directedRes.error}`);
  const directedId = directedRes.data.id;
  console.log("✓ 定向下单 → pending_schedule", directedId);

  const { body: acceptRes } = await json(`/api/orders/${directedId}/accept`, {
    method: "POST",
    headers: auth(designerCookie),
  });
  assert(acceptRes.ok, `确认档期失败: ${acceptRes.error}`);
  console.log("✓ 设计师确认档期");

  await json(`/api/orders/${directedId}/sign`, {
    method: "POST",
    headers: auth(clientCookie),
  });
  await json(`/api/orders/${directedId}/designer-sign`, {
    method: "POST",
    headers: auth(designerCookie),
  });
  console.log("✓ 双方签约");

  const stageId = acceptRes.data.stages[0].id;
  const { body: payIntentRes } = await json(
    `/api/orders/${directedId}/stages/${stageId}/pay-intent`,
    { method: "POST", headers: auth(clientCookie) },
  );
  assert(payIntentRes.ok, `支付意图失败: ${payIntentRes.error}`);
  console.log("✓ 预付款支付意图", payIntentRes.data.status);

  // 4. 档期 API
  const { body: schRes } = await json("/api/schedule-requests", {
    headers: auth(clientCookie),
  });
  assert(schRes.ok, `档期列表失败: ${schRes.error}`);
  console.log("✓ 档期申请 API", schRes.data?.length ?? 0, "条");

  // 5. 纠纷 API（管理员）
  const { body: dispRes } = await json("/api/disputes", {
    headers: auth(adminCookie),
  });
  assert(dispRes.ok, `纠纷列表失败: ${dispRes.error}`);
  console.log("✓ 纠纷 API", dispRes.data?.length ?? 0, "条");

  const { body: dispCountRes } = await json("/api/disputes/counts", {
    headers: auth(adminCookie),
  });
  assert(dispCountRes.ok, `纠纷统计失败: ${dispCountRes.error}`);
  console.log("✓ 进行中纠纷", dispCountRes.data?.active ?? 0, "条");

  console.log("\n=== 全部自检通过 ===\n");
}

main().catch((e) => {
  console.error("\n自检失败:", e.message);
  process.exit(1);
});
