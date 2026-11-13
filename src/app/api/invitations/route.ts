import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const activityInvitations = db
    .prepare(
      `SELECT ai.id, ai.activity_id, ai.friend_id, ai.rsvp_status, ai.decline_reason,
              ai.response_note, ai.invite_token, ai.sent_at, ai.responded_at, ai.last_opened_at,
              a.title as activity_title, a.category as activity_category,
              a.activity_date, a.start_time, a.end_time, a.location,
              f.full_name, f.nickname, f.avatar_color
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       JOIN friends f ON f.id = ai.friend_id
       WHERE a.user_id = ?
       ORDER BY a.activity_date ASC, ai.id DESC`
    )
    .all(user.id) as unknown as Array<{
    id: number;
    rsvp_status: string;
    decline_reason: string | null;
    [k: string]: unknown;
  }>;

  const total = activityInvitations.length;
  const going = activityInvitations.filter((x) => x.rsvp_status === "going").length;
  const notGoing = activityInvitations.filter((x) => x.rsvp_status === "not_going").length;
  const pending = activityInvitations.filter((x) => x.rsvp_status === "pending").length;
  const responseRate = total > 0 ? Math.round(((going + notGoing) / total) * 100) : 0;

  const registrationInvitations = db
    .prepare(
      `SELECT ri.*, f.nickname as accepted_nickname, pf.nickname as target_nickname
       FROM registration_invitations ri
       LEFT JOIN friends f ON f.id = ri.accepted_friend_id
       LEFT JOIN friends pf ON pf.id = ri.prefill_friend_id
       WHERE ri.user_id = ?
       ORDER BY ri.id DESC`
    )
    .all(user.id);

  const friendsList = db
    .prepare("SELECT id, nickname, full_name FROM friends WHERE user_id = ? ORDER BY nickname ASC")
    .all(user.id);

  return NextResponse.json({
    stats: { total, going, notGoing, pending, responseRate },
    activityInvitations,
    registrationInvitations,
    friendsList,
  });
}
