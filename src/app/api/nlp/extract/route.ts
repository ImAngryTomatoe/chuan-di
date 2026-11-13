import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { extractInterestsFromText } from "@/lib/nlp";

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const rawText = String(body.rawText || "").trim();
    const sourceLabel = String(body.sourceLabel || "ป้อนข้อความด้วยตนเอง").trim();

    if (!rawText) {
      return NextResponse.json({ error: "กรุณาพิมพ์ข้อความเล่าเรื่องเพื่อนก่อนนะ" }, { status: 400 });
    }

    const extraction = await extractInterestsFromText(rawText);
    const db = getDb();

    const tiRes = db
      .prepare(
        "INSERT INTO text_inputs (user_id, raw_text, source_label, extraction_mode, status) VALUES (?, ?, ?, ?, 'pending_review')"
      )
      .run(user.id, rawText, sourceLabel, extraction.mode);
    const textInputId = Number(tiRes.lastInsertRowid);

    const existingFriends = db
      .prepare("SELECT id, full_name, nickname FROM friends WHERE user_id = ?")
      .all(user.id) as unknown as Array<{ id: number; full_name: string; nickname: string }>;

    const existingLinks = db
      .prepare(
        `SELECT fi.friend_id, ic.slug as category_slug, LOWER(i.normalized_value) as norm_lower
         FROM friend_interests fi
         JOIN friends f ON f.id = fi.friend_id
         JOIN interests i ON i.id = fi.interest_id
         JOIN interest_categories ic ON ic.id = i.category_id
         WHERE f.user_id = ?`
      )
      .all(user.id) as unknown as Array<{
      friend_id: number;
      category_slug: string;
      norm_lower: string;
    }>;

    const existingDietaryLinks = db
      .prepare(
        `SELECT fdr.friend_id, LOWER(fdr.restriction_label) as norm_lower
         FROM friend_dietary_restrictions fdr
         JOIN friends f ON f.id = fdr.friend_id
         WHERE f.user_id = ?`
      )
      .all(user.id) as unknown as Array<{
      friend_id: number;
      norm_lower: string;
    }>;

    const existingLinkSet = new Set([
      ...existingLinks.map((l) => `${l.friend_id}:${l.category_slug}:${l.norm_lower}`),
      ...existingDietaryLinks.map((l) => `${l.friend_id}:dietary_restriction:${l.norm_lower}`),
    ]);

    const insertDraft = db.prepare(`
      INSERT INTO extracted_data (
        text_input_id, friend_id, detected_friend_name, category_slug,
        raw_value, normalized_value, confirmation_status,
        confidence, is_ambiguous, uncertainty_reason, restriction_type
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `);

    const drafts = extraction.items.map((item, idx) => {
      const lowerName = item.friendName.toLowerCase();
      const matched = existingFriends.find(
        (f) =>
          f.nickname.toLowerCase() === lowerName ||
          f.full_name.toLowerCase() === lowerName ||
          f.full_name.toLowerCase().startsWith(lowerName + " ")
      );

      const alreadyExists = matched
        ? existingLinkSet.has(
            `${matched.id}:${item.category}:${item.normalizedValue.toLowerCase()}`
          )
        : false;

      const edRes = insertDraft.run(
        textInputId,
        matched?.id ?? null,
        item.friendName,
        item.category,
        item.rawValue,
        item.normalizedValue,
        item.confidence,
        item.isAmbiguous ? 1 : 0,
        item.uncertaintyReason,
        item.restrictionType
      );

      return {
        extractedId: Number(edRes.lastInsertRowid),
        tempId: `draft-${idx}-${Date.now()}`,
        detected_friend_name: item.friendName,
        matched_friend_id: matched?.id ?? null,
        matched_friend_name: matched ? matched.nickname : null,
        category_slug: item.category,
        raw_value: item.rawValue,
        normalized_value: item.normalizedValue,
        confidence: item.confidence,
        is_ambiguous: item.isAmbiguous,
        uncertainty_reason: item.uncertaintyReason,
        restriction_type: item.restrictionType,
        already_exists: alreadyExists,
        overwrite_existing: false,
        selected: !item.isAmbiguous,
      };
    });

    return NextResponse.json({
      textInputId,
      mode: extraction.mode,
      warnings: extraction.warnings,
      items: drafts,
      existingFriends,
    });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสกัดข้อมูล" }, { status: 500 });
  }
}
