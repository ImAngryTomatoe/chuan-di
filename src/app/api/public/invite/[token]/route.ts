import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser, setAuthCookie, signAuthToken } from "@/lib/auth";
import {
  getDb,
  replaceFriendDietaryRestrictions,
  replaceUserSelfProfile,
  upsertFriendInterest,
} from "@/lib/db";
import { normalizeInterestTerm } from "@/lib/nlp";
import { CategorySlug } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const caller = getCurrentUser();
  const db = getDb();
  const inv = db
    .prepare(
      `SELECT ri.id, ri.user_id, ri.invite_token, ri.label, ri.target_friend_name,
              ri.prefill_friend_id, ri.accepted_friend_id, ri.status, u.name as organizer_name
       FROM registration_invitations ri
       JOIN users u ON u.id = ri.user_id
       WHERE ri.invite_token = ?`
    )
    .get(params.token) as
    | {
        id: number;
        user_id: number;
        invite_token: string;
        label: string;
        target_friend_name: string | null;
        prefill_friend_id: number | null;
        accepted_friend_id: number | null;
        status: string;
        organizer_name: string;
      }
    | undefined;

  if (!inv) {
    return NextResponse.json({ error: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 404 });
  }

  let prefillFriend: Record<string, unknown> | null = null;
  const targetPrefillId = inv.prefill_friend_id || inv.accepted_friend_id;

  if (targetPrefillId) {
    const f = db
      .prepare(
        `SELECT id, linked_user_id, full_name, nickname, birthday, contact_info,
                COALESCE(religion, 'ไม่ระบุ') AS religion,
                COALESCE(can_eat, '') AS can_eat,
                COALESCE(cannot_eat, '') AS cannot_eat
         FROM friends WHERE id = ? AND user_id = ?`
      )
      .get(targetPrefillId, inv.user_id) as
      | {
          id: number;
          linked_user_id: number | null;
          full_name: string;
          nickname: string;
          birthday: string | null;
          contact_info: string | null;
          religion: string;
          can_eat: string;
          cannot_eat: string;
        }
      | undefined;

    // Do not leak a claimed account's profile details to a different logged-in user
    if (f && (!f.linked_user_id || caller?.id === f.linked_user_id || caller?.id === inv.user_id)) {
      const interests = db
        .prepare(
          `SELECT ic.slug as category_slug, i.normalized_value, fi.restriction_type
           FROM friend_interests fi
           JOIN interests i ON i.id = fi.interest_id
           JOIN interest_categories ic ON ic.id = i.category_id
           WHERE fi.friend_id = ?`
        )
        .all(f.id);
      const dietary_restrictions = db
        .prepare(
          `SELECT id, friend_id, restriction_label, restriction_category, source, created_at
           FROM friend_dietary_restrictions
           WHERE friend_id = ?
           ORDER BY id ASC`
        )
        .all(f.id);
      prefillFriend = {
        id: f.id,
        full_name: f.full_name,
        nickname: f.nickname,
        birthday: f.birthday,
        contact_info: f.contact_info,
        religion: f.religion,
        can_eat: f.can_eat,
        cannot_eat: f.cannot_eat,
        interests,
        dietary_restrictions,
      };
    }
  }

  return NextResponse.json({
    invitation: {
      label: inv.label,
      target_friend_name: inv.target_friend_name,
      status: inv.status,
      organizer_name: inv.organizer_name,
      hasPrefillFriend: Boolean(inv.prefill_friend_id),
    },
    currentUser: caller ? { id: caller.id, name: caller.name, email: caller.email } : null,
    prefillFriend,
  });
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const db = getDb();
  const inv = db
    .prepare("SELECT * FROM registration_invitations WHERE invite_token = ?")
    .get(params.token) as
    | {
        id: number;
        user_id: number;
        prefill_friend_id: number | null;
        accepted_friend_id: number | null;
        status: string;
      }
    | undefined;

  if (!inv) {
    return NextResponse.json({ error: "ลิงก์เชิญไม่ถูกต้อง" }, { status: 404 });
  }

  const body = await req.json();
  const consent_given = Boolean(body.consent_given);
  if (!consent_given) {
    return NextResponse.json(
      { error: "กรุณายืนยันความยินยอมในการบันทึกข้อมูลความชอบของคุณก่อน" },
      { status: 400 }
    );
  }

  const authMode = String(body.authMode || (body.email ? "register" : "guest")).trim();
  const registerEmail = body.email ? String(body.email).trim().toLowerCase() : "";
  const registerPassword = body.password ? String(body.password) : "";

  let linkedUserId: number | null = getCurrentUser()?.id ?? null;
  let linkedUserEmail: string | null = getCurrentUser()?.email ?? null;

  const full_name = String(body.full_name || "").trim();
  const nickname = String(body.nickname || "").trim();
  const birthday = body.birthday ? String(body.birthday).trim() : null;
  const contact_info = body.contact_info ? String(body.contact_info).trim() : null;
  const religion = body.religion !== undefined ? String(body.religion || "ไม่ระบุ").trim() || "ไม่ระบุ" : undefined;
  const can_eat = body.can_eat !== undefined ? String(body.can_eat || "").trim() : undefined;
  const cannot_eat = body.cannot_eat !== undefined ? String(body.cannot_eat || "").trim() : undefined;

  if (!nickname && !full_name) {
    return NextResponse.json({ error: "กรุณากรอกชื่อเล่นหรือชื่อของคุณ" }, { status: 400 });
  }

  if (authMode === "login") {
    if (!registerEmail || !registerPassword) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ" }, { status: 400 });
    }
    const acc = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(registerEmail) as { id: number; email: string; password_hash: string } | undefined;
    if (!acc || !bcrypt.compareSync(registerPassword, acc.password_hash)) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    linkedUserId = acc.id;
    linkedUserEmail = acc.email;
  } else if (authMode === "register") {
    if (!registerEmail || registerPassword.length < 6) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    }
    const existingAcc = db.prepare("SELECT id FROM users WHERE email = ?").get(registerEmail) as
      | { id: number }
      | undefined;
    if (existingAcc) {
      return NextResponse.json(
        { error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเลือกแท็บเข้าสู่ระบบ" },
        { status: 409 }
      );
    }
    const hash = bcrypt.hashSync(registerPassword, 10);
    const uRes = db
      .prepare("INSERT INTO users (name, email, password_hash, bio) VALUES (?, ?, ?, ?)")
      .run(
        nickname || full_name,
        registerEmail,
        hash,
        "สมาชิกที่เข้าร่วมเครือข่ายเพื่อน CHUAN-DI"
      );
    linkedUserId = Number(uRes.lastInsertRowid);
    linkedUserEmail = registerEmail;
  }

  // Prevent a claimed registration link from being hijacked by a different user
  if (inv.status === "accepted" && inv.accepted_friend_id) {
    const claimed = db
      .prepare("SELECT id, linked_user_id FROM friends WHERE id = ?")
      .get(inv.accepted_friend_id) as { id: number; linked_user_id: number | null } | undefined;
    if (claimed?.linked_user_id && linkedUserId !== claimed.linked_user_id) {
      return NextResponse.json(
        { error: "ลิงก์เชิญนี้ถูกใช้งานและผูกกับบัญชีเพื่อนอื่นเรียบร้อยแล้ว" },
        { status: 403 }
      );
    }
  }

  const finalNick = nickname || full_name.split(/\s+/)[0];
  const finalFull = full_name || finalNick;
  // Never allow an organizer's own logged-in user_id to self-link onto a friend row in their own network
  const safeLinkedUserId =
    linkedUserId && linkedUserId !== inv.user_id ? linkedUserId : null;

  let friendId = inv.prefill_friend_id;

  db.exec("BEGIN TRANSACTION");
  try {
    // 1) First check if safeLinkedUserId already has a connected friend row in this organizer's network
    if (!friendId && safeLinkedUserId) {
      const linkedMatch = db
        .prepare("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?")
        .get(inv.user_id, safeLinkedUserId) as { id: number } | undefined;
      if (linkedMatch) friendId = linkedMatch.id;
    }

    if (friendId) {
      db.prepare(
        `UPDATE friends
         SET full_name = ?, nickname = ?, birthday = COALESCE(?, birthday),
             contact_info = COALESCE(?, contact_info),
             religion = COALESCE(?, religion),
             can_eat = COALESCE(?, can_eat),
             cannot_eat = COALESCE(?, cannot_eat),
             linked_user_id = COALESCE(?, linked_user_id),
             consent_given = 1, joined_via_invite = 1,
             updated_at = datetime('now', 'localtime')
         WHERE id = ? AND user_id = ?`
      ).run(
        finalFull,
        finalNick,
        birthday,
        contact_info,
        religion ?? null,
        can_eat ?? null,
        cannot_eat ?? null,
        safeLinkedUserId,
        friendId,
        inv.user_id
      );
    } else {
      const existingFriend = db
        .prepare(
          `SELECT id FROM friends
           WHERE user_id = ? AND LOWER(nickname) = LOWER(?)
             AND (linked_user_id IS NULL OR linked_user_id = ?)`
        )
        .get(inv.user_id, finalNick, safeLinkedUserId ?? -1) as { id: number } | undefined;

      if (existingFriend) {
        friendId = existingFriend.id;
        db.prepare(
          `UPDATE friends
           SET full_name = ?, birthday = COALESCE(?, birthday),
               contact_info = COALESCE(?, contact_info),
               religion = COALESCE(?, religion),
               can_eat = COALESCE(?, can_eat),
               cannot_eat = COALESCE(?, cannot_eat),
               linked_user_id = COALESCE(?, linked_user_id),
               consent_given = 1, joined_via_invite = 1,
               updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        ).run(
          finalFull,
          birthday,
          contact_info,
          religion ?? null,
          can_eat ?? null,
          cannot_eat ?? null,
          safeLinkedUserId,
          friendId
        );
      } else {
        const res = db
          .prepare(
            `INSERT INTO friends (user_id, linked_user_id, full_name, nickname, birthday, contact_info, religion, can_eat, cannot_eat, personal_notes, avatar_color, consent_given, joined_via_invite)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '#EFEAE8', 1, 1)`
          )
          .run(
            inv.user_id,
            safeLinkedUserId,
            finalFull,
            finalNick,
            birthday,
            contact_info,
            religion ?? "ไม่ระบุ",
            can_eat ?? "",
            cannot_eat ?? "",
            "เข้าร่วมและกรอกความชอบด้วยตนเองผ่านลิงก์เชิญ"
          );
        friendId = Number(res.lastInsertRowid);
      }
    }

    if (Array.isArray(body.interests) && friendId) {
      db.prepare("DELETE FROM friend_interests WHERE friend_id = ?").run(friendId);
      for (const item of body.interests) {
        const cat = String(item.category_slug || "other_interests") as CategorySlug;
        const val = String(item.value || item.normalized_value || "").trim();
        if (!val) continue;
        const norm = normalizeInterestTerm(val, cat);
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
          rawValue: val,
          source: "self_update_link",
          restrictionType,
          preserveExisting: false,
        });
      }
    }

    if (Array.isArray(body.dietary_restrictions) && friendId) {
      replaceFriendDietaryRestrictions(
        db,
        friendId,
        body.dietary_restrictions,
        "self_update_link"
      );
    }

    if (safeLinkedUserId) {
      const normalizedSelfInterests = Array.isArray(body.interests)
        ? body.interests
            .map((item: { category_slug?: string; value?: string; normalized_value?: string; restriction_type?: string | null }) => {
              const cat = String(item.category_slug || "other_interests") as CategorySlug;
              const val = String(item.value || item.normalized_value || "").trim();
              if (!val) return null;
              const norm = normalizeInterestTerm(val, cat);
              const restrictionType =
                cat === "disliked_food"
                  ? item.restriction_type === "allergy"
                    ? "allergy"
                    : "dislike"
                  : null;
              return {
                categorySlug: cat,
                normalizedValue: norm.normalized,
                restrictionType: restrictionType as "allergy" | "dislike" | null,
                source: "self_update_link",
              };
            })
            .filter((x: unknown): x is { categorySlug: CategorySlug; normalizedValue: string; restrictionType: "allergy" | "dislike" | null; source: string } => Boolean(x))
        : undefined;

      replaceUserSelfProfile(db, safeLinkedUserId, {
        full_name: finalFull,
        nickname: finalNick,
        birthday,
        contact_info,
        religion,
        can_eat,
        cannot_eat,
        interests: normalizedSelfInterests,
        dietary_restrictions: Array.isArray(body.dietary_restrictions)
          ? body.dietary_restrictions
          : undefined,
      });
    }

    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    db.prepare(
      `UPDATE registration_invitations
       SET status = 'accepted', accepted_friend_id = ?, accepted_at = ?
       WHERE id = ?`
    ).run(friendId, nowStr, inv.id);

    db.exec("COMMIT");

    if (safeLinkedUserId && linkedUserEmail && (authMode === "register" || authMode === "login")) {
      const jwtToken = signAuthToken(safeLinkedUserId, linkedUserEmail);
      setAuthCookie(jwtToken);
    }

    return NextResponse.json({
      ok: true,
      friendId,
      nickname: finalNick,
      linkedUserId: safeLinkedUserId,
      authenticated: Boolean(safeLinkedUserId),
    });
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("Public invite submit error:", err);
    return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลได้" }, { status: 500 });
  }
}
