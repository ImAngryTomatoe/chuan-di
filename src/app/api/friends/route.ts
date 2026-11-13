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

const AVATAR_COLORS = ["#D69DAE", "#C4B49A", "#B4A6C2", "#9CB8A6", "#9BA8B4", "#B8A59E"];

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const interest = (searchParams.get("interest") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "").trim();
  const religion = (searchParams.get("religion") || "").trim();
  const allergy = (searchParams.get("allergy") || "").trim();
  const dietaryParam = (searchParams.get("dietary") || "").trim();
  const dietaryFilters = dietaryParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const sort = searchParams.get("sort") || "recent";

  let friends = getFriendsWithInterests(user.id);

  if (q) {
    friends = friends.filter(
      (f) =>
        f.full_name.toLowerCase().includes(q) ||
        f.nickname.toLowerCase().includes(q) ||
        (f.personal_notes || "").toLowerCase().includes(q) ||
        (f.religion || "").toLowerCase().includes(q) ||
        (f.can_eat || "").toLowerCase().includes(q) ||
        (f.cannot_eat || "").toLowerCase().includes(q) ||
        (f.dietary_restrictions || []).some((d) =>
          d.restriction_label.toLowerCase().includes(q)
        ) ||
        f.interests.some((i) => i.normalized_value.toLowerCase().includes(q))
    );
  }

  if (dietaryFilters.length > 0) {
    friends = friends.filter((f) => {
      const labels = new Set(
        (f.dietary_restrictions || []).map((d) => d.restriction_label.toLowerCase())
      );
      const allergyLabels = f.interests
        .filter((i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy")
        .map((i) => i.normalized_value.toLowerCase());
      return dietaryFilters.every(
        (reqLabel) =>
          labels.has(reqLabel) ||
          (reqLabel === "แพ้อาหารทะเล" &&
            allergyLabels.some((a) => /กุ้ง|ปู|หอย|หมึก|ทะเล|ซีฟู้ด/.test(a))) ||
          (reqLabel === "แพ้ถั่ว" && allergyLabels.some((a) => /ถั่ว|อัลมอนด์/.test(a))) ||
          (reqLabel === "แพ้นม" && allergyLabels.some((a) => /นม|แลคโตส/.test(a)))
      );
    });
  }

  if (religion && religion !== "ทั้งหมด") {
    friends = friends.filter((f) => (f.religion || "ไม่ระบุ") === religion);
  }

  if (allergy === "only") {
    friends = friends.filter((f) =>
      f.interests.some((i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy")
    );
  } else if (allergy === "none") {
    friends = friends.filter(
      (f) =>
        !f.interests.some((i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy")
    );
  }

  if (interest) {
    friends = friends.filter((f) =>
      f.interests.some((i) => i.normalized_value.toLowerCase() === interest)
    );
  }

  if (category) {
    friends = friends.filter((f) => f.interests.some((i) => i.category_slug === category));
  }

  if (sort === "name") {
    friends.sort((a, b) => a.nickname.localeCompare(b.nickname, "th"));
  } else {
    friends.sort((a, b) => b.id - a.id);
  }

  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const nickname = String(body.nickname || "").trim();
    const birthday = body.birthday ? String(body.birthday).trim() : null;
    const contact_info = body.contact_info ? String(body.contact_info).trim() : null;
    const personal_notes = body.personal_notes ? String(body.personal_notes).trim() : null;
    const religion = body.religion ? String(body.religion).trim() || "ไม่ระบุ" : "ไม่ระบุ";
    const can_eat = body.can_eat ? String(body.can_eat).trim() : "";
    const cannot_eat = body.cannot_eat ? String(body.cannot_eat).trim() : "";
    const allowDuplicate = Boolean(body.allowDuplicate);

    if (!full_name && !nickname) {
      return NextResponse.json({ error: "กรุณาระบุชื่อหรือชื่อเล่นของเพื่อน" }, { status: 400 });
    }

    const finalNickname = nickname || full_name.split(/\s+/)[0];
    const finalFullName = full_name || finalNickname;

    const db = getDb();

    if (!allowDuplicate) {
      const dup = db
        .prepare(
          `SELECT id, full_name, nickname FROM friends
           WHERE user_id = ? AND (LOWER(nickname) = LOWER(?) OR LOWER(full_name) = LOWER(?))`
        )
        .get(user.id, finalNickname, finalFullName) as
        | { id: number; full_name: string; nickname: string }
        | undefined;

      if (dup) {
        return NextResponse.json(
          {
            error: `พบเพื่อนชื่อ "${dup.nickname}" ${dup.full_name} อยู่ในระบบแล้ว`,
            duplicateFriendId: dup.id,
          },
          { status: 409 }
        );
      }
    }

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const res = db
      .prepare(
        `INSERT INTO friends (user_id, full_name, nickname, birthday, contact_info, personal_notes, religion, can_eat, cannot_eat, avatar_color, consent_given)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        user.id,
        finalFullName,
        finalNickname,
        birthday,
        contact_info,
        personal_notes,
        religion,
        can_eat,
        cannot_eat,
        avatarColor
      );

    const friendId = Number(res.lastInsertRowid);

    // Optional interests array: [{ category_slug, value, restriction_type }]
    const interestsInput = Array.isArray(body.interests) ? body.interests : [];
    for (const item of interestsInput) {
      const cat = String(item.category_slug || "other_interests") as CategorySlug;
      const rawVal = String(item.value || "").trim();
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
        source: "manual",
        restrictionType,
      });
    }

    if (Array.isArray(body.dietary_restrictions)) {
      replaceFriendDietaryRestrictions(db, friendId, body.dietary_restrictions, "manual");
    }

    const created = getFriendsWithInterests(user.id).find((f) => f.id === friendId);
    return NextResponse.json({ friend: created }, { status: 201 });
  } catch (err) {
    console.error("Create friend error:", err);
    return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลเพื่อนได้" }, { status: 500 });
  }
}
