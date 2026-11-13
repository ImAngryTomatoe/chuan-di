import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getDb } from "./db";

const COOKIE_NAME = "chuan_di_token";
const JWT_SECRET = process.env.JWT_SECRET || "chuan-di-dev-secret-2026";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  bio: string | null;
  created_at: string;
}

export function signAuthToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): { userId: number; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getCurrentUser(): SessionUser | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, bio, created_at FROM users WHERE id = ?")
    .get(payload.userId) as SessionUser | undefined;

  return user || null;
}
