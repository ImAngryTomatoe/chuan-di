import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDb,
  getUserSelfProfile,
  replaceFriendDietaryRestrictions,
  replaceUserSelfProfile,
  upsertFriendInterest,
} from "@/lib/db";
import { normalizeInterestTerm } from "@/lib/nlp";
import { CategorySlug } from "@/lib/types";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const ownProfile = getUserSelfProfile(user.id);

  // Guard against any legacy self-link (f.user_id != user.id)
  const linkedFriends = db
    .prepare(
      `SELECT f.id, f.user_id AS owner_id, u.name AS organizer_name,
              f.full_name, f.nickname, f.birthday, f.contact_info,
              COALESCE(f.religion, 'ไม่ระบุ') AS religion,
              COALESCE(f.can_eat, '') AS can_eat,
              COALESCE(f.cannot_eat, '') AS cannot_eat,
              f.avatar_color, f.consent_given, f.joined_via_invite, f.updated_at
       FROM friends f
       JOIN users u ON u.id = f.user_id
       WHERE f.linked_user_id = ? AND f.user_id != ?
       ORDER BY f.updated_at DESC, f.id DESC`
    )
    .all(user.id, user.id) as Array<{
    id: number;
    owner_id: number;
    organizer_name: string;
    full_name: string;
    nickname: string;
    birthday: string | null;
    contact_info: string | null;
    religion: string;
    can_eat: string;
    cannot_eat: string;
    avatar_color: string;
    consent_given: number;
    joined_via_invite: number;
    updated_at: string;
  }>;

  const interestStmt = db.prepare(
    `SELECT fi.id, fi.interest_id, c.slug as category_slug, c.name_th as category_name_th,
            i.normalized_value, fi.raw_value, fi.source, fi.text_input_id,
            fi.confidence, fi.confirmed, fi.restriction_type, fi.created_at
     FROM friend_interests fi
     JOIN interests i ON i.id = fi.interest_id
     JOIN interest_categories c ON c.id = i.category_id
     WHERE fi.friend_id = ?
     ORDER BY fi.id ASC`
  );

  const dietaryStmt = db.prepare(
    `SELECT id, friend_id, restriction_label, restriction_category, source, text_input_id, created_at
     FROM friend_dietary_restrictions
     WHERE friend_id = ?
     ORDER BY id ASC`
  );

  const profiles = linkedFriends.map((f) => ({
    ...f,
    interests: interestStmt.all(f.id),
    dietary_restrictions: dietaryStmt.all(f.id),
  }));

  const invitations = db
    .prepare(
      `SELECT ai.id, ai.activity_id, ai.friend_id, ai.rsvp_status, ai.decline_reason, ai.response_note,
              ai.invite_token, ai.responded_at,
              a.title AS activity_title, a.description AS activity_description,
              a.category AS activity_category, a.activity_date, a.start_time, a.end_time, a.location,
              u.name AS organizer_name, f.nickname AS friend_nickname
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       JOIN friends f ON f.id = ai.friend_id
       JOIN users u ON u.id = a.user_id
       WHERE f.linked_user_id = ? AND f.user_id != ?
       ORDER BY a.activity_date ASC, ai.id DESC`
    )
    .all(user.id, user.id);

  const pendingReq = db
    .prepare("SELECT COUNT(*) as cnt FROM friend_requests WHERE receiver_user_id = ? AND status = 'pending'")
    .get(user.id) as { cnt: number };

  return NextResponse.json({
    ownProfile,
    profiles,
    invitations,
    pendingRequestsCount: pendingReq?.cnt || 0,
  });
}

export async function PATCH(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  try {
    const body = await req.json();
    const friendId = body.friendId ? Number(body.friendId) : null;
    const full_name = String(body.full_name || "").trim();
    const nickname = String(body.nickname || "").trim();
    const birthday = body.birthday ? String(body.birthday).trim() : null;
    const contact_info = body.contact_info ? String(body.contact_info).trim() : null;
    const religion =
      body.religion !== undefined ? String(body.religion || "ไม่ระบุ").trim() || "ไม่ระบุ" : undefined;
    const can_eat = body.can_eat !== undefined ? String(body.can_eat || "").trim() : undefined;
    const cannot_eat = body.cannot_eat !== undefined ? String(body.cannot_eat || "").trim() : undefined;

    if (!nickname && !full_name) {
      return NextResponse.json({ error: "กรุณาระบุชื่อหรือชื่อเล่นของคุณ" }, { status: 400 });
    }

    const finalFull = full_name || nickname;
    const finalNick = nickname || finalFull.split(/\s+/)[0];

    type NormalizedInterestEntry = {
      categorySlug: CategorySlug;
      normalizedValue: string;
      rawValue: string;
      restrictionType: "allergy" | "dislike" | null;
    };
    const normalizedInterests: NormalizedInterestEntry[] | undefined = Array.isArray(body.interests)
      ? body.interests
          .map((item: { category_slug?: string; value?: string; normalized_value?: string; restriction_type?: string | null }): NormalizedInterestEntry | null => {
            const cat = String(item.category_slug || "other_interests") as CategorySlug;
            const rawVal = String(item.value || item.normalized_value || "").trim();
            if (!rawVal) return null;
            const norm = normalizeInterestTerm(rawVal, cat);
            const restrictionType =
              cat === "disliked_food"
                ? item.restriction_type === "allergy"
                  ? "allergy"
                  : "dislike"
                : null;
            return {
              categorySlug: cat,
              normalizedValue: norm.normalized,
              rawValue: rawVal,
              restrictionType,
            };
          })
          .filter((x: NormalizedInterestEntry | null): x is NormalizedInterestEntry => Boolean(x))
      : undefined;

    if (friendId) {
      const target = db
        .prepare("SELECT id, user_id, linked_user_id FROM friends WHERE id = ?")
        .get(friendId) as { id: number; user_id: number; linked_user_id: number | null } | undefined;

      if (!target || target.linked_user_id !== user.id || target.user_id === user.id) {
        return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขโปรไฟล์เพื่อนคนนี้" }, { status: 403 });
      }

      db.exec("BEGIN TRANSACTION");

      db.prepare(
        `UPDATE friends
         SET full_name = ?, nickname = ?, birthday = ?, contact_info = ?,
             religion = COALESCE(?, religion),
             can_eat = COALESCE(?, can_eat),
             cannot_eat = COALESCE(?, cannot_eat),
             updated_at = datetime('now', 'localtime')
         WHERE id = ? AND linked_user_id = ?`
      ).run(
        finalFull,
        finalNick,
        birthday,
        contact_info,
        religion ?? null,
        can_eat ?? null,
        cannot_eat ?? null,
        friendId,
        user.id
      );

      if (normalizedInterests) {
        db.prepare("DELETE FROM friend_interests WHERE friend_id = ?").run(friendId);
        for (const item of normalizedInterests) {
          upsertFriendInterest(db, {
            friendId,
            categorySlug: item.categorySlug,
            normalizedValue: item.normalizedValue,
            rawValue: item.rawValue,
            source: "self_service",
            restrictionType: item.restrictionType,
            preserveExisting: false,
          });
        }
      }

      if (Array.isArray(body.dietary_restrictions)) {
        replaceFriendDietaryRestrictions(db, friendId, body.dietary_restrictions, "self_service");
      }

      // Also sync the user's canonical self-profile and any other linked friend rows
      replaceUserSelfProfile(db, user.id, {
        full_name: finalFull,
        nickname: finalNick,
        birthday,
        contact_info,
        religion,
        can_eat,
        cannot_eat,
        interests: normalizedInterests?.map((i) => ({
          categorySlug: i.categorySlug,
          normalizedValue: i.normalizedValue,
          restrictionType: i.restrictionType,
          source: "self_service",
        })),
        dietary_restrictions: Array.isArray(body.dietary_restrictions)
          ? body.dietary_restrictions
          : undefined,
      });

      db.exec("COMMIT");
      return NextResponse.json({ ok: true, ownProfile: getUserSelfProfile(user.id) });
    }

    // Default: updating user's own profile syncs automatically to all connected friends
    db.exec("BEGIN TRANSACTION");
    replaceUserSelfProfile(db, user.id, {
      full_name: finalFull,
      nickname: finalNick,
      birthday,
      contact_info,
      religion,
      can_eat,
      cannot_eat,
      interests: normalizedInterests?.map((i) => ({
        categorySlug: i.categorySlug,
        normalizedValue: i.normalizedValue,
        restrictionType: i.restrictionType,
        source: "self_service",
      })),
      dietary_restrictions: Array.isArray(body.dietary_restrictions)
        ? body.dietary_restrictions
        : undefined,
    });
    db.exec("COMMIT");

    return NextResponse.json({ ok: true, ownProfile: getUserSelfProfile(user.id) });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Update my profile error:", err);
    return NextResponse.json({ error: "ไม่สามารถบันทึกโปรไฟล์ส่วนตัวได้" }, { status: 500 });
  }
}
