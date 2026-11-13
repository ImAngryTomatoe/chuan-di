import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invId = Number(params.id);
  if (!Number.isFinite(invId)) {
    return NextResponse.json({ error: "Invalid invitation ID" }, { status: 400 });
  }

  const db = getDb();
  const inv = db
    .prepare(
      `SELECT ai.id, f.linked_user_id
       FROM activity_invitations ai
       JOIN friends f ON f.id = ai.friend_id
       WHERE ai.id = ?`
    )
    .get(invId) as { id: number; linked_user_id: number | null } | undefined;

  if (!inv) {
    return NextResponse.json({ error: "ไม่พบคำเชิญกิจกรรม" }, { status: 404 });
  }

  if (inv.linked_user_id !== user.id) {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์แก้ไขคำเชิญของเพื่อนคนอื่น" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const rsvp_status = String(body.rsvp_status || "pending");
  if (!["going", "not_going", "pending"].includes(rsvp_status)) {
    return NextResponse.json({ error: "สถานะ RSVP ไม่ถูกต้อง" }, { status: 400 });
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

  const respondedAt =
    rsvp_status === "pending"
      ? null
      : new Date().toISOString().slice(0, 19).replace("T", " ");

  db.prepare(
    `UPDATE activity_invitations
     SET rsvp_status = ?, decline_reason = ?, response_note = ?, responded_at = ?
     WHERE id = ?`
  ).run(rsvp_status, decline_reason, response_note, respondedAt, invId);

  return NextResponse.json({ ok: true, rsvp_status, decline_reason, response_note });
}
