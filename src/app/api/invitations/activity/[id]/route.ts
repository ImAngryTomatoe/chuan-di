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
  const db = getDb();

  const inv = db
    .prepare(
      `SELECT ai.id, a.user_id as owner_id
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE ai.id = ?`
    )
    .get(invId) as { id: number; owner_id: number } | undefined;

  if (!inv) {
    return NextResponse.json({ error: "ไม่พบคำเชิญ" }, { status: 404 });
  }
  if (inv.owner_id !== user.id) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขคำเชิญของกิจกรรมอื่น" }, { status: 403 });
  }

  const body = await req.json();
  const rsvp_status = String(body.rsvp_status || "pending");
  if (!["going", "not_going", "pending"].includes(rsvp_status)) {
    return NextResponse.json({ error: "สถานะ RSVP ไม่ถูกต้อง" }, { status: 400 });
  }

  const decline_reason =
    rsvp_status === "not_going" ? String(body.decline_reason || "ไม่ว่าง").trim() : null;
  const response_note = body.response_note ? String(body.response_note).trim() : null;
  const respondedAt =
    rsvp_status === "pending" ? null : new Date().toISOString().slice(0, 19).replace("T", " ");

  db.prepare(
    `UPDATE activity_invitations
     SET rsvp_status = ?, decline_reason = ?, response_note = ?, responded_at = ?
     WHERE id = ?`
  ).run(rsvp_status, decline_reason, response_note, respondedAt, invId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invId = Number(params.id);
  const db = getDb();

  const inv = db
    .prepare(
      `SELECT ai.id, a.user_id as owner_id
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE ai.id = ?`
    )
    .get(invId) as { id: number; owner_id: number } | undefined;

  if (!inv) {
    return NextResponse.json({ error: "ไม่พบคำเชิญ" }, { status: 404 });
  }
  if (inv.owner_id !== user.id) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบคำเชิญของกิจกรรมอื่น" }, { status: 403 });
  }

  db.prepare("DELETE FROM activity_invitations WHERE id = ?").run(invId);
  return NextResponse.json({ ok: true });
}
