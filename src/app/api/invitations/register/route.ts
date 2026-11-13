import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const label = String(body.label || "ลิงก์เชิญเพื่อนร่วมเครือข่าย CHUAN-DI").trim();
  const target_friend_name = body.target_friend_name
    ? String(body.target_friend_name).trim()
    : null;
  const prefill_friend_id = body.prefill_friend_id ? Number(body.prefill_friend_id) : null;

  const db = getDb();
  let resolvedName = target_friend_name;
  if (prefill_friend_id) {
    const friend = db
      .prepare("SELECT id, nickname FROM friends WHERE id = ? AND user_id = ?")
      .get(prefill_friend_id, user.id) as { id: number; nickname: string } | undefined;
    if (!friend) {
      return NextResponse.json({ error: "ไม่พบข้อมูลเพื่อน" }, { status: 404 });
    }
    resolvedName = resolvedName || friend.nickname;
  }

  const token = `join-${crypto.randomBytes(12).toString("hex")}`;
  const res = db
    .prepare(
      `INSERT INTO registration_invitations (user_id, invite_token, label, target_friend_name, prefill_friend_id, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .run(user.id, token, label, resolvedName, prefill_friend_id);

  const created = db
    .prepare("SELECT * FROM registration_invitations WHERE id = ?")
    .get(Number(res.lastInsertRowid));

  return NextResponse.json({ invitation: created }, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM registration_invitations WHERE id = ? AND user_id = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}
