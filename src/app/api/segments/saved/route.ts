import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RawSavedSegmentRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  include_interests_json: string;
  exclude_interests_json: string;
  category_filter: string | null;
  match_mode: string;
  created_at: string;
  updated_at: string;
}

function formatSegmentRow(row: RawSavedSegmentRow) {
  let includeInterests: string[] = [];
  let excludeInterests: string[] = [];
  try {
    includeInterests = JSON.parse(row.include_interests_json || "[]");
  } catch {
    includeInterests = [];
  }
  try {
    excludeInterests = JSON.parse(row.exclude_interests_json || "[]");
  } catch {
    excludeInterests = [];
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    include_interests: Array.isArray(includeInterests) ? includeInterests : [],
    exclude_interests: Array.isArray(excludeInterests) ? excludeInterests : [],
    category_filter: row.category_filter || "",
    match_mode: row.match_mode === "all" ? "all" : "any",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM saved_segments
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`
    )
    .all(user.id) as unknown as RawSavedSegmentRow[];

  return NextResponse.json({
    segments: rows.map(formatSegmentRow),
  });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "กรุณาตั้งชื่อกลุ่มเพื่อน" }, { status: 400 });
    }

    const description = body.description ? String(body.description).trim() : null;
    const includeInterests = Array.isArray(body.include_interests)
      ? body.include_interests.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];
    const excludeInterests = Array.isArray(body.exclude_interests)
      ? body.exclude_interests.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];
    const categoryFilter = body.category_filter ? String(body.category_filter).trim() : "";
    const matchMode = body.match_mode === "all" ? "all" : "any";

    const db = getDb();
    const res = db
      .prepare(
        `INSERT INTO saved_segments (
           user_id, name, description, include_interests_json, exclude_interests_json,
           category_filter, match_mode
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        user.id,
        name,
        description,
        JSON.stringify(includeInterests),
        JSON.stringify(excludeInterests),
        categoryFilter,
        matchMode
      );

    const created = db
      .prepare("SELECT * FROM saved_segments WHERE id = ?")
      .get(Number(res.lastInsertRowid)) as unknown as RawSavedSegmentRow;

    return NextResponse.json({ segment: formatSegmentRow(created) }, { status: 201 });
  } catch (err) {
    console.error("Save segment error:", err);
    return NextResponse.json({ error: "ไม่สามารถบันทึกกลุ่มเพื่อนได้" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let idParam = searchParams.get("id");
  if (!idParam) {
    try {
      const body = await req.json();
      if (body?.id) idParam = String(body.id);
    } catch {
      // ignore empty body
    }
  }

  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Missing or invalid segment id" }, { status: 400 });
  }

  const db = getDb();
  const res = db
    .prepare("DELETE FROM saved_segments WHERE id = ? AND user_id = ?")
    .run(id, user.id);

  if (Number(res.changes || 0) === 0) {
    return NextResponse.json({ error: "ไม่พบกลุ่มที่ต้องการลบ" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
