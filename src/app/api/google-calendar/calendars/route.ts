import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getGoogleCalendarPublicStatus,
  GoogleCalendarError,
  updateSelectedGoogleCalendars,
} from "@/lib/google-calendar";

export async function PUT(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { calendarIds?: unknown };
  try {
    body = (await req.json()) as { calendarIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.calendarIds)) {
    return NextResponse.json({ error: "กรุณาระบุรายการ calendarIds เป็น array" }, { status: 400 });
  }

  const calendarIds = body.calendarIds.filter((item): item is string => typeof item === "string");
  const origin = new URL(req.url).origin;

  try {
    const syncResult = await updateSelectedGoogleCalendars({
      userId: user.id,
      calendarIds,
      requestOrigin: origin,
    });
    const status = getGoogleCalendarPublicStatus(user.id, origin);
    return NextResponse.json({ ok: true, sync: syncResult, status });
  } catch (err) {
    if (err instanceof GoogleCalendarError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json(
      { error: "ไม่สามารถบันทึกการเลือกปฏิทินและซิงก์ข้อมูลได้" },
      { status: 500 }
    );
  }
}
