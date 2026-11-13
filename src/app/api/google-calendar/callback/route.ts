import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  completeGoogleOAuthCallback,
  GCAL_PKCE_COOKIE,
  GoogleCalendarError,
  verifyOAuthBindingCookie,
} from "@/lib/google-calendar";

function wantsJson(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function redirectToSettings(origin: string, params: Record<string, string>) {
  const target = new URL("/settings", origin);
  for (const [k, v] of Object.entries(params)) {
    target.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(target);
  res.cookies.delete(GCAL_PKCE_COOKIE);
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = getCurrentUser();
  if (!user) {
    if (wantsJson(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?next=/settings", url.origin));
  }

  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";

  if (oauthError) {
    if (state) {
      try {
        getDb().prepare("DELETE FROM google_oauth_states WHERE state = ? AND user_id = ?").run(state, user.id);
      } catch {
        // ignore cleanup error
      }
    }
    if (wantsJson(req)) {
      const r = NextResponse.json(
        { error: "ยกเลิกการอนุญาตเชื่อมต่อ Google Calendar", code: "OAUTH_DENIED", connected: false },
        { status: 400 }
      );
      r.cookies.delete(GCAL_PKCE_COOKIE);
      return r;
    }
    return redirectToSettings(url.origin, {
      gcal: oauthError === "access_denied" ? "denied" : "error",
      reason: oauthError,
    });
  }

  if (!code || !state) {
    if (wantsJson(req)) {
      const r = NextResponse.json(
        { error: "ข้อมูลตอบกลับจาก Google OAuth ไม่ครบถ้วน", code: "MISSING_PARAMS", connected: false },
        { status: 400 }
      );
      r.cookies.delete(GCAL_PKCE_COOKIE);
      return r;
    }
    return redirectToSettings(url.origin, { gcal: "error", reason: "missing_params" });
  }

  const pkceCookie = cookies().get(GCAL_PKCE_COOKIE)?.value;
  if (!verifyOAuthBindingCookie(pkceCookie, state, user.id)) {
    try {
      getDb().prepare("DELETE FROM google_oauth_states WHERE state = ?").run(state);
    } catch {
      // ignore cleanup error
    }
    if (wantsJson(req)) {
      const r = NextResponse.json(
        { error: "การตรวจสอบความปลอดภัย OAuth (CSRF Cookie) ไม่ผ่าน", code: "CSRF_MISMATCH", connected: false },
        { status: 400 }
      );
      r.cookies.delete(GCAL_PKCE_COOKIE);
      return r;
    }
    return redirectToSettings(url.origin, { gcal: "error", reason: "csrf_mismatch" });
  }

  try {
    const completed = await completeGoogleOAuthCallback({
      userId: user.id,
      code,
      state,
      requestOrigin: url.origin,
    });

    const target = new URL(completed.redirectPath || "/settings", url.origin);
    target.searchParams.set("gcal", completed.syncWarning ? "connected_partial" : "connected");
    const res = NextResponse.redirect(target);
    res.cookies.delete(GCAL_PKCE_COOKIE);
    return res;
  } catch (err) {
    const message =
      err instanceof GoogleCalendarError
        ? err.message
        : "ไม่สามารถเชื่อมต่อ Google Calendar ได้ กรุณาลองใหม่อีกครั้ง";
    const status = err instanceof GoogleCalendarError ? err.status : 500;
    const codeStr = err instanceof GoogleCalendarError ? err.code : "CALLBACK_FAILED";

    if (wantsJson(req)) {
      const r = NextResponse.json({ error: message, code: codeStr, connected: false }, { status });
      r.cookies.delete(GCAL_PKCE_COOKIE);
      return r;
    }
    return redirectToSettings(url.origin, { gcal: "error", reason: codeStr.toLowerCase() });
  }
}
