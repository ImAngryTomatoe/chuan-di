import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, upsertFriendDietaryRestriction, upsertFriendInterest } from "@/lib/db";
import { normalizeInterestTerm } from "@/lib/nlp";
import { CategorySlug, ExtractCategorySlug } from "@/lib/types";

function mapAllergyToDietaryLabel(normalizedAllergy: string): string {
  const lower = normalizedAllergy.toLowerCase();
  if (/กุ้ง|ปู|หอย|หมึก|ปลาหมึก|อาหารทะเล|ซีฟู้ด/.test(lower)) return "แพ้อาหารทะเล";
  if (/ถั่ว|อัลมอนด์/.test(lower)) return "แพ้ถั่ว";
  if (/นม|แลคโตส/.test(lower)) return "แพ้นม";
  return normalizedAllergy.startsWith("แพ้") ? normalizedAllergy : `แพ้${normalizedAllergy}`;
}

const AVATAR_COLORS = ["#EFEAE8", "#ECE7DF", "#E7EAEF", "#E6ECE8", "#EDE7EB"];

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  try {
    const body = await req.json();
    const textInputId = body.textInputId ? Number(body.textInputId) : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "ไม่มีรายการที่เลือกสำหรับบันทึก" }, { status: 400 });
    }

    db.exec("BEGIN TRANSACTION");

    const newlyCreatedFriends: Array<{ id: number; nickname: string }> = [];
    const createdByDetectedName = new Map<string, number>();
    let savedInterestsCount = 0;
    let skippedExistingCount = 0;

    for (const item of items) {
      const extractedId = item.extractedId ? Number(item.extractedId) : null;
      const selected = item.selected !== false;

      if (!selected) {
        if (extractedId) {
          db.prepare(
            "UPDATE extracted_data SET confirmation_status = 'rejected', updated_at = datetime('now', 'localtime') WHERE id = ?"
          ).run(extractedId);
        }
        continue;
      }

      const detectedName = String(item.detected_friend_name || "").trim();
      let friendId = item.matched_friend_id ? Number(item.matched_friend_id) : null;

      if (!friendId && (!detectedName || detectedName.startsWith("ไม่ระบุ"))) {
        db.exec("ROLLBACK");
        return NextResponse.json(
          { error: "มีรายการที่ยังไม่ได้ระบุชื่อเพื่อน กรุณาเลือกเพื่อนที่มีอยู่หรือพิมพ์ชื่อเพื่อนก่อนบันทึก" },
          { status: 400 }
        );
      }

      if (!friendId && detectedName) {
        const key = detectedName.toLowerCase();
        if (createdByDetectedName.has(key)) {
          friendId = createdByDetectedName.get(key)!;
        } else {
          const existing = db
            .prepare(
              `SELECT id FROM friends WHERE user_id = ? AND (LOWER(nickname) = LOWER(?) OR LOWER(full_name) = LOWER(?))`
            )
            .get(user.id, detectedName, detectedName) as { id: number } | undefined;

          if (existing) {
            friendId = existing.id;
          } else {
            const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
            const fRes = db
              .prepare(
                `INSERT INTO friends (user_id, full_name, nickname, personal_notes, avatar_color, consent_given)
                 VALUES (?, ?, ?, ?, ?, 1)`
              )
              .run(
                user.id,
                detectedName,
                detectedName,
                "เพิ่มจากการเล่าเรื่องเพื่อน",
                color
              );
            friendId = Number(fRes.lastInsertRowid);
            newlyCreatedFriends.push({ id: friendId, nickname: detectedName });
          }
          createdByDetectedName.set(key, friendId);
        }
      }

      if (!friendId) continue;

      const cat = String(item.category_slug || "other_interests") as ExtractCategorySlug;
      const rawVal = String(item.raw_value || "").trim();
      const normInput = String(item.normalized_value || rawVal).trim();
      const normalized = normalizeInterestTerm(normInput, cat).normalized;
      const restrictionType =
        cat === "disliked_food"
          ? String(item.restriction_type || "dislike") === "allergy"
            ? "allergy"
            : "dislike"
          : null;

      let upsertRes: { inserted: boolean; skippedExisting: boolean };
      if (cat === "dietary_restriction") {
        upsertRes = upsertFriendDietaryRestriction(db, {
          friendId,
          label: normalized,
          source: "nlp_extraction",
          textInputId,
          preserveExisting: !Boolean(item.overwrite_existing),
        });
      } else {
        upsertRes = upsertFriendInterest(db, {
          friendId,
          categorySlug: cat as CategorySlug,
          normalizedValue: normalized,
          rawValue: rawVal || normalized,
          source: "nlp_extraction",
          textInputId,
          confidence: Number(item.confidence || 0.9),
          restrictionType,
          preserveExisting: !Boolean(item.overwrite_existing),
        });
        if (cat === "disliked_food" && restrictionType === "allergy") {
          upsertFriendDietaryRestriction(db, {
            friendId,
            label: mapAllergyToDietaryLabel(normalized),
            category: "allergy",
            source: "nlp_extraction",
            textInputId,
            preserveExisting: true,
          });
        }
      }

      if (upsertRes.inserted) {
        savedInterestsCount++;
      } else if (upsertRes.skippedExisting) {
        skippedExistingCount++;
      }

      if (extractedId) {
        db.prepare(
          `UPDATE extracted_data
           SET friend_id = ?, detected_friend_name = ?, category_slug = ?,
               raw_value = ?, normalized_value = ?,
               confidence = ?, restriction_type = ?,
               confirmation_status = 'confirmed',
               updated_at = datetime('now', 'localtime')
           WHERE id = ?`
        ).run(
          friendId,
          detectedName,
          cat,
          rawVal || normalized,
          normalized,
          Number(item.confidence || 0.9),
          restrictionType,
          extractedId
        );
      } else if (textInputId) {
        db.prepare(
          `INSERT INTO extracted_data (
            text_input_id, friend_id, detected_friend_name, category_slug,
            raw_value, normalized_value, confirmation_status,
            confidence, is_ambiguous, uncertainty_reason, restriction_type
          )
          VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, 0, NULL, ?)`
        ).run(
          textInputId,
          friendId,
          detectedName,
          cat,
          rawVal || normalized,
          normalized,
          Number(item.confidence || 0.95),
          restrictionType
        );
      }
    }

    let textInputStatus = "confirmed";
    if (textInputId) {
      const counts = db
        .prepare(
          `SELECT
             SUM(CASE WHEN confirmation_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
             SUM(CASE WHEN confirmation_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
             SUM(CASE WHEN confirmation_status = 'pending' THEN 1 ELSE 0 END) as pending_count
           FROM extracted_data
           WHERE text_input_id = ?`
        )
        .get(textInputId) as {
        confirmed_count: number | null;
        rejected_count: number | null;
        pending_count: number | null;
      };

      const conf = Number(counts?.confirmed_count || 0);
      const rej = Number(counts?.rejected_count || 0);
      const pend = Number(counts?.pending_count || 0);

      if (conf > 0 && rej === 0 && pend === 0) {
        textInputStatus = "confirmed";
      } else if (conf > 0) {
        textInputStatus = "partial";
      } else if (rej > 0 && pend === 0) {
        textInputStatus = "rejected";
      } else {
        textInputStatus = "pending_review";
      }

      db.prepare("UPDATE text_inputs SET status = ? WHERE id = ? AND user_id = ?").run(
        textInputStatus,
        textInputId,
        user.id
      );
    }

    db.exec("COMMIT");

    return NextResponse.json({
      ok: true,
      savedInterestsCount,
      skippedExistingCount,
      newlyCreatedFriends,
      textInputStatus,
    });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Confirm NLP error:", err);
    return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลที่สกัดได้" }, { status: 500 });
  }
}
