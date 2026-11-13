import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  disconnectUserGoogleCalendar,
  getGoogleCalendarPublicStatus,
} from "@/lib/google-calendar";

async function handleDisconnect(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const result = await disconnectUserGoogleCalendar({ userId: user.id });
  const status = getGoogleCalendarPublicStatus(user.id, origin);
  return NextResponse.json({ ok: true, ...result, status });
}

export async function POST(req: Request) {
  return handleDisconnect(req);
}

export async function DELETE(req: Request) {
  return handleDisconnect(req);
}
