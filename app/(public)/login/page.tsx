"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import {
  sendCode as sendCodeApi,
  loginRequest,
  switchRoleRequest,
  type SessionUserDTO,
} from "@/lib/api-client";
import {
  Sparkles,
  ShieldCheck,
  User,
  Building2,
  ArrowRight,
  Users,
  KeyRound,
  Smartphone,
} from "lucide-react";
import type { Role, SubjectType } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

function parseRegisterKind(param: string | null): RegisterKind {
  if (param && REGISTER_KINDS.includes(param as RegisterKind)) {
    return param as RegisterKind;
  }
  if (param === "designer") return "designer_individual";
  if (param === "client") return "client_individual";
  return "client_individual";
}

function roleHome(role: Role) {
  if (role === "client") return "/client";
  if (role === "designer") return "/designer";
  if (role === "admin") return "/admin";
  return "/super-admin";
}

function roleLabel(role: Role) {
  if (role === "client") return "委托人";
  if (role === "designer") return "设计师";
  if (role === "admin") return "管理员";
  return "超级管理员";
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">
          加载中...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isRegister = params.get("register") === "1";
  const kindParam = params.get("kind");
  const attachMode = params.get("attach") === "1";
  const focusParam = params.get("focus"); // client | designer

  const setRole = useRoleStore((s) => s.setRole);
  const push = useSessionStore((s) => s.pushNotification);

  const [loginMethod, setLoginMethod] = useState<"code" | "password">("password");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [registerKind, setRegisterKind] = useState<RegisterKind>(() =>
    parseRegisterKind(kindParam),
  );

  const [rolePickOpen, setRolePickOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionUserDTO | null>(
    null,
  );

  useEffect(() => {
    if (isRegister && kindParam) {
      setRegisterKind(parseRegisterKind(kindParam));
    }
  }, [isRegister, kindParam]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const sendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    try {
      await sendCodeApi(phone, "login");
      setSeconds(60);
      push({
        title: "验证码已发送",
      });
    } catch (e) {
      push({
        title: "验证码发送失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const applySession = (res: SessionUserDTO) => {
    setRole(res.role, res.identityId);
  };

  const finishLogin = (res: SessionUserDTO) => {
    applySession(res);
    if (res.needsRolePick) {
      setPendingSession(res);
      setRolePickOpen(true);
      return;
    }
    if (res.needsOnboarding) {
      setPendingSession(res);
      setOnboardingOpen(true);
      return;
    }
    push({
      title: `欢迎回来 · ${roleLabel(res.role)}`,
      variant: "success",
    });
    // 管理员 / 超级管理员登录后固定进入工作台
    if (res.role === "admin" || res.role === "super_admin") {
      router.replace(roleHome(res.role));
      return;
    }
    const redirectParam = params.get("redirect");
    const safeRedirect =
      redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
        ? redirectParam
        : null;
    router.push(safeRedirect ?? res.redirectTo ?? roleHome(res.role));
  };

  const handleCodeLogin = async () => {
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
      const res = await loginRequest({ phone, code });
      finishLogin(res);
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

  const handlePasswordLogin = async () => {
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
      });
      finishLogin(res);
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

  const handlePickRole = async (role: "client" | "designer") => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const switched = await switchRoleRequest(role);
      setRole(switched.role, switched.identityId);
      setRolePickOpen(false);
      setPendingSession(null);
      push({
        title: `已进入${roleLabel(switched.role)}工作台`,
        variant: "success",
      });
      router.push(roleHome(switched.role));
    } catch (e) {
      push({
        title: "切换身份失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const goAttachOnboarding = (role: "client" | "designer") => {
    setOnboardingOpen(false);
    setPendingSession(null);
    if (role === "client") {
      router.push("/login?register=1&attach=1&focus=client");
      return;
    }
    router.push("/login?register=1&attach=1&focus=designer");
  };

  const visibleRegisterKinds = useMemo(() => {
    return REGISTER_KINDS.filter((kind) => {
      if (!attachMode || !focusParam) return true;
      if (focusParam === "client") return kind.startsWith("client_");
      if (focusParam === "designer") return kind.startsWith("designer_");
      return true;
    });
  }, [attachMode, focusParam]);

  useEffect(() => {
    if (!isRegister || !attachMode || !focusParam) return;
    const first = visibleRegisterKinds[0];
    if (first && !visibleRegisterKinds.includes(registerKind)) {
      setRegisterKind(first);
    }
  }, [isRegister, attachMode, focusParam, registerKind, visibleRegisterKinds]);

  const registerKindLabel = REGISTER_KIND_META[registerKind].label;

  const designerOnboardingHref = (() => {
    const subject = REGISTER_KIND_META[registerKind].subjectType ?? "individual";
    const qs = new URLSearchParams({ subject });
    if (attachMode) qs.set("attach", "1");
    return `/onboarding/designer?${qs.toString()}`;
  })();

  const handleRegisterContinue = () => {
    const attachQs = attachMode ? "?attach=1" : "";
    if (registerKind === "client_individual") {
      router.push(`/onboarding/client${attachQs}`);
      return;
    }
    if (registerKind === "client_enterprise") {
      router.push(`/onboarding/enterprise${attachQs}`);
      return;
    }
    router.push(designerOnboardingHref);
  };

  const registerForm = (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-medium uppercase tracking-wider text-ink-40">
          选择入驻身份
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {visibleRegisterKinds.map((kind) => {
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
          <strong className="text-ink">
            企业名称、统一社会信用代码、营业执照
          </strong>
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

  const loginForm = (
    <Tabs
      value={loginMethod}
      onValueChange={(v) => setLoginMethod(v as "code" | "password")}
    >
      <TabsList className="w-full">
        <TabsTrigger value="password" className="flex-1">
          <KeyRound className="h-3.5 w-3.5" /> 账号密码
        </TabsTrigger>
        <TabsTrigger value="code" className="flex-1">
          <Smartphone className="h-3.5 w-3.5" /> 手机验证码
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>登录账号</Label>
            <Input
              placeholder="如 FD001"
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
            onClick={handlePasswordLogin}
          >
            {submitting ? "登录中..." : "登录"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="code">
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
            onClick={handleCodeLogin}
          >
            {submitting ? "登录中..." : "登录"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );

  const loginCard = (
    <Card className="p-8">
      {isRegister ? registerForm : loginForm}

      <div className="mt-6 flex items-center justify-between text-xs text-ink-60">
        {isRegister ? (
          <Link href="/login" className="hover:text-ink">
            已有账号 → 立即登录
          </Link>
        ) : (
          <Link href="/login?register=1" className="hover:text-ink">
            还没有账号 → 立即注册
          </Link>
        )}
        <Link href="/" className="hover:text-ink">
          返回首页
        </Link>
      </div>
    </Card>
  );

  const pickRoles =
    (pendingSession?.availableRoles?.filter(
      (r): r is "client" | "designer" => r === "client" || r === "designer",
    ) ?? ["client", "designer"]) as Array<"client" | "designer">;

  return (
    <div className="container-page py-8 sm:py-16">
      <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="space-y-6">
          <Badge variant="muted" className="gap-1">
            <Sparkles className="h-3 w-3 text-brand" />
            {isRegister ? "立即注册" : "登录 / 注册"}
          </Badge>
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
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
              ? attachMode
                ? "请选择要完善的业务身份，并继续填写入驻资料。资料提交后即可进入对应工作台。"
                : "支持个人委托人、企业委托人、个人设计师、设计团队、设计公司五类主体入驻。平台管理员账号由内部开通。"
              : "支持账号密码或手机验证码登录。登录时无需选择身份；普通账号登录后可注册委托人/设计师并填写资料。"}
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

      <Dialog open={rolePickOpen} onOpenChange={setRolePickOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>选择登录身份</DialogTitle>
            <DialogDescription>
              当前账号同时具备委托人与设计师身份，请选择本次进入的工作台。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {pickRoles.map((role) => (
              <Button
                key={role}
                size="lg"
                variant={role === "client" ? "brand" : "outline"}
                className="h-auto justify-start gap-3 py-4"
                disabled={submitting}
                onClick={() => handlePickRole(role)}
              >
                {role === "client" ? (
                  <User className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                <span className="text-left">
                  <span className="block font-medium">
                    以{roleLabel(role)}身份进入
                  </span>
                  <span className="block text-xs font-normal opacity-70">
                    {role === "client"
                      ? "发布委托、悬赏与验收付款"
                      : "接单、交付与提现"}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>完善账号身份</DialogTitle>
            <DialogDescription>
              {pendingSession?.name
                ? `「${pendingSession.name}」`
                : "当前账号"}
              尚未注册业务身份。请选择注册为委托人还是设计师。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <Button
              size="lg"
              variant="brand"
              className="h-auto justify-start gap-3 py-4"
              onClick={() => goAttachOnboarding("client")}
            >
              <User className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-medium">注册为委托人</span>
                <span className="block text-xs font-normal opacity-70">
                  进入资料填写，完成后可发布委托
                </span>
              </span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-auto justify-start gap-3 py-4"
              onClick={() => goAttachOnboarding("designer")}
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-medium">注册为设计师</span>
                <span className="block text-xs font-normal opacity-70">
                  进入资料填写与审核流程后接单
                </span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
