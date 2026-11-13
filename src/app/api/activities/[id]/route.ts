import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getFriendsWithInterests } from "@/lib/db";
import { buildFriendRecommendations, validateActivityPayload } from "@/lib/activities";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = Number(params.id);
  const db = getDb();

  const activity = db
    .prepare(
      `SELECT a.*, u.name as organizer_name
       FROM activities a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = ? AND a.user_id = ?`
    )
    .get(activityId, user.id) as
    | {
        id: number;
        title: string;
        description: string;
        category: string;
        activity_date: string;
        start_time: string;
        end_time: string | null;
        location: string;
        target_interests_json: string;
        status: string;
        created_at: string;
        organizer_name: string;
      }
    | undefined;

  if (!activity) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }

  const invitations = db
    .prepare(
      `SELECT ai.*, f.full_name, f.nickname, f.avatar_color, f.contact_info
       FROM activity_invitations ai
       JOIN friends f ON f.id = ai.friend_id
       WHERE ai.activity_id = ?
       ORDER BY
         CASE ai.rsvp_status WHEN 'going' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
         f.nickname ASC`
    )
    .all(activityId) as unknown as Array<{
    id: number;
    activity_id: number;
    friend_id: number;
    rsvp_status: string;
    decline_reason: string | null;
    response_note: string | null;
    invite_token: string;
    sent_at: string;
    responded_at: string | null;
    last_opened_at: string | null;
    full_name: string;
    nickname: string;
    avatar_color: string;
    contact_info: string | null;
  }>;

  const allFriends = getFriendsWithInterests(user.id);
  const invitedSet = new Set(invitations.map((i) => i.friend_id));
  const targetTags: string[] = (() => {
    try {
      return JSON.parse(activity.target_interests_json || "[]");
    } catch {
      return [];
    }
  })();

  const recommendations = buildFriendRecommendations(allFriends, targetTags, activity.category);
  const recById = new Map(recommendations.map((r) => [r.id, r]));

  const enrichedInvitations = invitations.map((inv) => {
    const rec = recById.get(inv.friend_id);
    return {
      ...inv,
      dislikes: rec ? rec.dislikes.map((d) => d.normalized_value) : [],
      dislikeDetails: rec ? rec.dislikes : [],
      matchedLikes: rec ? rec.matchedLikes : [],
      recommendationReason: rec ? rec.recommendationReason : "",
    };
  });

  const recommendedUninvited = recommendations
    .filter((r) => !invitedSet.has(r.id))
    .map((r) => ({
      id: r.id,
      full_name: r.full_name,
      nickname: r.nickname,
      avatar_color: r.avatar_color,
      matchedLikes: r.matchedLikes,
      dislikes: r.dislikes.map((d) => d.normalized_value),
      dislikeDetails: r.dislikes,
      recommendationReason: r.recommendationReason,
      matchScore: r.matchScore,
    }));

  const goingList = enrichedInvitations.filter((i) => i.rsvp_status === "going");
  const notGoingList = enrichedInvitations.filter((i) => i.rsvp_status === "not_going");
  const pendingList = enrichedInvitations.filter((i) => i.rsvp_status === "pending");
  const totalInvited = enrichedInvitations.length;
  const responseRate =
    totalInvited > 0
      ? Math.round(((goingList.length + notGoingList.length) / totalInvited) * 100)
      : 0;

  return NextResponse.json({
    activity: {
      ...activity,
      target_interests: targetTags,
    },
    stats: {
      totalInvited,
      going: goingList.length,
      notGoing: notGoingList.length,
      pending: pendingList.length,
      responseRate,
      goingNames: goingList.map((i) => i.nickname),
      notGoingNames: notGoingList.map((i) => ({
        nickname: i.nickname,
        reason: i.decline_reason || "ไม่ระบุ",
        note: i.response_note,
      })),
      pendingNames: pendingList.map((i) => i.nickname),
    },
    invitations: enrichedInvitations,
    recommendedUninvited,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = Number(params.id);
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
    .get(activityId, user.id) as Record<string, string | number | null> | undefined;

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }

  const body = await req.json();
  const title = String(body.title ?? existing.title).trim();
  const description = String(body.description ?? existing.description ?? "").trim();
  const category = String(body.category ?? existing.category).trim();
  const activity_date = String(body.activity_date ?? existing.activity_date).trim();
  const start_time = String(body.start_time ?? existing.start_time).trim();
  const end_time: string | null =
    body.end_time !== undefined
      ? body.end_time
        ? String(body.end_time).trim()
        : null
      : (existing.end_time as string | null);
  const location = String(body.location ?? existing.location).trim();
  const status = String(body.status ?? existing.status).trim();
  const target_interests_json = Array.isArray(body.target_interests)
    ? JSON.stringify(body.target_interests)
    : String(existing.target_interests_json || "[]");

  const validationError = validateActivityPayload({
    title,
    location,
    activity_date,
    start_time,
    end_time,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  db.prepare(
    `UPDATE activities
     SET title = ?, description = ?, category = ?, activity_date = ?, start_time = ?,
         end_time = ?, location = ?, target_interests_json = ?, status = ?,
         updated_at = datetime('now', 'localtime')
     WHERE id = ? AND user_id = ?`
  ).run(
    title,
    description,
    category,
    activity_date,
    start_time,
    end_time,
    location,
    target_interests_json,
    status,
    activityId,
    user.id
  );

  const updated = db
    .prepare(
      `SELECT a.*, u.name as organizer_name
       FROM activities a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = ?`
    )
    .get(activityId);
  return NextResponse.json({ activity: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = Number(params.id);
  const db = getDb();
  const res = db
    .prepare("DELETE FROM activities WHERE id = ? AND user_id = ?")
    .run(activityId, user.id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
