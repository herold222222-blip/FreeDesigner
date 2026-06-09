"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import {
  sendCode as sendCodeApi,
  loginRequest,
} from "@/lib/api-client";
import {
  Sparkles,
  ShieldCheck,
  User,
  Building2,
  ArrowRight,
  Crown,
  Users,
} from "lucide-react";
import type { Role, SubjectType } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** 对外开放入驻的身份（不含平台管理员） */
const REGISTER_ROLES = ["client", "designer"] as const satisfies readonly Role[];

type RegisterRole = (typeof REGISTER_ROLES)[number];

/** 入驻页提前展示的五种主体 */
type RegisterKind =
  | "client_individual"
  | "client_enterprise"
  | "designer_individual"
  | "designer_team"
  | "designer_company";

const REGISTER_KINDS: RegisterKind[] = [
  "client_individual",
  "client_enterprise",
  "designer_individual",
  "designer_team",
  "designer_company",
];

const REGISTER_KIND_META: Record<
  RegisterKind,
  {
    label: string;
    description: string;
    icon: typeof User;
    subjectType?: SubjectType;
  }
> = {
  client_individual: {
    label: "个人委托人",
    description: "个人发布项目、下单与托管付款，无需审核",
    icon: User,
  },
  client_enterprise: {
    label: "企业委托人",
    description: "企业主体下单，需上传营业执照等企业资质",
    icon: Building2,
  },
  designer_individual: {
    label: "设计师",
    description: "个人设计师，完成资料与作品审核后接单",
    icon: Sparkles,
    subjectType: "individual",
  },
  designer_team: {
    label: "设计团队",
    description: "多人协作团队，统一品牌对外接单",
    icon: Users,
    subjectType: "team",
  },
  designer_company: {
    label: "设计公司",
    description: "设计企业主体，需提交营业执照等资质",
    icon: Building2,
    subjectType: "company",
  },
};

const ROLE_TAB_META: Record<
  RegisterRole | "admin" | "super_admin",
  { label: string; icon: typeof User }
> = {
  client: { label: "委托人", icon: User },
  designer: { label: "设计师", icon: Sparkles },
  admin: { label: "管理员", icon: ShieldCheck },
  super_admin: { label: "超级管理员", icon: Crown },
};

function parseRegisterKind(param: string | null): RegisterKind {
  if (param && REGISTER_KINDS.includes(param as RegisterKind)) {
    return param as RegisterKind;
  }
  if (param === "designer") return "designer_individual";
  if (param === "client") return "client_individual";
  return "client_individual";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-ink-60">加载中...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isRegister = params.get("register") === "1";
  const isAdminConsole = params.get("console") === "admin";
  const roleParam = params.get("role") as Role | null;
  const kindParam = params.get("kind");

  const initialRole: Role =
    isRegister
      ? "client"
      : isAdminConsole
        ? "super_admin"
        : roleParam && ["client", "designer", "admin", "super_admin"].includes(roleParam)
          ? roleParam
          : "client";

  const setRole = useRoleStore((s) => s.setRole);
  const push = useSessionStore((s) => s.pushNotification);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [activeRole, setActiveRole] = useState<Role>(initialRole);
  const [registerKind, setRegisterKind] = useState<RegisterKind>(() =>
    parseRegisterKind(kindParam),
  );

  const tabRoles: Role[] = isRegister
    ? [...REGISTER_ROLES]
    : isAdminConsole
      ? ["admin", "super_admin"]
      : ["client", "designer"];

  useEffect(() => {
    if (isRegister && kindParam) {
      setRegisterKind(parseRegisterKind(kindParam));
    }
  }, [isRegister, kindParam]);

  useEffect(() => {
    if (isRegister && !REGISTER_ROLES.includes(activeRole as RegisterRole)) {
      setActiveRole("client");
    }
  }, [isRegister, activeRole]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    try {
      const res = await sendCodeApi(phone, isRegister ? "register" : "login");
      setSeconds(60);
      push({
        title: "验证码已发送",
        description: res.demoCode ? `演示用验证码:${res.demoCode}` : undefined,
      });
    } catch (e) {
      push({
        title: "验证码发送失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const registerKindLabel = REGISTER_KIND_META[registerKind].label;

  const designerOnboardingHref = (() => {
    const subject = REGISTER_KIND_META[registerKind].subjectType ?? "individual";
    return `/onboarding/designer?subject=${subject}`;
  })();

  const roleHome = (role: Role) =>
    role === "client"
      ? "/client"
      : role === "designer"
        ? "/designer"
        : role === "admin"
          ? "/admin"
          : "/super-admin";

  const handleRegisterContinue = () => {
    if (registerKind === "client_individual") {
      router.push("/onboarding/client");
      return;
    }
    if (registerKind === "client_enterprise") {
      router.push("/onboarding/enterprise");
      return;
    }
    router.push(designerOnboardingHref);
  };

  const handleAdminSubmit = async () => {
    if (submitting) return;
    if (!loginName.trim()) {
      push({ title: "请输入登录账号", variant: "destructive" });
      return;
    }
    if (!password) {
      push({ title: "请输入密码", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginRequest({
        loginName: loginName.trim(),
        password,
        role: activeRole,
      });
      setRole(res.role, res.identityId);
      push({
        title: `欢迎回来 · ${
          res.role === "super_admin" ? "超级管理员" : "管理员"
        }`,
        variant: "success",
      });
      router.push(roleHome(res.role));
    } catch (e) {
      push({
        title: "登录失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!/^1\d{10}$/.test(phone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    if (!code) {
      push({ title: "请输入验证码", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginRequest({ phone, code, role: activeRole });
      setRole(res.role, res.identityId);
      push({
        title: `欢迎回来 · ${
          res.role === "client"
            ? "委托人"
            : res.role === "designer"
              ? "设计师"
              : res.role === "admin"
                ? "管理员"
                : "超级管理员"
        }`,
        variant: "success",
      });
      router.push(roleHome(res.role));
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const registerForm = (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-medium uppercase tracking-wider text-ink-40">
          选择入驻身份
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {REGISTER_KINDS.map((kind) => {
            const meta = REGISTER_KIND_META[kind];
            const Icon = meta.icon;
            const selected = registerKind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setRegisterKind(kind)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  selected
                    ? "border-ink bg-ink-20/30 shadow-sm"
                    : "border-ink-20 bg-white hover:border-ink/40",
                )}
              >
                <div className="flex items-center gap-2 font-medium text-ink">
                  <Icon className="h-4 w-4 shrink-0" />
                  {meta.label}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-ink-60">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {registerKind === "client_individual" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
          个人委托人<strong className="text-emerald-950">无需审核</strong>
          ，下一步填写姓名、手机号（短信验证）与常驻地区后即可登录使用。
        </div>
      ) : registerKind === "client_enterprise" ? (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-xs text-ink-60">
          企业委托人注册后可登录，但需完善
          <strong className="text-ink">企业名称、统一社会信用代码、营业执照</strong>
          并等待审核通过后，方可发布常规委托与悬赏委托。
        </div>
      ) : (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-xs text-ink-60">
          <strong className="text-ink">{registerKindLabel}</strong> 入驻需完成{" "}
          <strong className="text-brand">4 步资料填写</strong>
          （基础信息 → 专业 → 服务设置 → 档期），
          {registerKind === "designer_company"
            ? "并上传营业执照等企业资质，"
            : registerKind === "designer_team"
              ? "并填写团队名称与核心成员，"
              : "并提交实名信息，"}
          提交后由平台审核，通常 1 个工作日内反馈。
        </div>
      )}

      <Button
        size="lg"
        variant="brand"
        className="w-full"
        onClick={handleRegisterContinue}
      >
        进一步完善资料
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const loginCard = (
        <Card className="p-8">
          {isRegister ? (
            registerForm
          ) : (
            <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as Role)}>
              <TabsList className="w-full">
                {tabRoles.map((role) => {
                  const meta = ROLE_TAB_META[role as keyof typeof ROLE_TAB_META];
                  const Icon = meta.icon;
                  return (
                    <TabsTrigger key={role} value={role} className="flex-1">
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value={activeRole}>
                {isAdminConsole ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>登录账号</Label>
                      <Input
                        placeholder="请输入管理员账号"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>密码</Label>
                      <Input
                        type="password"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>

                    <Button
                      size="lg"
                      variant="brand"
                      className="w-full"
                      disabled={submitting}
                      onClick={handleAdminSubmit}
                    >
                      {submitting ? "登录中..." : "登录后台"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>手机号</Label>
                      <Input
                        placeholder="请输入手机号"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>短信验证码</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="6 位数字"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          onClick={sendCode}
                          disabled={seconds > 0}
                        >
                          {seconds > 0 ? `${seconds} 秒` : "获取验证码"}
                        </Button>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      variant="brand"
                      className="w-full"
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting ? "登录中..." : "登录"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-6 flex items-center justify-between text-xs text-ink-60">
            {isRegister ? (
              <Link href="/login" className="hover:text-ink">
                已有账号 → 立即登录
              </Link>
            ) : isAdminConsole ? (
              <Link href="/login" className="hover:text-ink">
                委托人 / 设计师登录
              </Link>
            ) : (
              <Link href="/login?register=1" className="hover:text-ink">
                还没有账号 → 立即入驻
              </Link>
            )}
            <Link href="/" className="hover:text-ink">
              返回首页
            </Link>
          </div>
        </Card>
  );

  if (isAdminConsole) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md space-y-8">
          <div className="space-y-4 text-center">
            <Badge variant="muted" className="gap-1">
              <ShieldCheck className="h-3 w-3 text-brand" />
              平台管理
            </Badge>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink">
              管理员后台
              <br />
              <span className="text-brand">安全登录</span>
            </h1>
          </div>
          {loginCard}
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-16">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <Badge variant="muted" className="gap-1">
            <Sparkles className="h-3 w-3 text-brand" />
            {isRegister ? "立即入驻" : "欢迎回来"}
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-ink">
            {isRegister ? (
              <>
                加入乐自由,
                <br />
                选择您的<span className="text-brand">入驻身份</span>。
              </>
            ) : (
              <>
                一个账号,
                <br />
                打通{" "}
                <span className="text-brand">委托 · 设计</span> 双端工作。
              </>
            )}
          </h1>
          <p className="max-w-xl text-sm text-ink-60">
            {isRegister
              ? "支持个人委托人、企业委托人、个人设计师、设计团队、设计公司五类主体入驻。平台管理员账号由内部开通。原型阶段任意手机号 + 验证码 "
              : "手机号 + 短信验证码即可登录。原型阶段任意手机号 + 验证码 "}
            <code className="rounded bg-ink-20/40 px-1.5 py-0.5 text-xs">888888</code>{" "}
            即可。
          </p>
          <div className="grid gap-3 pt-2">
            <Card className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-sm font-medium text-ink">资质审核保障</div>
                <div className="text-xs text-ink-60">
                  设计师、设计团队、设计公司须通过实名与资质审核；企业委托人需上传营业执照。
                </div>
              </div>
            </Card>
            <Card className="flex items-start gap-3 p-4">
              <Users className="mt-0.5 h-5 w-5 text-brand" />
              <div>
                <div className="text-sm font-medium text-ink">多主体入驻</div>
                <div className="text-xs text-ink-60">
                  个人设计师、设计团队、设计公司均可独立入驻，对外展示对应主体标识。
                </div>
              </div>
            </Card>
          </div>
        </div>

        {loginCard}
      </div>
    </div>
  );
}
