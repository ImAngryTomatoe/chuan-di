import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const inputs = db
    .prepare(
      `SELECT id, raw_text, source_label, extraction_mode, status, created_at
       FROM text_inputs
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`
    )
    .all(user.id) as unknown as Array<{
    id: number;
    raw_text: string;
    source_label: string;
    extraction_mode: string;
    status: string;
    created_at: string;
  }>;

  const extractedRows = db
    .prepare(
      `SELECT ed.*, ti.raw_text as input_raw_text, ti.source_label,
              f.nickname as friend_nickname, f.full_name as friend_full_name
       FROM extracted_data ed
       JOIN text_inputs ti ON ti.id = ed.text_input_id
       LEFT JOIN friends f ON f.id = ed.friend_id
       WHERE ti.user_id = ?
       ORDER BY ed.id DESC
       LIMIT 120`
    )
    .all(user.id);

  return NextResponse.json({ inputs, extractedRows });
}
