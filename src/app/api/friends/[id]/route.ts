import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDb,
  getFriendsWithInterests,
  replaceFriendDietaryRestrictions,
  upsertFriendInterest,
} from "@/lib/db";
import { normalizeInterestTerm } from "@/lib/nlp";
import { CategorySlug } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friendId = Number(params.id);
  if (!Number.isFinite(friendId)) {
    return NextResponse.json({ error: "Invalid friend ID" }, { status: 400 });
  }

  const friend = getFriendsWithInterests(user.id).find((f) => f.id === friendId);
  if (!friend) {
    return NextResponse.json({ error: "ไม่พบข้อมูลเพื่อน" }, { status: 404 });
  }

  const db = getDb();
  const invitationHistory = db
    .prepare(
      `SELECT ai.id, ai.activity_id, ai.rsvp_status, ai.decline_reason, ai.response_note,
              ai.invite_token, ai.sent_at, ai.responded_at,
              a.title as activity_title, a.category as activity_category,
              a.activity_date, a.start_time, a.end_time, a.location
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE ai.friend_id = ? AND a.user_id = ?
       ORDER BY a.activity_date DESC, ai.id DESC`
    )
    .all(friendId, user.id);

  const traceability = db
    .prepare(
      `SELECT ed.id, ed.raw_value, ed.normalized_value, ed.category_slug,
              ed.confirmation_status, ed.created_at, ti.raw_text, ti.source_label
       FROM extracted_data ed
       JOIN text_inputs ti ON ti.id = ed.text_input_id
       WHERE ed.friend_id = ? AND ti.user_id = ?
       ORDER BY ed.id DESC`
    )
    .all(friendId, user.id);

  return NextResponse.json({ friend, invitationHistory, traceability });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friendId = Number(params.id);
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id, linked_user_id, COALESCE(religion, 'ไม่ระบุ') AS religion, COALESCE(can_eat, '') AS can_eat, COALESCE(cannot_eat, '') AS cannot_eat FROM friends WHERE id = ? AND user_id = ?"
    )
    .get(friendId, user.id) as
    | { id: number; linked_user_id: number | null; religion: string; can_eat: string; cannot_eat: string }
    | undefined;

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบข้อมูลเพื่อน" }, { status: 404 });
  }

  if (existing.linked_user_id != null) {
    return NextResponse.json(
      {
        error:
          "เพื่อนคนนี้เชื่อมบัญชี CHUAN-DI แล้ว ข้อมูลความชอบและข้อจำกัดด้านอาหารจะซิงก์จากโปรไฟล์ที่เพื่อนกรอกเอง ไม่สามารถแก้ไขแทนได้",
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const nickname = String(body.nickname || "").trim();
    const birthday = body.birthday ? String(body.birthday).trim() : null;
    const contact_info = body.contact_info ? String(body.contact_info).trim() : null;
    const personal_notes = body.personal_notes ? String(body.personal_notes).trim() : null;
    const religion =
      body.religion !== undefined ? String(body.religion || "ไม่ระบุ").trim() || "ไม่ระบุ" : existing.religion;
    const can_eat = body.can_eat !== undefined ? String(body.can_eat || "").trim() : existing.can_eat;
    const cannot_eat = body.cannot_eat !== undefined ? String(body.cannot_eat || "").trim() : existing.cannot_eat;

    if (!full_name && !nickname) {
      return NextResponse.json({ error: "กรุณาระบุชื่อหรือชื่อเล่น" }, { status: 400 });
    }

    db.exec("BEGIN TRANSACTION");
    db.prepare(
      `UPDATE friends
       SET full_name = ?, nickname = ?, birthday = ?, contact_info = ?, personal_notes = ?,
           religion = ?, can_eat = ?, cannot_eat = ?,
           updated_at = datetime('now', 'localtime')
       WHERE id = ? AND user_id = ?`
    ).run(
      full_name || nickname,
      nickname || full_name,
      birthday,
      contact_info,
      personal_notes,
      religion,
      can_eat,
      cannot_eat,
      friendId,
      user.id
    );

    if (Array.isArray(body.interests)) {
      db.prepare("DELETE FROM friend_interests WHERE friend_id = ?").run(friendId);
      for (const item of body.interests) {
        const cat = String(item.category_slug || "other_interests") as CategorySlug;
        const rawVal = String(item.value || item.raw_value || item.normalized_value || "").trim();
        if (!rawVal) continue;
        const norm = normalizeInterestTerm(rawVal, cat);
        const restrictionType =
          cat === "disliked_food"
            ? item.restriction_type === "allergy"
              ? "allergy"
              : "dislike"
            : null;
        upsertFriendInterest(db, {
          friendId,
          categorySlug: cat,
          normalizedValue: norm.normalized,
          rawValue: rawVal,
          source: String(item.source || "manual"),
          restrictionType,
        });
      }
    }

    if (Array.isArray(body.dietary_restrictions)) {
      replaceFriendDietaryRestrictions(db, friendId, body.dietary_restrictions, "manual");
    }
    db.exec("COMMIT");

    const updated = getFriendsWithInterests(user.id).find((f) => f.id === friendId);
    return NextResponse.json({ friend: updated });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Update friend error:", err);
    return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลเพื่อนได้" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const friendId = Number(params.id);
  const db = getDb();
  const res = db
    .prepare("DELETE FROM friends WHERE id = ? AND user_id = ?")
    .run(friendId, user.id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลเพื่อน" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
