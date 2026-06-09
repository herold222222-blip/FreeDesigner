"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import {
  AdministrativeRegionSelector,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/components/domain/administrative-region-selector";
import { ProfileImageUpload } from "@/components/domain/profile-image-upload";
import { sendCode as sendCodeApi, registerRequest } from "@/lib/api-client";
import { defaultAvatarForGender } from "@/lib/default-profile-images";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";

const SECTIONS = [
  { title: "真实姓名", desc: "与身份证一致" },
  { title: "头像", desc: "可按性别使用默认头像" },
  { title: "手机号", desc: "短信验证" },
  { title: "常驻地区", desc: "省 / 市 / 区" },
];

export default function ClientOnboardingPage() {
  const router = useRouter();
  const push = useSessionStore((s) => s.pushNotification);
  const setRole = useRoleStore((s) => s.setRole);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [avatar, setAvatar] = useState(() => defaultAvatarForGender("male"));
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locationTriple, setLocationTriple] = useState<AdministrativeTriple>(
    getDefaultAdministrativeTriple,
  );

  const locationLabel = useMemo(
    () => resolveAdministrativeTriple(locationTriple)?.fullLabel ?? "",
    [locationTriple],
  );

  useEffect(() => {
    if (codeSeconds <= 0) return;
    const t = setTimeout(() => setCodeSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [codeSeconds]);

  const normalizedPhone = phone.replace(/\s/g, "");

  const sendSmsCode = async () => {
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    try {
      const res = await sendCodeApi(normalizedPhone, "register");
      setCodeSeconds(60);
      push({
        title: "验证码已发送",
        description: res.demoCode ? `演示用验证码：${res.demoCode}` : undefined,
      });
    } catch (e) {
      push({
        title: "验证码发送失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      push({ title: "请输入真实姓名", variant: "destructive" });
      return;
    }
    if (!gender) {
      push({ title: "请选择性别", variant: "destructive" });
      return;
    }
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    if (!smsCode.trim()) {
      push({ title: "请输入短信验证码", variant: "destructive" });
      return;
    }
    if (!locationLabel) {
      push({ title: "请选择常驻地区", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await registerRequest({
        phone: normalizedPhone,
        code: smsCode.trim(),
        kind: "client",
        clientType: "individual",
        name: name.trim(),
        location: locationLabel,
        gender,
        avatar,
      });
      setRole(res.role, res.identityId);
      push({
        title: "注册成功",
        description: "个人委托人无需审核，已自动登录。",
        variant: "success",
      });
      router.push("/client");
    } catch (e) {
      push({
        title: "注册失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-10">
      <Link
        href="/login?register=1&kind=client_individual"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回入驻页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-5 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold text-ink">个人委托人入驻</h3>
          </div>
          <Badge variant="muted" className="mb-3 w-fit text-[10px]">
            无需审核 · 注册即可下单
          </Badge>
          <p className="mb-4 text-xs leading-relaxed text-ink-60">
            请在本页依次填写以下信息，完成后点击「完成注册并登录」。
          </p>
          <ol className="space-y-3">
            {SECTIONS.map((s, i) => (
              <li
                key={s.title}
                className="flex items-start gap-3 rounded-xl bg-ink-20/30 p-3 text-ink"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-20 bg-white text-xs font-semibold text-ink-60">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-ink-40">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                完善个人委托人资料
              </h1>
              <p className="mt-1 text-sm text-ink-60">
                填写姓名、手机号与常驻地区，用于实名核验与项目匹配。
              </p>
            </div>

            <div className="space-y-2">
              <Label>真实姓名 *</Label>
              <Input
                placeholder="请输入与身份证一致的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-ink-40">
                用于平台实名核验与合同签署。
              </p>
            </div>

            <div className="space-y-2">
              <Label>性别 *</Label>
              <div className="grid max-w-xs grid-cols-2 gap-2">
                {(
                  [
                    { value: "male" as const, label: "男" },
                    { value: "female" as const, label: "女" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={cn(
                      "h-11 rounded-xl border text-sm font-medium transition-colors",
                      gender === opt.value
                        ? "border-ink bg-ink text-white"
                        : "border-ink-20 text-ink-60 hover:border-ink/40",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <ProfileImageUpload
              kind="avatar"
              value={avatar}
              onChange={setAvatar}
              gender={gender}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>手机号 *</Label>
                <Input
                  placeholder="11 位手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>短信验证码 *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="6 位数字"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={sendSmsCode}
                    disabled={codeSeconds > 0}
                  >
                    {codeSeconds > 0 ? `${codeSeconds} 秒` : "获取验证码"}
                  </Button>
                </div>
                <p className="text-xs text-ink-40">
                  手机号将作为登录账号。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>常驻地区 *</Label>
              <AdministrativeRegionSelector
                triple={locationTriple}
                onTripleChange={setLocationTriple}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end border-t border-ink-20 pt-6">
            <Button
              size="lg"
              variant="brand"
              onClick={handleRegister}
              disabled={submitting}
            >
              完成注册并登录
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
