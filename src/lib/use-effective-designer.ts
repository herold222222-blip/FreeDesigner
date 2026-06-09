"use client";

import { useDesigner } from "@/lib/use-data";
import type { Designer } from "@/lib/types";

/** 以 API / 数据库中的设计师资料为准（不再叠加 localStorage 草稿） */
export function useEffectiveDesigner(designerId: string): Designer | undefined {
  const { data: base } = useDesigner(designerId);
  return base ?? undefined;
}
