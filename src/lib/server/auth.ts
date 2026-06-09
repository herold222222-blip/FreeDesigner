import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "@/lib/types";

const SESSION_COOKIE = "lezyou_session";
const SESSION_TTL_DAYS = 30;

/**
 * 是否给会话 cookie 标记 Secure。
 * 默认：生产环境为 true（要求 HTTPS）。
 * 若临时以 HTTP/IP 访问（尚未配置 TLS），可设 COOKIE_SECURE=false 以便登录可用。
 */
function cookieSecure() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  role: Role;
  identityId: string;
  phone: string;
  name: string;
  avatar?: string | null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function newToken() {
  return randomBytes(32).toString("hex");
}

/** 创建会话并写入 httpOnly cookie */
export async function createSession(params: {
  userId: string;
  role: Role;
  identityId: string;
}) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId: params.userId,
      role: params.role,
      identityId: params.identityId,
      expiresAt,
    },
  });

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** 读取当前登录会话（含用户基本信息），未登录返回 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    role: session.role as Role,
    identityId: session.identityId,
    phone: session.user.phone,
    name: session.user.name,
    avatar: session.user.avatar,
  };
}

/** 要求登录，否则抛出 401 语义错误 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError(401, "未登录");
  }
  return user;
}

/** 要求指定角色之一 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    throw new AuthError(403, "无权访问");
  }
  return user;
}

/** 切换当前会话生效身份（同一账号在多角色间切换时使用） */
export async function switchSessionRole(role: Role, identityId: string) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) throw new AuthError(401, "未登录");
  await prisma.session.update({
    where: { token },
    data: { role, identityId },
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
