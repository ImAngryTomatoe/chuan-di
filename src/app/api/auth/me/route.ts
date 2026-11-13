import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user,
    aiStatus: {
      hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
      hasGemini: Boolean(process.env.GEMINI_API_KEY),
    },
  });
}

export async function PATCH(req: Request) {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body.name || user.name).trim();
  const bio = String(body.bio ?? user.bio ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "กรุณาระบุชื่อ" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE users SET name = ?, bio = ? WHERE id = ?").run(name, bio, user.id);

  return NextResponse.json({ user: { ...user, name, bio } });
}
