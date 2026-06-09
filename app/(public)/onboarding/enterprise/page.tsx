"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSignature,
  IdCard,
  Sparkles,
  Stamp,
  Upload,
  X,
} from "lucide-react";

const AUTHORIZATION_STATEMENT_HINT =
  "本公司委托上述联系人作为企业代表，代为处理在乐自由平台上的下单、付款及相关业务事宜。本声明须加盖企业公章。";
import { ProfileImageUpload } from "@/components/domain/profile-image-upload";
import {
  registerRequest,
  sendCode as sendCodeApi,
} from "@/lib/api-client";
import { DEFAULT_ORG_LOGO_PATH } from "@/lib/default-profile-images";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";

export default function EnterpriseOnboardingPage() {
  const router = useRouter();
  const push = useSessionStore((s) => s.pushNotification);
  const setRole = useRoleStore((s) => s.setRole);

  const [companyName, setCompanyName] = useState("");
  const [logo, setLogo] = useState(DEFAULT_ORG_LOGO_PATH);
  const [creditCode, setCreditCode] = useState("");
  const [legalRep, setLegalRep] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [scope, setScope] = useState("");
  const [licenseUploaded, setLicenseUploaded] = useState(false);
  const [idCardFrontUploaded, setIdCardFrontUploaded] = useState(false);
  const [idCardBackUploaded, setIdCardBackUploaded] = useState(false);
  const [authorizationUploaded, setAuthorizationUploaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (codeSeconds <= 0) return;
    const t = setTimeout(() => setCodeSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [codeSeconds]);

  const normalizedPhone = contactPhone.replace(/\s/g, "");

  const sendSmsCode = async () => {
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      push({ title: "请输入正确的联系人手机号", variant: "destructive" });
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

  const handleSubmit = async () => {
    if (!companyName.trim() || !creditCode.trim() || !contactName.trim()) {
      push({ title: "请填写企业全称、信用代码与联系人", variant: "destructive" });
      return;
    }
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      push({ title: "请输入正确的联系人手机号", variant: "destructive" });
      return;
    }
    if (!smsCode.trim()) {
      push({ title: "请输入短信验证码", variant: "destructive" });
      return;
    }
    if (!idCardFrontUploaded || !idCardBackUploaded) {
      push({ title: "请上传联系人身份证正反面", variant: "destructive" });
      return;
    }
    if (!authorizationUploaded) {
      push({ title: "请上传加盖企业公章的委托声明", variant: "destructive" });
      return;
    }
    if (!licenseUploaded) {
      push({ title: "请上传营业执照", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerRequest({
        phone: normalizedPhone,
        code: smsCode.trim(),
        kind: "client",
        clientType: "enterprise",
        name: contactName.trim(),
        companyName: companyName.trim(),
        avatar: logo,
      });
      setRole(res.role, res.identityId);
      push({
        title: "注册成功 · 企业委托人",
        description:
          "已自动登录。企业资料审核通过前，暂不可发布常规委托与悬赏委托。",
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
        href="/login?register=1&kind=client_enterprise"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回入驻页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <Card className="p-8">
          <div className="flex items-center gap-2">
            <Badge variant="brand" className="gap-1">
              <Building2 className="h-3 w-3" /> 企业委托人认证
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            企业认证 · 信息填写
          </h1>
          <p className="mt-1 text-sm text-ink-60">
            注册后可登录工作台；资料审核通过并获得{" "}
            <Badge variant="brand">企业认证</Badge> 后，方可发布委托项目。
          </p>

          <div className="mt-7 space-y-6">
            <div>
              <Label>企业全称 *</Label>
              <Input
                placeholder="例如:禹生文旅产业(深圳)有限公司"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-2"
              />
            </div>

            <ProfileImageUpload kind="logo" value={logo} onChange={setLogo} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>统一社会信用代码 *</Label>
                <Input
                  placeholder="18 位"
                  value={creditCode}
                  onChange={(e) => setCreditCode(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>法定代表人</Label>
                <Input
                  value={legalRep}
                  onChange={(e) => setLegalRep(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>联系人 *</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>联系人手机 *</Label>
                <Input
                  placeholder="11 位手机号"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>短信验证码 *</Label>
              <div className="mt-2 flex gap-2">
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
            </div>

            <div>
              <Label>主营经营范围</Label>
              <Textarea
                rows={3}
                placeholder="如:房地产开发、文旅项目投资..."
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="space-y-4 rounded-xl border border-ink-20 bg-ink-20/20 p-4">
              <div>
                <Label>联系人身份证 *</Label>
                <p className="mt-1 text-xs text-ink-40">
                  请上传与联系人姓名一致的身份证正反面清晰照片。
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DocumentUploadSlot
                  label="身份证人像面"
                  uploaded={idCardFrontUploaded}
                  fileName="联系人身份证_正面.jpg"
                  icon={IdCard}
                  emptyHint="上传身份证正面"
                  onUpload={() => {
                    setIdCardFrontUploaded(true);
                    push({ title: "身份证正面已上传", variant: "success" });
                  }}
                  onRemove={() => setIdCardFrontUploaded(false)}
                />
                <DocumentUploadSlot
                  label="身份证国徽面"
                  uploaded={idCardBackUploaded}
                  fileName="联系人身份证_反面.jpg"
                  icon={IdCard}
                  emptyHint="上传身份证反面"
                  onUpload={() => {
                    setIdCardBackUploaded(true);
                    push({ title: "身份证反面已上传", variant: "success" });
                  }}
                  onRemove={() => setIdCardBackUploaded(false)}
                />
              </div>
            </div>

            <div>
              <Label>委托声明（加盖企业公章）*</Label>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-60">
                {AUTHORIZATION_STATEMENT_HINT}
              </p>
              <DocumentUploadSlot
                className="mt-3"
                label="委托声明扫描件"
                uploaded={authorizationUploaded}
                fileName="企业委托声明_加盖公章.jpg"
                icon={Stamp}
                emptyHint="上传加盖公章的委托声明图片"
                onUpload={() => {
                  setAuthorizationUploaded(true);
                  push({
                    title: "委托声明已上传",
                    description: "请确保公章清晰可辨，将进入人工审核。",
                    variant: "success",
                  });
                }}
                onRemove={() => setAuthorizationUploaded(false)}
              />
            </div>

            <div>
              <Label>营业执照（扫描件 / 高清照片）*</Label>
              <DocumentUploadSlot
                className="mt-3"
                label="营业执照"
                uploaded={licenseUploaded}
                fileName="营业执照_2026.pdf"
                icon={FileSignature}
                emptyHint="点击上传营业执照"
                onUpload={() => {
                  setLicenseUploaded(true);
                  push({
                    title: "营业执照上传成功",
                    description: "已通过 OCR 自动识别，信息将进入人工审核。",
                    variant: "success",
                  });
                }}
                onRemove={() => setLicenseUploaded(false)}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2 border-t border-ink-20 pt-6">
            <Button variant="ghost" onClick={() => router.back()}>
              取消
            </Button>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={submitting}
            >
              完成注册并登录
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-semibold text-ink">企业认证说明</h3>
            </div>
            <ul className="space-y-2 text-sm text-ink-60">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                注册成功后可立即登录工作台
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-600" />
                审核通过前不可发布常规/悬赏委托
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                审核通过后显示企业认证标识
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                可申请增值税专用发票与对公转账
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-ink-40" />
                需上传联系人身份证、加盖公章的委托声明及营业执照
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DocumentUploadSlot({
  label,
  uploaded,
  fileName,
  icon: Icon,
  emptyHint,
  onUpload,
  onRemove,
  className,
}: {
  label: string;
  uploaded: boolean;
  fileName: string;
  icon: typeof Upload;
  emptyHint: string;
  onUpload: () => void;
  onRemove: () => void;
  className?: string;
}) {
  if (uploaded) {
    return (
      <div
        className={`flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className ?? ""}`}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-sm font-medium text-emerald-900">{fileName}</div>
            <div className="mt-0.5 text-xs text-emerald-700">
              已上传 · 等待审核
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-emerald-700 hover:text-emerald-900"
          aria-label={`移除${label}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onUpload}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-20 bg-ink-20/20 p-8 text-ink-60 hover:border-ink/40 hover:text-ink ${className ?? ""}`}
    >
      <Upload className="h-6 w-6" />
      <div className="text-sm font-medium">{emptyHint}</div>
      <div className="text-xs text-ink-40">支持 JPG / PNG / PDF · 单文件不超过 10MB</div>
    </button>
  );
}
