import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, upsertFriendDietaryRestriction, upsertFriendInterest } from "@/lib/db";
import { normalizeInterestTerm } from "@/lib/nlp";
import { CategorySlug, ExtractCategorySlug } from "@/lib/types";

interface ExistingExtractedRow {
  id: number;
  text_input_id: number;
  friend_id: number | null;
  detected_friend_name: string;
  category_slug: ExtractCategorySlug;
  raw_value: string;
  normalized_value: string;
  confirmation_status: string;
  confidence: number;
  restriction_type: string | null;
}

function recomputeTextInputStatus(
  db: ReturnType<typeof getDb>,
  textInputId: number,
  userId: number
) {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) as total_count,
         SUM(CASE WHEN confirmation_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
         SUM(CASE WHEN confirmation_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
         SUM(CASE WHEN confirmation_status = 'pending' THEN 1 ELSE 0 END) as pending_count
       FROM extracted_data
       WHERE text_input_id = ?`
    )
    .get(textInputId) as {
    total_count: number;
    confirmed_count: number | null;
    rejected_count: number | null;
    pending_count: number | null;
  };

  const total = Number(counts?.total_count || 0);
  const conf = Number(counts?.confirmed_count || 0);
  const rej = Number(counts?.rejected_count || 0);
  const pend = Number(counts?.pending_count || 0);

  let status = "pending_review";
  if (total === 0) {
    status = "rejected";
  } else if (conf > 0 && rej === 0 && pend === 0) {
    status = "confirmed";
  } else if (conf > 0) {
    status = "partial";
  } else if (rej > 0 && pend === 0) {
    status = "rejected";
  }

  db.prepare("UPDATE text_inputs SET status = ? WHERE id = ? AND user_id = ?").run(
    status,
    textInputId,
    userId
  );
  return status;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT ed.*
       FROM extracted_data ed
       JOIN text_inputs ti ON ti.id = ed.text_input_id
       WHERE ed.id = ? AND ti.user_id = ?`
    )
    .get(id, user.id) as ExistingExtractedRow | undefined;

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบรายการข้อมูลที่สกัด" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const nextCategory = String(body.category_slug || existing.category_slug) as ExtractCategorySlug;
    const rawTerm = String(body.normalized_value ?? existing.normalized_value).trim();
    if (!rawTerm) {
      return NextResponse.json({ error: "กรุณาระบุค่าความสนใจ" }, { status: 400 });
    }
    const nextNormalized = normalizeInterestTerm(rawTerm, nextCategory).normalized;
    const nextFriendId =
      body.friend_id !== undefined
        ? body.friend_id
          ? Number(body.friend_id)
          : null
        : existing.friend_id;
    const nextDetectedName = String(
      body.detected_friend_name ?? existing.detected_friend_name
    ).trim();
    const nextStatus = String(
      body.confirmation_status ?? existing.confirmation_status
    ).trim();
    const nextRestriction =
      nextCategory === "disliked_food"
        ? String(body.restriction_type || existing.restriction_type || "dislike") === "allergy"
          ? "allergy"
          : "dislike"
        : null;

    if (nextFriendId) {
      const friendOwned = db
        .prepare("SELECT id, nickname FROM friends WHERE id = ? AND user_id = ?")
        .get(nextFriendId, user.id) as { id: number; nickname: string } | undefined;
      if (!friendOwned) {
        return NextResponse.json({ error: "ไม่พบข้อมูลเพื่อน" }, { status: 404 });
      }
    }

    db.exec("BEGIN TRANSACTION");

    // If the item had an old confirmed link from this text_input_id, remove the old link cleanly before re-linking
    if (existing.confirmation_status === "confirmed" && existing.friend_id) {
      if (existing.category_slug === "dietary_restriction") {
        db.prepare(
          `DELETE FROM friend_dietary_restrictions
           WHERE friend_id = ? AND LOWER(restriction_label) = LOWER(?) AND text_input_id = ?`
        ).run(existing.friend_id, existing.normalized_value, existing.text_input_id);
      } else {
        const oldInterest = db
          .prepare(
            `SELECT i.id
             FROM interests i
             JOIN interest_categories ic ON ic.id = i.category_id
             WHERE ic.slug = ? AND LOWER(i.normalized_value) = LOWER(?)`
          )
          .get(existing.category_slug, existing.normalized_value) as { id: number } | undefined;

        if (oldInterest) {
          db.prepare(
            `DELETE FROM friend_interests
             WHERE friend_id = ? AND interest_id = ? AND text_input_id = ?`
          ).run(existing.friend_id, oldInterest.id, existing.text_input_id);
        }
      }
    }

    if (nextStatus === "confirmed" && nextFriendId) {
      if (nextCategory === "dietary_restriction") {
        upsertFriendDietaryRestriction(db, {
          friendId: nextFriendId,
          label: nextNormalized,
          source: "nlp_extraction",
          textInputId: existing.text_input_id,
          preserveExisting: false,
        });
      } else {
        upsertFriendInterest(db, {
          friendId: nextFriendId,
          categorySlug: nextCategory as CategorySlug,
          normalizedValue: nextNormalized,
          rawValue: existing.raw_value || nextNormalized,
          source: "nlp_extraction",
          textInputId: existing.text_input_id,
          confidence: existing.confidence || 0.9,
          restrictionType: nextRestriction,
          preserveExisting: false,
        });
      }
    }

    db.prepare(
      `UPDATE extracted_data
       SET friend_id = ?, detected_friend_name = ?, category_slug = ?,
           normalized_value = ?, restriction_type = ?, confirmation_status = ?,
           is_ambiguous = 0, updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(
      nextFriendId,
      nextDetectedName || existing.detected_friend_name,
      nextCategory,
      nextNormalized,
      nextRestriction,
      nextStatus,
      id
    );

    const textInputStatus = recomputeTextInputStatus(db, existing.text_input_id, user.id);

    db.exec("COMMIT");

    const updated = db
      .prepare(
        `SELECT ed.*, ti.raw_text as input_raw_text, ti.source_label,
                f.nickname as friend_nickname, f.full_name as friend_full_name
         FROM extracted_data ed
         JOIN text_inputs ti ON ti.id = ed.text_input_id
         LEFT JOIN friends f ON f.id = ed.friend_id
         WHERE ed.id = ?`
      )
      .get(id);

    return NextResponse.json({ ok: true, item: updated, textInputStatus });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Update extracted row error:", err);
    return NextResponse.json({ error: "ไม่สามารถอัปเดตรายการได้" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT ed.*
       FROM extracted_data ed
       JOIN text_inputs ti ON ti.id = ed.text_input_id
       WHERE ed.id = ? AND ti.user_id = ?`
    )
    .get(id, user.id) as ExistingExtractedRow | undefined;

  if (!existing) {
    return NextResponse.json({ error: "ไม่พบรายการที่ต้องการลบ" }, { status: 404 });
  }

  try {
    db.exec("BEGIN TRANSACTION");

    if (existing.friend_id) {
      if (existing.category_slug === "dietary_restriction") {
        db.prepare(
          `DELETE FROM friend_dietary_restrictions
           WHERE friend_id = ? AND LOWER(restriction_label) = LOWER(?) AND text_input_id = ?`
        ).run(existing.friend_id, existing.normalized_value, existing.text_input_id);
      } else {
        const oldInterest = db
          .prepare(
            `SELECT i.id
             FROM interests i
             JOIN interest_categories ic ON ic.id = i.category_id
             WHERE ic.slug = ? AND LOWER(i.normalized_value) = LOWER(?)`
          )
          .get(existing.category_slug, existing.normalized_value) as { id: number } | undefined;

        if (oldInterest) {
          db.prepare(
            `DELETE FROM friend_interests
             WHERE friend_id = ? AND interest_id = ? AND text_input_id = ?`
          ).run(existing.friend_id, oldInterest.id, existing.text_input_id);
        }
      }
    }

    db.prepare("DELETE FROM extracted_data WHERE id = ?").run(id);
    const textInputStatus = recomputeTextInputStatus(db, existing.text_input_id, user.id);

    db.exec("COMMIT");
    return NextResponse.json({ ok: true, textInputStatus });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Delete extracted row error:", err);
    return NextResponse.json({ error: "ไม่สามารถลบรายการได้" }, { status: 500 });
  }
}
