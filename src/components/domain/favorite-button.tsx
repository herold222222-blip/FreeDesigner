"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useFavoritesStore } from "@/store/favorites-store";
import { useRoleStore } from "@/store/role-store";
import { toggleClientFavoriteRequest } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  designerId,
  size = "md",
  variant = "icon",
  label,
}: {
  designerId: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "labeled";
  label?: string;
}) {
  const role = useRoleStore((s) => s.role);
  const isFav = useFavoritesStore((s) => s.designerIds.includes(designerId));
  const setDesignerIds = useFavoritesStore((s) => s.setDesignerIds);
  const toggleLocal = useFavoritesStore((s) => s.toggleDesigner);
  const push = useSessionStore((s) => s.pushNotification);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setHydrated(true), []);

  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (role !== "client") {
      push({
        title: "请先登录委托人账号",
        description: "收藏设计师需使用委托人身份。",
        variant: "destructive",
      });
      return;
    }
    if (busy) return;
    toggleLocal(designerId);
    setBusy(true);
    try {
      const res = await toggleClientFavoriteRequest(designerId);
      setDesignerIds(res.designerIds);
    } catch (err) {
      toggleLocal(designerId);
      push({
        title: "收藏操作失败",
        description: err instanceof Error ? err.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (variant === "labeled") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
          hydrated && isFav
            ? "border-rose-200 bg-rose-50 text-rose-600"
            : "border-ink-20 text-ink-60 hover:border-rose-300 hover:text-rose-500",
        )}
      >
        <Heart
          className={cn(
            icon,
            hydrated && isFav ? "fill-rose-500 text-rose-500" : "",
          )}
        />
        <span>{hydrated && isFav ? (label ?? "已收藏") : (label ?? "收藏设计师")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleToggle}
      className={cn(
        "flex items-center justify-center rounded-full bg-white/90 shadow-sm transition-all hover:scale-110",
        dims,
      )}
      title={hydrated && isFav ? "取消收藏" : "收藏"}
    >
      <Heart
        className={cn(
          icon,
          "transition-colors",
          hydrated && isFav
            ? "fill-rose-500 text-rose-500"
            : "text-ink-40 hover:text-rose-500",
        )}
      />
    </button>
  );
}
