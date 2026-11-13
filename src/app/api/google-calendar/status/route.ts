import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleCalendarPublicStatus } from "@/lib/google-calendar";

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;
  const status = getGoogleCalendarPublicStatus(user.id, origin);
  return NextResponse.json(status);
}
