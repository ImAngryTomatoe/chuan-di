import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { validateActivityPayload } from "@/lib/activities";

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "").trim();
  const status = (searchParams.get("status") || "").trim();

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, u.name as organizer_name,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id) as total_invited,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'going') as going_count,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'not_going') as not_going_count,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'pending') as pending_count
       FROM activities a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.activity_date ASC, a.start_time ASC, a.id DESC`
    )
    .all(user.id) as unknown as Array<Record<string, unknown>>;

  const activities = rows.filter((a) => {
    if (category && a.category !== category) return false;
    if (status && status !== "all" && a.status !== status) return false;
    if (q) {
      const hay = `${a.title || ""} ${a.location || ""} ${a.description || ""} ${
        a.target_interests_json || ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "อาหารและสังสรรค์").trim();
    const activity_date = String(body.activity_date || "").trim();
    const start_time = String(body.start_time || "").trim();
    const end_time = body.end_time ? String(body.end_time).trim() : null;
    const location = String(body.location || "").trim();
    const target_interests = Array.isArray(body.target_interests) ? body.target_interests : [];
    const rawFriendIds: number[] = Array.isArray(body.friendIds) ? body.friendIds.map(Number) : [];
    const uniqueFriendIds: number[] = Array.from(
      new Set<number>(rawFriendIds.filter((id: number) => Number.isFinite(id) && id > 0))
    );

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

    const db = getDb();
    db.exec("BEGIN TRANSACTION");

    const res = db
      .prepare(
        `INSERT INTO activities (user_id, title, description, category, activity_date, start_time, end_time, location, target_interests_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')`
      )
      .run(
        user.id,
        title,
        description,
        category,
        activity_date,
        start_time,
        end_time,
        location,
        JSON.stringify(target_interests)
      );

    const activityId = Number(res.lastInsertRowid);

    const insertInvite = db.prepare(`
      INSERT OR IGNORE INTO activity_invitations (activity_id, friend_id, rsvp_status, invite_token)
      VALUES (?, ?, 'pending', ?)
    `);

    let generatedLinksCount = 0;
    for (const fid of uniqueFriendIds) {
      const owns = db
        .prepare("SELECT id FROM friends WHERE id = ? AND user_id = ?")
        .get(fid, user.id);
      if (owns) {
        const token = crypto.randomBytes(16).toString("hex");
        const ins = insertInvite.run(activityId, fid, token);
        if (ins.changes > 0) generatedLinksCount++;
      }
    }

    db.exec("COMMIT");

    const created = db
      .prepare(
        `SELECT a.*, u.name as organizer_name
         FROM activities a
         JOIN users u ON u.id = a.user_id
         WHERE a.id = ?`
      )
      .get(activityId);
    return NextResponse.json({ activity: created, generatedLinksCount }, { status: 201 });
  } catch (err) {
    try {
      getDb().exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Create activity error:", err);
    return NextResponse.json({ error: "ไม่สามารถสร้างกิจกรรมได้" }, { status: 500 });
  }
}
