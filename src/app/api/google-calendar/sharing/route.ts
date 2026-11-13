import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSharingTargetsForUser,
  GoogleCalendarError,
  updateSharingTargetForUser,
} from "@/lib/google-calendar";

export async function PATCH(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { friendId?: unknown; isShared?: unknown };
  try {
    body = (await req.json()) as { friendId?: unknown; isShared?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const friendId = Number(body.friendId);
  if (!Number.isFinite(friendId) || friendId <= 0 || typeof body.isShared !== "boolean") {
    return NextResponse.json(
      { error: "กรุณาระบุ friendId และ isShared (boolean) ให้ถูกต้อง" },
      { status: 400 }
    );
  }

  try {
    const target = updateSharingTargetForUser({
      currentUserId: user.id,
      friendId,
      isShared: body.isShared,
    });
    const sharingTargets = getSharingTargetsForUser(user.id);
    return NextResponse.json({ ok: true, target, sharingTargets });
  } catch (err) {
    if (err instanceof GoogleCalendarError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json(
      { error: "ไม่สามารถอัปเดตสิทธิ์การแชร์ปฏิทินได้" },
      { status: 500 }
    );
  }
}
