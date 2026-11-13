import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { setAuthCookie, signAuthToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    }


    const db = getDb();
    const user = db
      .prepare("SELECT id, name, email, password_hash, bio FROM users WHERE email = ?")
      .get(email) as
      | { id: number; name: string; email: string; password_hash: string; bio: string | null }
      | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }


    const token = signAuthToken(user.id, user.email);
    setAuthCookie(token);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, bio: user.bio },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" }, { status: 500 });
  }
}
