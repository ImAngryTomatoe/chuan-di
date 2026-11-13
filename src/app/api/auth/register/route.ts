import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { setAuthCookie, signAuthToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");


    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const res = db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name, email, hash);

    const userId = Number(res.lastInsertRowid);
    const token = signAuthToken(userId, email);
    setAuthCookie(token);

    return NextResponse.json(
      { user: { id: userId, name, email } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "ไม่สามารถสมัครสมาชิกได้" }, { status: 500 });
  }
}
