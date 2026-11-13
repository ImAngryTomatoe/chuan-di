import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createOAuthStateAndUrl,
  GCAL_PKCE_COOKIE,
  getGoogleOAuthConfig,
  GoogleCalendarError,
  sanitizeRedirectPath,
} from "@/lib/google-calendar";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "json";
  const redirectPath = sanitizeRedirectPath(url.searchParams.get("redirect") || "/settings");

  const user = getCurrentUser();
  if (!user) {
    if (mode === "redirect") {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(redirectPath)}`, url.origin));
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = getGoogleOAuthConfig(url.origin);
  if (!cfg.configured) {
    if (mode === "redirect") {
      const target = new URL(redirectPath, url.origin);
      target.searchParams.set("gcal", "not_configured");
      return NextResponse.redirect(target);
    }
    return NextResponse.json(
      {
        error: "ยังไม่ได้ตั้งค่า Google OAuth Credentials บนเซิร์ฟเวอร์",
        code: "OAUTH_NOT_CONFIGURED",
        configured: false,
        connected: false,
        setupGuide: "docs/GOOGLE_CALENDAR_SETUP.md",
      },
      { status: 503 }
    );
  }

  try {
    const result = createOAuthStateAndUrl({
      userId: user.id,
      redirectPath,
      requestOrigin: url.origin,
      loginHint: user.email,
    });

    const response =
      mode === "redirect"
        ? NextResponse.redirect(result.authUrl)
        : NextResponse.json({
            configured: true,
            authUrl: result.authUrl,
          });

    response.cookies.set(GCAL_PKCE_COOKIE, result.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (err) {
    if (err instanceof GoogleCalendarError) {
      return NextResponse.json(
        { error: err.message, code: err.code, configured: false, connected: false },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "ไม่สามารถสร้างคำขอเชื่อมต่อ Google Calendar ได้" },
      { status: 500 }
    );
  }
}
