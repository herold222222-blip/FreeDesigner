"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { submitFeedbackRequest } from "@/lib/api-client";
import {
  CUSTOMER_SERVICE_CONTACTS,
  CUSTOMER_SERVICE_HOTLINE,
  CUSTOMER_SERVICE_HOTLINE_DISPLAY,
  formatCustomerServiceLine,
} from "@/lib/customer-service";
import { getClientById } from "@/mocks/clients";
import { getDesignerById } from "@/mocks/designers";
import {
  isValidMobilePhone,
  maskPhone,
  useAccountProfileStore,
} from "@/store/account-profile-store";
import { usePlatformContent } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Headphones,
  ImagePlus,
  Info,
  Phone,
  Repeat,
  Smartphone,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ConsoleKind = "client" | "designer";

const DEFAULT_PHONES: Record<string, string> = {
  client_lin: "13812348888",
  designer_chen: "13912348821",
};

interface ConsoleSidebarActionsProps {
  consoleKind: ConsoleKind;
}

export function ConsoleSidebarActions({ consoleKind }: ConsoleSidebarActionsProps) {
  const router = useRouter();
  const identityId = useRoleStore((s) => s.identityId);
  const setRole = useRoleStore((s) => s.setRole);
  const push = useSessionStore((s) => s.pushNotification);
  const getPhone = useAccountProfileStore((s) => s.getPhone);
  const setPhone = useAccountProfileStore((s) => s.setPhone);
  const getLogo = useAccountProfileStore((s) => s.getLogo);
  const setLogo = useAccountProfileStore((s) => s.setLogo);

  const [hydrated, setHydrated] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const [csOpen, setCsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const { data: platformContent, refresh: refreshPlatformContent } =
    usePlatformContent();
  const [phoneDraft, setPhoneDraft] = useState("");
  const [logoDraft, setLogoDraft] = useState("");
  const [csMessage, setCsMessage] = useState("");
  const [csSubmitting, setCsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (aboutOpen) refreshPlatformContent();
  }, [aboutOpen, refreshPlatformContent]);

  const profile = useMemo(() => {
    const id = identityId || (consoleKind === "client" ? "client_lin" : "designer_chen");
    if (consoleKind === "client") {
      const client = getClientById(id);
      if (!client) return null;
      const usesLogo = client.type === "enterprise";
      const fallbackPhone = DEFAULT_PHONES[id] ?? "13800000000";
      const fallbackLogo = client.avatar;
      return {
        identityId: id,
        name: client.name,
        usesLogo,
        profileLabel: usesLogo ? "企业 Logo" : "绑定手机",
        phone: getPhone(id, fallbackPhone),
        logoUrl: getLogo(id, fallbackLogo),
      };
    }
    const designer = getDesignerById(id);
    if (!designer) return null;
    const usesLogo =
      designer.subjectType === "team" || designer.subjectType === "company";
    const fallbackPhone = DEFAULT_PHONES[id] ?? "13900000000";
    const fallbackLogo = designer.avatar;
    return {
      identityId: id,
      name: designer.name,
      usesLogo,
      profileLabel: usesLogo ? "团队 / 公司 Logo" : "绑定手机",
      phone: getPhone(id, fallbackPhone),
      logoUrl: getLogo(id, fallbackLogo),
    };
  }, [consoleKind, identityId, getPhone, getLogo]);

  if (!hydrated || !profile) return null;

  const openPhoneDialog = () => {
    setPhoneDraft(profile.phone);
    setPhoneOpen(true);
  };

  const openLogoDialog = () => {
    setLogoDraft(profile.logoUrl);
    setLogoOpen(true);
  };

  const savePhone = () => {
    const normalized = phoneDraft.replace(/\s/g, "");
    if (!isValidMobilePhone(normalized)) {
      push({
        title: "手机号格式不正确",
        description: "请输入 11 位中国大陆手机号。",
        variant: "destructive",
      });
      return;
    }
    setPhone(profile.identityId, normalized);
    push({
      title: "手机号已更新",
      description: `新号码 ${maskPhone(normalized)} 已保存（演示数据）。`,
      variant: "success",
    });
    setPhoneOpen(false);
  };

  const saveLogo = () => {
    if (!logoDraft.trim()) {
      push({
        title: "请上传或填写 Logo",
        description: "Logo 地址不能为空。",
        variant: "destructive",
      });
      return;
    }
    setLogo(profile.identityId, logoDraft.trim());
    push({
      title: "Logo 已更新",
      description: "主页与侧栏将展示新 Logo（演示数据）。",
      variant: "success",
    });
    setLogoOpen(false);
  };

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push({
        title: "请选择图片文件",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoDraft(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const submitCsMessage = async () => {
    const text = csMessage.trim();
    if (!text) {
      push({
        title: "请填写留言内容",
        variant: "destructive",
      });
      return;
    }
    setCsSubmitting(true);
    try {
      await submitFeedbackRequest({
        message: text,
        userName: profile.name,
        phone: profile.phone,
        identityId: profile.identityId,
      });
      push({
        title: "留言已提交",
        description: "客服将在 1 个工作日内通过站内消息或电话与您联系。",
        variant: "success",
      });
      setCsMessage("");
      setCsOpen(false);
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "提交失败",
        description: "请确认已登录后再试，或直接拨打客服热线。",
        variant: "destructive",
      });
    } finally {
      setCsSubmitting(false);
    }
  };

  const switchTo = (target: "client" | "designer") => {
    setRole(target);
    setRoleOpen(false);
    router.push(target === "client" ? "/client" : "/designer");
  };

  return (
    <>
      <div className="space-y-1 border-t border-ink-20 px-3 py-3">
        <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-40">
          账号与帮助
        </p>

        {profile.usesLogo ? (
          <SidebarActionButton
            icon={ImagePlus}
            label="修改 Logo"
            hint={profile.name}
            onClick={openLogoDialog}
            preview={
              profile.logoUrl ? (
                <Image
                  src={profile.logoUrl}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="h-5 w-5 rounded-md object-cover"
                />
              ) : null
            }
          />
        ) : (
          <SidebarActionButton
            icon={Smartphone}
            label="修改手机号"
            hint={maskPhone(profile.phone)}
            onClick={openPhoneDialog}
          />
        )}

        <SidebarActionButton
          icon={Headphones}
          label="联系客服"
          hint="留言或拨打热线"
          onClick={() => setCsOpen(true)}
        />

        <SidebarActionButton
          icon={Info}
          label="关于乐自由"
          hint="平台介绍"
          onClick={() => setAboutOpen(true)}
        />

        <SidebarActionButton
          icon={Repeat}
          label="切换身份"
          hint={consoleKind === "client" ? "切至设计师" : "切至委托人"}
          onClick={() => setRoleOpen(true)}
        />
      </div>

      {/* 修改手机号 */}
      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改手机号</DialogTitle>
            <DialogDescription>
              用于登录验证、订单通知与合同签署短信。修改后需重新验证。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sidebar-phone">新手机号</Label>
            <Input
              id="sidebar-phone"
              placeholder="11 位手机号"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
            />
            <p className="text-xs text-ink-40">当前：{maskPhone(profile.phone)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneOpen(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={savePhone}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改 Logo */}
      <Dialog open={logoOpen} onOpenChange={setLogoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改 Logo</DialogTitle>
            <DialogDescription>
              {profile.name} 的企业 / 团队标识，将展示在主页与订单合同中。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-ink-20 bg-ink-20/20">
              {logoDraft ? (
                <Image
                  src={logoDraft}
                  alt="Logo 预览"
                  width={96}
                  height={96}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-8 w-8 text-ink-40" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoFile(e.target.files?.[0])}
            />
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                上传图片
              </Button>
            </div>
            <div className="w-full space-y-2">
              <Label htmlFor="sidebar-logo-url">或粘贴图片地址</Label>
              <Input
                id="sidebar-logo-url"
                placeholder="https://..."
                value={logoDraft.startsWith("data:") ? "" : logoDraft}
                onChange={(e) => setLogoDraft(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoOpen(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={saveLogo}>
              保存 Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 联系客服 */}
      <Dialog open={csOpen} onOpenChange={setCsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>联系客服</DialogTitle>
            <DialogDescription>
              工作日 9:00–18:00。可按业务线直接拨打，或留言后由客服回电。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-60">业务专线</p>
            <ul className="space-y-2">
              {CUSTOMER_SERVICE_CONTACTS.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-ink-20 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {formatCustomerServiceLine(contact)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${CUSTOMER_SERVICE_HOTLINE},${contact.extension}`}>
                      <Phone className="h-3.5 w-3.5" />
                      拨打
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-40">
              总机 {CUSTOMER_SERVICE_HOTLINE_DISPLAY}，接通后按分机号选择业务线。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cs-message">在线留言</Label>
            <Textarea
              id="cs-message"
              placeholder="请描述您的问题或需求，客服将尽快回复…"
              rows={4}
              value={csMessage}
              onChange={(e) => setCsMessage(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" asChild>
              <a href={`tel:${CUSTOMER_SERVICE_HOTLINE}`}>
                <Phone className="h-4 w-4" />
                拨打总机
              </a>
            </Button>
            <Button
              variant="brand"
              onClick={submitCsMessage}
              disabled={csSubmitting}
            >
              {csSubmitting ? "提交中…" : "提交留言"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关于乐自由 */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>关于乐自由</DialogTitle>
            <DialogDescription>
              平台简介与服务说明，内容由平台管理员维护。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto rounded-xl border border-ink-20 bg-ink-20/10 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-80">
              {platformContent.aboutUs}
            </p>
          </div>
          <DialogFooter>
            <Button variant="brand" onClick={() => setAboutOpen(false)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 切换身份 */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>切换身份</DialogTitle>
            <DialogDescription>
              在委托人与设计师工作台之间快速切换（演示账号）。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => switchTo("client")}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                consoleKind === "client"
                  ? "border-ink bg-ink-20/30"
                  : "border-ink-20 hover:border-ink/40 hover:bg-ink-20/10",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <User className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">委托人 · 林先生</div>
                <div className="text-xs text-ink-60">查看平台订单、悬赏与收藏</div>
              </div>
              {consoleKind === "client" ? (
                <span className="ml-auto text-xs font-medium text-brand">当前</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => switchTo("designer")}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                consoleKind === "designer"
                  ? "border-ink bg-ink-20/30"
                  : "border-ink-20 hover:border-ink/40 hover:bg-ink-20/10",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">设计师 · 陈牧之</div>
                <div className="text-xs text-ink-60">管理项目、档期与取费基数</div>
              </div>
              {consoleKind === "designer" ? (
                <span className="ml-auto text-xs font-medium text-brand">当前</span>
              ) : null}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  preview,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
  preview?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-ink-20/40"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-20/50 text-ink-60">
        {preview ?? <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{label}</div>
        {hint ? (
          <div className="truncate text-[10px] text-ink-40">{hint}</div>
        ) : null}
      </div>
    </button>
  );
}
