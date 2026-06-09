"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ORG_LOGO_PATH,
  defaultAvatarForGender,
  type ProfileGender,
} from "@/lib/default-profile-images";
import { useSessionStore } from "@/store/session-store";

export type ProfileImageKind = "avatar" | "logo";

interface ProfileImageUploadProps {
  kind: ProfileImageKind;
  value: string;
  onChange: (url: string) => void;
  /** 头像模式下，未自定义时随性别切换默认图 */
  gender?: ProfileGender | "";
  className?: string;
}

export function ProfileImageUpload({
  kind,
  value,
  onChange,
  gender,
  className,
}: ProfileImageUploadProps) {
  const push = useSessionStore((s) => s.pushNotification);
  const inputRef = useRef<HTMLInputElement>(null);
  const [customized, setCustomized] = useState(false);

  const defaultUrl =
    kind === "logo"
      ? DEFAULT_ORG_LOGO_PATH
      : defaultAvatarForGender(gender === "female" ? "female" : "male");

  useEffect(() => {
    if (kind !== "avatar" || customized || !gender) return;
    onChange(defaultAvatarForGender(gender));
  }, [gender, kind, customized, onChange]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push({ title: "请选择图片文件", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      push({
        title: "图片过大",
        description: "请上传 2MB 以内的图片。",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
        setCustomized(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetToDefault = () => {
    onChange(defaultUrl);
    setCustomized(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const label = kind === "logo" ? "企业 Logo" : "头像";
  const hint =
    kind === "logo"
      ? "未上传时将使用平台默认 Logo，可随时更换。"
      : "未上传时将按性别使用系统默认头像，可随时更换。";

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-ink-20 bg-ink-20/20",
            kind === "logo" ? "h-24 w-24" : "h-20 w-20 rounded-full",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={label}
              className={cn(
                "h-full w-full object-cover",
                kind === "avatar" && "rounded-full",
              )}
            />
          ) : (
            <Camera className="h-8 w-8 text-ink-40" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-ink-60">{hint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              上传{kind === "logo" ? " Logo" : "头像"}
            </Button>
            {customized ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                <X className="h-3.5 w-3.5" />
                恢复默认
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
