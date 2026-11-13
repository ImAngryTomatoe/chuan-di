import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const caller = getCurrentUser();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ai.id, ai.rsvp_status, ai.decline_reason, ai.response_note, ai.responded_at,
              f.nickname as friend_nickname, f.linked_user_id,
              a.id as activity_id, a.user_id as organizer_id, a.title, a.description, a.category,
              a.activity_date, a.start_time, a.end_time, a.location,
              u.name as organizer_name
       FROM activity_invitations ai
       JOIN friends f ON f.id = ai.friend_id
       JOIN activities a ON a.id = ai.activity_id
       JOIN users u ON u.id = a.user_id
       WHERE ai.invite_token = ?`
    )
    .get(params.token) as
    | {
        id: number;
        activity_id: number;
        organizer_id: number;
        linked_user_id: number | null;
        rsvp_status: string;
        decline_reason: string | null;
        response_note: string | null;
        responded_at: string | null;
        friend_nickname: string;
        title: string;
        description: string;
        category: string;
        activity_date: string;
        start_time: string;
        end_time: string | null;
        location: string;
        organizer_name: string;
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "ไม่พบลิงก์คำเชิญกิจกรรมนี้" }, { status: 404 });
  }

  // If friend account is linked and a DIFFERENT authenticated user accesses this token, block access
  if (
    row.linked_user_id &&
    caller &&
    caller.id !== row.linked_user_id &&
    caller.id !== row.organizer_id
  ) {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์เข้าถึงคำเชิญส่วนตัวของเพื่อนคนอื่น" },
      { status: 403 }
    );
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
  db.prepare("UPDATE activity_invitations SET last_opened_at = ? WHERE id = ?").run(
    nowStr,
    row.id
  );

  const attendees = db
    .prepare(
      `SELECT f.nickname, ai.rsvp_status
       FROM activity_invitations ai
       JOIN friends f ON f.id = ai.friend_id
       WHERE ai.activity_id = ?`
    )
    .all(row.activity_id) as unknown as Array<{ nickname: string; rsvp_status: string }>;

  return NextResponse.json({
    invitation: {
      id: row.id,
      activity_id: row.activity_id,
      friend_nickname: row.friend_nickname,
      organizer_name: row.organizer_name,
      title: row.title,
      description: row.description,
      category: row.category,
      activity_date: row.activity_date,
      start_time: row.start_time,
      end_time: row.end_time,
      location: row.location,
      rsvp_status: row.rsvp_status,
      decline_reason: row.decline_reason,
      response_note: row.response_note,
      responded_at: row.responded_at,
    },
    summary: {
      goingNicknames: attendees.filter((a) => a.rsvp_status === "going").map((a) => a.nickname),
      totalInvited: attendees.length,
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const caller = getCurrentUser();
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT ai.id, f.linked_user_id, a.user_id as organizer_id
       FROM activity_invitations ai
       JOIN friends f ON f.id = ai.friend_id
       JOIN activities a ON a.id = ai.activity_id
       WHERE ai.invite_token = ?`
    )
    .get(params.token) as
    | { id: number; linked_user_id: number | null; organizer_id: number }
    | undefined;

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบลิงก์คำเชิญกิจกรรมนี้" }, { status: 404 });
  }

  if (
    existing.linked_user_id &&
    caller &&
    caller.id !== existing.linked_user_id &&
    caller.id !== existing.organizer_id
  ) {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์แก้ไขคำเชิญของเพื่อนคนอื่น" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const rsvp_status = String(body.rsvp_status || "");
  if (!["going", "not_going"].includes(rsvp_status)) {
    return NextResponse.json({ error: "กรุณาเลือกสถานะการตอบรับ" }, { status: 400 });
  }

  const decline_reason =
    rsvp_status === "not_going" ? String(body.decline_reason || "ไม่ว่าง").trim() : null;
  const response_note = body.response_note ? String(body.response_note).trim() : null;

  if (rsvp_status === "not_going" && decline_reason === "อื่น ๆ" && !response_note) {
    return NextResponse.json(
      { error: "กรุณาระบุรายละเอียดเหตุผลเพิ่มเติมเมื่อเลือก 'อื่น ๆ'" },
      { status: 400 }
    );
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");

  db.prepare(
    `UPDATE activity_invitations
     SET rsvp_status = ?, decline_reason = ?, response_note = ?, responded_at = ?
     WHERE id = ?`
  ).run(rsvp_status, decline_reason, response_note, nowStr, existing.id);

  return NextResponse.json({ ok: true, rsvp_status, decline_reason, response_note });
}
