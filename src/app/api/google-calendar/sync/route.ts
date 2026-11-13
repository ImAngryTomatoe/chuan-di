import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getGoogleCalendarPublicStatus,
  GoogleCalendarError,
  syncUserGoogleCalendar,
} from "@/lib/google-calendar";

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;

  try {
    const syncResult = await syncUserGoogleCalendar({
      userId: user.id,
      requestOrigin: origin,
    });
    const status = getGoogleCalendarPublicStatus(user.id, origin);
    return NextResponse.json({ ok: true, sync: syncResult, status });
  } catch (err) {
    if (err instanceof GoogleCalendarError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json(
      { error: "ไม่สามารถซิงก์ข้อมูลปฏิทินจาก Google ได้" },
      { status: 500 }
    );
  }
}
