import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = Number(params.id);
  const db = getDb();
  const activity = db
    .prepare("SELECT id FROM activities WHERE id = ? AND user_id = ?")
    .get(activityId, user.id);

  if (!activity) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }

  const body = await req.json();
  const rawFriendIds: number[] = Array.isArray(body.friendIds) ? body.friendIds.map(Number) : [];
  const friendIds: number[] = Array.from(
    new Set<number>(rawFriendIds.filter((id: number) => Number.isFinite(id) && id > 0))
  );
  if (friendIds.length === 0) {
    return NextResponse.json({ error: "กรุณาเลือกเพื่อนอย่างน้อย 1 คน" }, { status: 400 });
  }

  const insertInvite = db.prepare(`
    INSERT OR IGNORE INTO activity_invitations (activity_id, friend_id, rsvp_status, invite_token)
    VALUES (?, ?, 'pending', ?)
  `);

  let added = 0;
  for (const fid of friendIds) {
    const owns = db
      .prepare("SELECT id FROM friends WHERE id = ? AND user_id = ?")
      .get(fid, user.id);
    if (owns) {
      const token = crypto.randomBytes(16).toString("hex");
      const r = insertInvite.run(activityId, fid, token);
      if (r.changes > 0) added++;
    }
  }

  return NextResponse.json({ ok: true, added, generatedLinksCount: added });
}
