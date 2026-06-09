"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plane,
  PencilLine,
  Sparkles,
  Upload,
  CalendarRange,
  Wifi,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPECIALTIES } from "@/lib/constants";
import { getL2Options, getL3Options } from "@/lib/bounty-filters";
import {
  orgL2OptionGroups,
  orgL3OptionGroups,
  pruneOrgL2Keys,
  pruneOrgL3Keys,
} from "@/lib/designer-track-selection";
import {
  BACK_TO_BACK_CONTRACT_NOTE,
  ONLINE_MEETING_TIME_OPTIONS,
  OVERSEAS_COUNTRY_OPTIONS,
  TEAM_SIZE_OPTIONS,
} from "@/lib/designer-service-settings";
import type {
  OnlineMeetingTimeOption,
  Specialty,
  SubjectType,
  TeamSizeOption,
} from "@/lib/types";

const SUBJECT_ONBOARDING_LABEL: Record<SubjectType, string> = {
  individual: "个人设计师",
  team: "设计团队",
  company: "设计公司",
};
import { BusinessLicenseUploadSection } from "@/components/domain/business-license-upload-section";
import { CompanyQualificationSelector } from "@/components/domain/company-qualification-selector";
import { ProfileImageUpload } from "@/components/domain/profile-image-upload";
import { qualificationsFromKeys } from "@/lib/company-qualifications";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import {
  registerRequest,
  sendCode as sendCodeApi,
  verifyCodeRequest,
} from "@/lib/api-client";
import {
  DEFAULT_ORG_LOGO_PATH,
  defaultAvatarForGender,
} from "@/lib/default-profile-images";
import {
  AdministrativeRegionSelector,
  AREA_ROOTS,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/components/domain/administrative-region-selector";

function getOnboardingLocationDefault(): AdministrativeTriple {
  const shanghai = AREA_ROOTS.find((p) => p.text.includes("上海"));
  if (!shanghai?.children[0]) return getDefaultAdministrativeTriple();
  const city = shanghai.children[0];
  const district =
    city.children.find((c) => c.text === "徐汇区") ?? city.children[0];
  return {
    provinceCode: shanghai.value,
    cityCode: city.value,
    countyCode: district?.value ?? null,
  };
}

const CURRENT_YEAR = new Date().getFullYear();
const FOUNDING_YEARS = Array.from(
  { length: CURRENT_YEAR - 1979 },
  (_, i) => CURRENT_YEAR - i,
);

const STEPS = [
  { id: "basic", title: "基础信息", desc: "姓名 / 联系方式 / 所在地" },
  { id: "specialty", title: "专业方向", desc: "选择一 / 二 / 三级专业" },
  { id: "service", title: "服务设置", desc: "服务模式 / 接单偏好" },
  { id: "calendar", title: "档期 & 提交", desc: "可接单时间 + 提交审核" },
];

export default function DesignerOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">加载中...</div>
      }
    >
      <DesignerOnboardingInner />
    </Suspense>
  );
}

function DesignerOnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const subjectParam = params.get("subject");
  const subjectType: SubjectType =
    subjectParam === "team" || subjectParam === "company" ? subjectParam : "individual";
  const subjectLabel = SUBJECT_ONBOARDING_LABEL[subjectType];
  const registerKindBack =
    subjectType === "team"
      ? "designer_team"
      : subjectType === "company"
        ? "designer_company"
        : "designer_individual";
  const push = useSessionStore((s) => s.pushNotification);
  const setRole = useRoleStore((s) => s.setRole);
  const usesOrgLogo = subjectType === "team" || subjectType === "company";
  const allowsMultiTrack = usesOrgLogo;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [businessScope, setBusinessScope] = useState("");
  const [licenseUploaded, setLicenseUploaded] = useState(false);
  const [foundedYear, setFoundedYear] = useState<number | "">("");
  const [teamSize, setTeamSize] = useState<TeamSizeOption | "">("");
  const [locationScope, setLocationScope] = useState<"domestic" | "overseas">(
    "domestic",
  );
  const [overseasCountry, setOverseasCountry] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [profileImage, setProfileImage] = useState(() =>
    usesOrgLogo ? DEFAULT_ORG_LOGO_PATH : defaultAvatarForGender("male"),
  );
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [locationTriple, setLocationTriple] = useState<AdministrativeTriple>(
    getOnboardingLocationDefault,
  );
  const [years, setYears] = useState(5);
  const [inJob, setInJob] = useState(true);

  const [trackL1, setTrackL1] = useState<Specialty>("landscape");
  const [trackL2, setTrackL2] = useState(
    () => getL2Options("landscape")[0]?.value ?? "",
  );
  const [trackL3, setTrackL3] = useState(() => {
    const l2 = getL2Options("landscape")[0]?.value ?? "";
    return getL3Options("landscape", l2)[0]?.value ?? "";
  });
  const [orgL1s, setOrgL1s] = useState<Specialty[]>([]);
  const [orgL2Keys, setOrgL2Keys] = useState<string[]>([]);
  const [orgL3Keys, setOrgL3Keys] = useState<string[]>([]);
  const [companyQualificationKeys, setCompanyQualificationKeys] = useState<
    string[]
  >([]);
  const [companyQualificationNone, setCompanyQualificationNone] =
    useState(false);

  const [supportTravel, setSupportTravel] = useState(true);
  const [supportHand, setSupportHand] = useState(true);
  const [serviceModes, setServiceModes] = useState<("online" | "onsite")[]>([
    "online",
  ]);
  const [onlineMeetingTime, setOnlineMeetingTime] =
    useState<OnlineMeetingTimeOption>("work_hours");
  const [acceptBackToBack, setAcceptBackToBack] = useState(false);
  const [hasOverseas, setHasOverseas] = useState(false);
  const [overseasCountries, setOverseasCountries] = useState<string[]>([]);
  const [acceptTimeBilling, setAcceptTimeBilling] = useState(true);
  const [hasOnsiteExp, setHasOnsiteExp] = useState(false);
  const [closeWeekend, setCloseWeekend] = useState(true);
  const [closeHoliday, setCloseHoliday] = useState(true);
  const [allYearOpen, setAllYearOpen] = useState(false);

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
      setPhoneVerified(false);
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

  const verifyPhoneStep = async (): Promise<boolean> => {
    if (!/^1\d{10}$/.test(normalizedPhone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return false;
    }
    if (phoneVerified) return true;
    if (!smsCode.trim()) {
      push({ title: "请输入短信验证码", variant: "destructive" });
      return false;
    }
    setVerifying(true);
    try {
      await verifyCodeRequest({
        phone: normalizedPhone,
        code: smsCode.trim(),
        purpose: "register",
      });
      setPhoneVerified(true);
      return true;
    } catch (e) {
      push({
        title: "验证码错误或已过期",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const resolveOrgLocationLabel = () => {
    if (locationScope === "overseas") return overseasCountry.trim();
    return resolveDomesticProvinceCity(locationTriple);
  };

  const validateTeamBasicStep = async (): Promise<boolean> => {
    if (!teamName.trim()) {
      push({ title: "请输入团队名称", variant: "destructive" });
      return false;
    }
    if (!foundedYear) {
      push({ title: "请选择创建年份", variant: "destructive" });
      return false;
    }
    if (!name.trim()) {
      push({ title: "请输入联系人真实姓名", variant: "destructive" });
      return false;
    }
    if (locationScope === "domestic") {
      if (!locationTriple.provinceCode || !locationTriple.cityCode) {
        push({ title: "请选择国内所在省市", variant: "destructive" });
        return false;
      }
    } else if (!overseasCountry.trim()) {
      push({ title: "请选择国外所在国家/地区", variant: "destructive" });
      return false;
    }
    if (!teamSize) {
      push({ title: "请选择团队规模", variant: "destructive" });
      return false;
    }
    return verifyPhoneStep();
  };

  const validateIndividualBasicStep = async (): Promise<boolean> => {
    if (!name.trim()) {
      push({ title: "请输入真实姓名", variant: "destructive" });
      return false;
    }
    if (!gender) {
      push({ title: "请选择性别", variant: "destructive" });
      return false;
    }
    return verifyPhoneStep();
  };

  const validateCompanyBasicStep = async (): Promise<boolean> => {
    if (!licenseUploaded) {
      push({ title: "请上传营业执照", variant: "destructive" });
      return false;
    }
    if (!companyName.trim()) {
      push({ title: "请填写公司名称", variant: "destructive" });
      return false;
    }
    if (!creditCode.trim()) {
      push({ title: "请填写统一社会信用代码", variant: "destructive" });
      return false;
    }
    if (!foundedYear) {
      push({ title: "请填写创立时间", variant: "destructive" });
      return false;
    }
    if (!businessScope.trim()) {
      push({ title: "请填写营业范围", variant: "destructive" });
      return false;
    }
    if (!name.trim()) {
      push({ title: "请输入联系人真实姓名", variant: "destructive" });
      return false;
    }
    if (locationScope === "domestic") {
      if (!locationTriple.provinceCode || !locationTriple.cityCode) {
        push({ title: "请选择国内所在省市", variant: "destructive" });
        return false;
      }
    } else if (!overseasCountry.trim()) {
      push({ title: "请选择国外所在国家/地区", variant: "destructive" });
      return false;
    }
    if (!teamSize) {
      push({ title: "请选择公司规模", variant: "destructive" });
      return false;
    }
    return verifyPhoneStep();
  };

  const validateBasicStep = async (): Promise<boolean> => {
    if (subjectType === "team") return validateTeamBasicStep();
    if (subjectType === "company") return validateCompanyBasicStep();
    return validateIndividualBasicStep();
  };

  const validateSpecialtyStep = (): boolean => {
    if (allowsMultiTrack) {
      if (orgL1s.length === 0) {
        push({ title: "请至少选择一项一级专业", variant: "destructive" });
        return false;
      }
      if (orgL2Keys.length === 0) {
        push({ title: "请至少选择一项二级专业", variant: "destructive" });
        return false;
      }
      if (orgL3Keys.length === 0) {
        push({ title: "请至少选择一项三级专业", variant: "destructive" });
        return false;
      }
      if (
        subjectType === "company" &&
        !companyQualificationNone &&
        companyQualificationKeys.length === 0
      ) {
        push({
          title: "请选择公司资质",
          description: "须选择「无资质」或至少一项设计资质。",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }
    if (!trackL1) {
      push({ title: "请选择一级专业", variant: "destructive" });
      return false;
    }
    if (!trackL2) {
      push({ title: "请选择二级专业", variant: "destructive" });
      return false;
    }
    if (!trackL3) {
      push({ title: "请选择三级专业", variant: "destructive" });
      return false;
    }
    return true;
  };

  const toggleOrgL1 = (l1: Specialty) => {
    setOrgL1s((prev) => {
      const next = prev.includes(l1)
        ? prev.filter((x) => x !== l1)
        : [...prev, l1];
      setOrgL2Keys((l2s) => {
        const prunedL2 = pruneOrgL2Keys(l2s, next);
        setOrgL3Keys((l3s) => pruneOrgL3Keys(l3s, prunedL2));
        return prunedL2;
      });
      return next;
    });
  };

  const toggleOrgL2 = (key: string) => {
    setOrgL2Keys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((x) => x !== key)
        : [...prev, key];
      setOrgL3Keys((l3s) => pruneOrgL3Keys(l3s, next));
      return next;
    });
  };

  const toggleOrgL3 = (key: string) => {
    setOrgL3Keys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const onTrackL1Change = (l1: Specialty) => {
    setTrackL1(l1);
    const l2 = getL2Options(l1)[0]?.value ?? "";
    setTrackL2(l2);
    setTrackL3(getL3Options(l1, l2)[0]?.value ?? "");
  };

  const onTrackL2Change = (l2: string) => {
    setTrackL2(l2);
    setTrackL3(getL3Options(trackL1, l2)[0]?.value ?? "");
  };

  const validateServiceStep = (): boolean => {
    if (hasOverseas && overseasCountries.length === 0) {
      push({ title: "请选择境外项目所在国家/地区", variant: "destructive" });
      return false;
    }
    return true;
  };

  const toggleOverseasCountry = (country: string) => {
    setOverseasCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country],
    );
  };

  const handleNextStep = async () => {
    if (step === 0) {
      const ok = await validateBasicStep();
      if (!ok) return;
    }
    if (step === 1 && !validateSpecialtyStep()) return;
    if (step === 2 && !validateServiceStep()) return;
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!phoneVerified) {
      push({ title: "请先完成手机号验证", variant: "destructive" });
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      const locationLabel =
        subjectType === "team" || subjectType === "company"
          ? resolveOrgLocationLabel()
          : resolveAdministrativeTriple(locationTriple)?.fullLabel ?? "";
      const res = await registerRequest({
        phone: normalizedPhone,
        code: smsCode.trim(),
        kind: registerKindBack,
        name:
          subjectType === "team"
            ? teamName.trim()
            : subjectType === "company"
              ? companyName.trim()
              : name.trim(),
        teamName: subjectType === "team" ? teamName.trim() : undefined,
        companyName:
          subjectType === "company" ? companyName.trim() : undefined,
        contactName:
          subjectType === "team" || subjectType === "company"
            ? name.trim()
            : undefined,
        avatar: profileImage,
        gender: subjectType === "individual" ? gender || undefined : undefined,
        location: locationLabel || undefined,
        foundedYear:
          (subjectType === "team" || subjectType === "company") && foundedYear
            ? Number(foundedYear)
            : undefined,
        teamSize:
          (subjectType === "team" || subjectType === "company") && teamSize
            ? teamSize
            : undefined,
        locationScope:
          subjectType === "team" || subjectType === "company"
            ? locationScope
            : undefined,
        overseasCountry:
          (subjectType === "team" || subjectType === "company") &&
          locationScope === "overseas"
            ? overseasCountry.trim()
            : undefined,
        creditCode:
          subjectType === "company" ? creditCode.trim() : undefined,
        businessScope:
          subjectType === "company" ? businessScope.trim() : undefined,
        companyQualificationNone:
          subjectType === "company" ? companyQualificationNone : undefined,
        companyQualifications:
          subjectType === "company" && companyQualificationKeys.length > 0
            ? qualificationsFromKeys(companyQualificationKeys)
            : undefined,
      });
      setRole(res.role, res.identityId);
      push({
        title: "入驻申请已提交",
        description:
          "平台将在 1 个工作日内反馈审核结果。审核通过后即可上线接单。",
        variant: "success",
      });
      router.push("/designer");
    } catch (e) {
      push({
        title: "提交失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const l2Options = getL2Options(trackL1);
  const l3Options = getL3Options(trackL1, trackL2);
  const orgL2Groups = useMemo(() => orgL2OptionGroups(orgL1s), [orgL1s]);
  const orgL3Groups = useMemo(
    () => orgL3OptionGroups(orgL2Keys),
    [orgL2Keys],
  );

  const handleAllYearOpenChange = (open: boolean) => {
    setAllYearOpen(open);
    if (open) {
      setCloseWeekend(false);
      setCloseHoliday(false);
    }
  };

  const handleCloseWeekendChange = (closed: boolean) => {
    if (closed) setAllYearOpen(false);
    setCloseWeekend(closed);
  };

  const handleCloseHolidayChange = (closed: boolean) => {
    if (closed) setAllYearOpen(false);
    setCloseHoliday(closed);
  };

  const basicStepDesc =
    subjectType === "team"
      ? "团队名称 / Logo / 联系人"
      : subjectType === "company"
        ? "营业执照 / Logo / 联系人"
        : "姓名 / 联系方式 / 所在地";

  const specialtyStepDesc =
    subjectType === "company"
      ? "专业方向 + 公司资质"
      : "选择一 / 二 / 三级专业";

  const toggleServiceMode = (m: "online" | "onsite") => {
    setServiceModes(
      serviceModes.includes(m)
        ? serviceModes.filter((x) => x !== m)
        : [...serviceModes, m],
    );
  };

  return (
    <div className="container-page py-10">
      <Link
        href={`/login?register=1&kind=${registerKindBack}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回入驻页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-5 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold text-ink">{subjectLabel}入驻向导</h3>
          </div>
          <Badge variant="muted" className="mb-3 w-fit text-[10px]">
            主体类型：{subjectLabel}
          </Badge>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl p-3",
                  i === step
                    ? "bg-ink text-white"
                    : i < step
                      ? "bg-ink-20/40 text-ink"
                      : "text-ink-60",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i === step
                      ? "bg-white text-ink"
                      : i < step
                        ? "bg-emerald-500 text-white"
                        : "border border-ink-20 bg-white text-ink-60",
                  )}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <div
                    className={cn(
                      "text-xs",
                      i === step ? "text-white/70" : "text-ink-40",
                    )}
                  >
                    {s.id === "basic"
                      ? basicStepDesc
                      : s.id === "specialty"
                        ? specialtyStepDesc
                        : s.desc}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-8">
          {/* Step 1: 基础信息 */}
          {step === 0 && subjectType === "team" ? (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">第 1 步 · 基础信息</h2>
              <p className="text-sm text-ink-60">
                填写设计团队对外展示信息与联系人资料，平台将与官方资质核验。
              </p>

              <div className="space-y-2">
                <Label>团队名称 *</Label>
                <Input
                  placeholder="请输入团队对外展示名称"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <ProfileImageUpload
                kind="logo"
                value={profileImage}
                onChange={setProfileImage}
              />

              <div className="space-y-2">
                <Label>创建年份 *</Label>
                <select
                  value={foundedYear}
                  onChange={(e) =>
                    setFoundedYear(e.target.value ? Number(e.target.value) : "")
                  }
                  className="h-11 w-full max-w-xs rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
                >
                  <option value="">请选择年份</option>
                  {FOUNDING_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>联系人 *</Label>
                <Input
                  placeholder="请输入联系人真实姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-ink-40">须与身份证一致的联系人姓名。</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    联系人手机号码 *
                    {phoneVerified ? (
                      <Badge variant="emerald" className="text-[10px]">
                        已验证
                      </Badge>
                    ) : null}
                  </Label>
                  <Input
                    placeholder="11 位手机号"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneVerified(false);
                      setSmsCode("");
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>短信验证码 *</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="6 位数字"
                      value={smsCode}
                      onChange={(e) => {
                        setSmsCode(e.target.value);
                        setPhoneVerified(false);
                      }}
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
                  <p className="mt-1.5 text-xs text-ink-40">
                    验证码将发送至上述手机号；注册后可在账号设置中修改联系人手机。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>所在地区 *</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "domestic" as const, label: "中国国内" },
                      { value: "overseas" as const, label: "国外" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocationScope(opt.value)}
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                        locationScope === opt.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {locationScope === "domestic" ? (
                  <DomesticProvinceCitySelector
                    triple={locationTriple}
                    onTripleChange={setLocationTriple}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-ink-40">国家 / 地区</span>
                    <select
                      value={overseasCountry}
                      onChange={(e) => setOverseasCountry(e.target.value)}
                      className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
                    >
                      <option value="">请选择国家 / 地区</option>
                      {OVERSEAS_COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>团队规模 *</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TEAM_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTeamSize(opt.value)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        teamSize === opt.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 0 && subjectType === "company" ? (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">第 1 步 · 基础信息</h2>
              <p className="text-sm text-ink-60">
                上传营业执照自动识别企业信息，填写联系人与公司规模，平台将与官方资质核验。
              </p>

              <BusinessLicenseUploadSection
                uploaded={licenseUploaded}
                companyName={companyName}
                creditCode={creditCode}
                foundedYear={foundedYear}
                businessScope={businessScope}
                onUploadedChange={setLicenseUploaded}
                onCompanyNameChange={setCompanyName}
                onCreditCodeChange={setCreditCode}
                onFoundedYearChange={setFoundedYear}
                onBusinessScopeChange={setBusinessScope}
                onRecognized={() =>
                  push({
                    title: "营业执照识别成功",
                    description: "已自动填充企业信息，请核对后提交。",
                    variant: "success",
                  })
                }
              />

              <ProfileImageUpload
                kind="logo"
                value={profileImage}
                onChange={setProfileImage}
              />

              <div className="space-y-2">
                <Label>联系人 *</Label>
                <Input
                  placeholder="请输入联系人真实姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-ink-40">须与身份证一致的联系人姓名。</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    联系人手机号码 *
                    {phoneVerified ? (
                      <Badge variant="emerald" className="text-[10px]">
                        已验证
                      </Badge>
                    ) : null}
                  </Label>
                  <Input
                    placeholder="11 位手机号"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneVerified(false);
                      setSmsCode("");
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>短信验证码 *</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="6 位数字"
                      value={smsCode}
                      onChange={(e) => {
                        setSmsCode(e.target.value);
                        setPhoneVerified(false);
                      }}
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
                  <p className="mt-1.5 text-xs text-ink-40">
                    验证码将发送至上述手机号；注册后可在账号设置中修改联系人手机。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>所在地区 *</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "domestic" as const, label: "中国国内" },
                      { value: "overseas" as const, label: "国外" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocationScope(opt.value)}
                      className={cn(
                        "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                        locationScope === opt.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {locationScope === "domestic" ? (
                  <DomesticProvinceCitySelector
                    triple={locationTriple}
                    onTripleChange={setLocationTriple}
                  />
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-ink-40">国家 / 地区</span>
                    <select
                      value={overseasCountry}
                      onChange={(e) => setOverseasCountry(e.target.value)}
                      className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
                    >
                      <option value="">请选择国家 / 地区</option>
                      {OVERSEAS_COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>公司规模 *</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TEAM_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTeamSize(opt.value)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        teamSize === opt.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 0 && subjectType === "individual" ? (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">第 1 步 · 基础信息</h2>
              <p className="text-sm text-ink-60">
                填写你的实名信息和联系方式,平台将与官方资质核验。
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>真实姓名 *</Label>
                  <Input
                    placeholder="请输入与身份证一致的姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>性别 *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                <div className="md:col-span-2">
                  <ProfileImageUpload
                    kind="avatar"
                    value={profileImage}
                    onChange={setProfileImage}
                    gender={gender}
                  />
                </div>
                <div className="space-y-4 md:col-span-2">
                  <div>
                    <Label className="flex items-center gap-2">
                      手机号 *
                      {phoneVerified ? (
                        <Badge variant="emerald" className="text-[10px]">
                          已验证
                        </Badge>
                      ) : null}
                    </Label>
                    <Input
                      placeholder="11 位手机号"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setPhoneVerified(false);
                        setSmsCode("");
                      }}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>短信验证码 *</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="6 位数字"
                        value={smsCode}
                        onChange={(e) => {
                          setSmsCode(e.target.value);
                          setPhoneVerified(false);
                        }}
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
                    <p className="mt-1.5 text-xs text-ink-40">
                      验证码将发送至上述手机号，用于确认联系方式真实有效
                    </p>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>所在地</Label>
                  <div className="mt-2">
                    <AdministrativeRegionSelector
                      triple={locationTriple}
                      onTripleChange={setLocationTriple}
                    />
                  </div>
                </div>
                <div>
                  <Label>从业年限</Label>
                  <Input
                    type="number"
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value || 0))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>在职状态</Label>
                  <div className="mt-2 flex h-11 items-center justify-between rounded-xl border border-ink-20 px-4">
                    <span className="text-sm text-ink">
                      {inJob ? "在职 · 兼职接单" : "自由职业 · 全职接单"}
                    </span>
                    <Switch checked={inJob} onCheckedChange={setInJob} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Step 2: 专业方向 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">第 2 步 · 专业方向</h2>
              <p className="text-sm text-ink-60">
                {subjectType === "company"
                  ? "可多选一级、二级与三级专业，并申报公司设计资质（必选：「无资质」或至少一项资质）。擅长的项目类型将在审核通过后，于主页上传对应案例时确认。"
                  : allowsMultiTrack
                    ? "设计团队可多选一级、二级与三级专业，覆盖团队实际承接范围。擅长的项目类型将在审核通过后，于主页上传对应案例时确认。"
                    : "选择你申请入驻的一级、二级与三级专业。擅长的项目类型将在审核通过后，于个人主页上传对应案例时确认。"}
              </p>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label>一级专业 *</Label>
                  {allowsMultiTrack && orgL1s.length > 0 ? (
                    <Badge variant="muted" className="text-[10px]">
                      已选 {orgL1s.length} 项
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {SPECIALTIES.map((s) => {
                    const selected = allowsMultiTrack
                      ? orgL1s.includes(s.value)
                      : trackL1 === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          allowsMultiTrack
                            ? toggleOrgL1(s.value)
                            : onTrackL1Change(s.value)
                        }
                        className={cn(
                          "rounded-xl border p-4 text-left transition-all",
                          selected
                            ? "border-ink bg-ink-20/30 shadow-sm"
                            : "border-ink-20 hover:border-ink/40",
                        )}
                      >
                        <div className="text-sm font-semibold text-ink">{s.label}</div>
                        <div className="mt-1 text-xs text-ink-60">{s.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label>二级专业 *</Label>
                  {allowsMultiTrack && orgL2Keys.length > 0 ? (
                    <Badge variant="muted" className="text-[10px]">
                      已选 {orgL2Keys.length} 项
                    </Badge>
                  ) : null}
                </div>
                {allowsMultiTrack && orgL1s.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-40">请先选择一级专业。</p>
                ) : allowsMultiTrack ? (
                  <div className="mt-3 space-y-3">
                    {orgL2Groups.map((group) => (
                      <div
                        key={group.l1}
                        className="rounded-xl border border-ink-20 bg-ink-20/15 p-4"
                      >
                        <div className="mb-2.5 text-xs font-semibold text-ink">
                          {group.groupLabel}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleOrgL2(opt.key)}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                                orgL2Keys.includes(opt.key)
                                  ? "border-ink bg-ink text-white"
                                  : "border-ink-20 text-ink-60 hover:border-ink/40",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {l2Options.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => onTrackL2Change(s.value)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                          trackL2 === s.value
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60 hover:border-ink/40",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label>三级专业 *</Label>
                  {allowsMultiTrack && orgL3Keys.length > 0 ? (
                    <Badge variant="muted" className="text-[10px]">
                      已选 {orgL3Keys.length} 项
                    </Badge>
                  ) : null}
                </div>
                {allowsMultiTrack && orgL2Keys.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-40">请先选择二级专业。</p>
                ) : allowsMultiTrack ? (
                  <div className="mt-3 space-y-3">
                    {orgL3Groups.map((group) => (
                      <div
                        key={group.l2Key}
                        className="rounded-xl border border-ink-20 bg-ink-20/15 p-4"
                      >
                        <div className="mb-2.5 text-xs font-semibold text-ink">
                          {group.groupLabel}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleOrgL3(opt.key)}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                                orgL3Keys.includes(opt.key)
                                  ? "border-ink bg-ink text-white"
                                  : "border-ink-20 text-ink-60 hover:border-ink/40",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {group.options
                          .filter((o) => orgL3Keys.includes(o.key) && o.description)
                          .map((o) => (
                            <p key={o.key} className="mt-2 text-xs text-ink-40">
                              <span className="font-medium text-ink-60">
                                {o.label}：
                              </span>
                              {o.description}
                            </p>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {l3Options.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setTrackL3(s.value)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                          trackL3 === s.value
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60 hover:border-ink/40",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                {!allowsMultiTrack && l3Options.find((x) => x.value === trackL3)?.description ? (
                  <p className="mt-2 text-xs text-ink-40">
                    {l3Options.find((x) => x.value === trackL3)?.description}
                  </p>
                ) : null}
              </div>

              {subjectType === "company" ? (
                <CompanyQualificationSelector
                  selectedKeys={companyQualificationKeys}
                  noQualification={companyQualificationNone}
                  onSelectedKeysChange={setCompanyQualificationKeys}
                  onNoQualificationChange={setCompanyQualificationNone}
                />
              ) : null}
            </div>
          )}

          {/* Step 3: 服务设置 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">第 3 步 · 服务设置</h2>
              <p className="text-sm text-ink-60">
                设置服务范围、是否支持出差/接改图单等。计费单价可在审核通过后于工作台维护。
              </p>

              <div>
                <Label>接单范围(可多选)</Label>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <button
                    onClick={() => toggleServiceMode("online")}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                      serviceModes.includes("online")
                        ? "border-ink bg-ink-20/30"
                        : "border-ink-20 hover:border-ink/40",
                    )}
                  >
                    <Wifi className="h-5 w-5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">纯线上接单</div>
                      <div className="text-xs text-ink-60">
                        远程沟通,在线交付文件
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleServiceMode("onsite")}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                      serviceModes.includes("onsite")
                        ? "border-ink bg-ink-20/30"
                        : "border-ink-20 hover:border-ink/40",
                    )}
                  >
                    <CalendarRange className="h-5 w-5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">线下上门服务</div>
                      <div className="text-xs text-ink-60">
                        现场踏勘 + 落地对接
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-ink-20 p-4">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-ink-60" />
                    <span className="text-sm text-ink">支持出差</span>
                  </div>
                  <Switch checked={supportTravel} onCheckedChange={setSupportTravel} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-ink-20 p-4">
                  <div className="flex items-center gap-2">
                    <PencilLine className="h-4 w-4 text-ink-60" />
                    <span className="text-sm text-ink">接改图单</span>
                  </div>
                  <Switch checked={supportHand} onCheckedChange={setSupportHand} />
                </div>
              </div>

              <div>
                <Label>线上会议时间</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ONLINE_MEETING_TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOnlineMeetingTime(opt.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        onlineMeetingTime === opt.value
                          ? "border-ink bg-ink-20/30 font-medium text-ink"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <YesNoField
                  label="是否接受背靠背合同"
                  value={acceptBackToBack}
                  onChange={setAcceptBackToBack}
                />
                <p className="text-[11px] leading-relaxed text-ink-60">
                  {BACK_TO_BACK_CONTRACT_NOTE}
                </p>
              </div>

              <div className="space-y-3">
                <YesNoField
                  label="是否做过境外项目"
                  value={hasOverseas}
                  onChange={(v) => {
                    setHasOverseas(v);
                    if (!v) setOverseasCountries([]);
                  }}
                />
                {hasOverseas ? (
                  <div className="ml-1 space-y-2 border-l-2 border-ink-20 pl-4">
                    <Label className="text-xs text-ink-60">
                      国家 / 地区（可多选）
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {OVERSEAS_COUNTRY_OPTIONS.map((country) => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => toggleOverseasCountry(country)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            overseasCountries.includes(country)
                              ? "border-ink bg-ink text-white"
                              : "border-ink-20 text-ink-60 hover:border-ink/40",
                          )}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <YesNoField
                label="是否接受按时间计费"
                value={acceptTimeBilling}
                onChange={setAcceptTimeBilling}
              />

              <YesNoField
                label="是否有现场服务经验"
                value={hasOnsiteExp}
                onChange={setHasOnsiteExp}
              />
            </div>
          )}

          {/* Step 4: 档期 + 提交 */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-ink">
                第 4 步 · 档期设置与提交审核
              </h2>
              <p className="text-sm text-ink-60">
                设置可接单时间,提交后由平台审核,通常 1 个工作日内反馈。作品案例请在审核通过后于个人主页上传。
              </p>

              <Card className="space-y-4 p-5">
                <h3 className="text-sm font-semibold text-ink">档期偏好</h3>
                <ToggleRow
                  label="关闭周末档期"
                  checked={closeWeekend}
                  disabled={allYearOpen}
                  onChange={handleCloseWeekendChange}
                />
                <ToggleRow
                  label="关闭法定节假日档期"
                  checked={closeHoliday}
                  disabled={allYearOpen}
                  onChange={handleCloseHolidayChange}
                />
                <ToggleRow
                  label="全年全时段开放接单"
                  checked={allYearOpen}
                  onChange={handleAllYearOpenChange}
                />
                {allYearOpen ? (
                  <p className="text-xs text-ink-40">
                    已开启全年全时段接单，周末与法定节假日档期将自动开放（不可同时关闭）。
                  </p>
                ) : null}
              </Card>

              <Card className="space-y-3 bg-ink-20/30 p-5 text-sm text-ink-60">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="font-medium text-ink">审核流程说明</div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs">
                      <li>系统自动核验姓名 / 身份证 / 手机号实名</li>
                      <li>人工抽查专业资质；作品案例在审核通过后补充上传</li>
                      <li>审核通过后账号正式上线,在线状态默认开启</li>
                      <li>审核结果将通过短信和站内消息通知</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-2 border-t border-ink-20 pt-6">
            <div className="text-xs text-ink-40">
              第 {step + 1} 步 / 共 {STEPS.length} 步
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="h-4 w-4" /> 上一步
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  variant="brand"
                  onClick={handleNextStep}
                  disabled={verifying}
                >
                  下一步 <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="brand" onClick={handleSubmit} disabled={submitting}>
                  <Upload className="h-4 w-4" /> 提交审核
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function resolveDomesticProvinceCity(triple: AdministrativeTriple): string {
  const province = AREA_ROOTS.find((p) => p.value === triple.provinceCode);
  const city = province?.children.find((c) => c.value === triple.cityCode);
  if (!province || !city) return "";
  return `${province.text} · ${city.text}`;
}

function DomesticProvinceCitySelector({
  triple,
  onTripleChange,
}: {
  triple: AdministrativeTriple;
  onTripleChange: (next: AdministrativeTriple) => void;
}) {
  const provinceNode = AREA_ROOTS.find((p) => p.value === triple.provinceCode);
  const cityOptions = provinceNode?.children ?? [];
  const display = resolveDomesticProvinceCity(triple);

  const onProvincePick = (provinceCode: string) => {
    const province = AREA_ROOTS.find((p) => p.value === provinceCode);
    const city = province?.children[0];
    onTripleChange({
      provinceCode,
      cityCode: city?.value ?? "",
      countyCode: null,
    });
  };

  const onCityPick = (cityCode: string) => {
    onTripleChange({
      provinceCode: triple.provinceCode,
      cityCode,
      countyCode: null,
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] text-ink-40">省 / 直辖市 / 自治区</span>
          <select
            className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
            value={triple.provinceCode}
            onChange={(e) => onProvincePick(e.target.value)}
          >
            <option value="" disabled>
              请选择省份
            </option>
            {AREA_ROOTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.text}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-ink-40">地级市</span>
          <select
            disabled={!triple.provinceCode || cityOptions.length === 0}
            className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink disabled:opacity-50"
            value={triple.cityCode}
            onChange={(e) => onCityPick(e.target.value)}
          >
            <option value="">请选择地级市</option>
            {cityOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.text}
              </option>
            ))}
          </select>
        </label>
      </div>
      {display ? (
        <p className="rounded-xl bg-ink-20/30 px-3 py-2 text-[11px] text-ink-60">
          已选：<span className="font-medium text-ink">{display}</span>
        </p>
      ) : null}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[
          { v: true, label: "是" },
          { v: false, label: "否" },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "min-w-[72px] rounded-full border px-4 py-1.5 text-sm transition-colors",
              value === opt.v
                ? "border-ink bg-ink text-white"
                : "border-ink-20 text-ink-60 hover:border-ink/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        disabled && "opacity-50",
      )}
    >
      <span className="text-ink">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
