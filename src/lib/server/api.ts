import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** 统一包裹路由处理函数，集中处理鉴权与异常 */
export function handle<T>(fn: () => Promise<T>) {
  return fn().catch((err: unknown) => {
    if (err instanceof AuthError) {
      return fail(err.status, err.message);
    }
    console.error("[api] 未处理异常:", err);
    const message = err instanceof Error ? err.message : "服务器内部错误";
    return fail(500, message);
  });
}
