import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getBangkokToday,
  isValidDateStr,
  isValidTimeStr,
  timeToMinutes,
} from "@/lib/calendar";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const db = getDb();

  const weeklyRules = db
    .prepare(
      `SELECT id, weekday, status, start_time, end_time, note, updated_at
       FROM user_weekly_availability
       WHERE user_id = ?
       ORDER BY weekday ASC`
    )
    .all(user.id);

  let dateOverrides;
  if (isValidDateStr(startDate) && isValidDateStr(endDate) && startDate <= endDate) {
    dateOverrides = db
      .prepare(
        `SELECT id, avail_date, status, start_time, end_time, note, updated_at
         FROM user_date_availability
         WHERE user_id = ? AND avail_date BETWEEN ? AND ?
         ORDER BY avail_date ASC`
      )
      .all(user.id, startDate, endDate);
  } else {
    dateOverrides = db
      .prepare(
        `SELECT id, avail_date, status, start_time, end_time, note, updated_at
         FROM user_date_availability
         WHERE user_id = ?
         ORDER BY avail_date ASC`
      )
      .all(user.id);
  }

  return NextResponse.json({
    today: getBangkokToday(),
    timezone: "Asia/Bangkok",
    weeklyRules,
    dateOverrides,
  });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 });
  }

  const kind = String(body.kind || "");
  const db = getDb();

  if (kind === "weekly") {
    const weekday = Number(body.weekday);
    const status = String(body.status || "");
    const startTime = String(body.start_time || "09:00").trim();
    const endTime = String(body.end_time || "21:00").trim();
    const note = body.note != null ? String(body.note).trim().slice(0, 200) : null;

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: "วันประจำสัปดาห์ต้องเป็น 0–6" }, { status: 400 });
    }
    if (status !== "available" && status !== "unavailable") {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }
    if (!isValidTimeStr(startTime) || !isValidTimeStr(endTime)) {
      return NextResponse.json({ error: "รูปแบบเวลาต้องเป็น HH:MM" }, { status: 400 });
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return NextResponse.json({ error: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น" }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO user_weekly_availability (user_id, weekday, status, start_time, end_time, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(user_id, weekday) DO UPDATE SET
        status = excluded.status,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        note = excluded.note,
        updated_at = datetime('now', 'localtime')
    `).run(user.id, weekday, status, startTime, endTime, note || null);

    const rule = db
      .prepare(
        "SELECT id, weekday, status, start_time, end_time, note, updated_at FROM user_weekly_availability WHERE user_id = ? AND weekday = ?"
      )
      .get(user.id, weekday);

    return NextResponse.json({ ok: true, rule });
  }

  if (kind === "date") {
    const availDate = String(body.avail_date || "").trim();
    const status = String(body.status || "");
    const startTime = String(body.start_time || "09:00").trim();
    const endTime = String(body.end_time || "21:00").trim();
    const note = body.note != null ? String(body.note).trim().slice(0, 200) : null;

    if (!isValidDateStr(availDate)) {
      return NextResponse.json({ error: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" }, { status: 400 });
    }
    if (status !== "available" && status !== "unavailable" && status !== "unknown") {
      return NextResponse.json({ error: "สถานะต้องเป็น available, unavailable หรือ unknown" }, { status: 400 });
    }
    if (!isValidTimeStr(startTime) || !isValidTimeStr(endTime)) {
      return NextResponse.json({ error: "รูปแบบเวลาต้องเป็น HH:MM" }, { status: 400 });
    }
    if (status !== "unknown" && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return NextResponse.json({ error: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น" }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO user_date_availability (user_id, avail_date, status, start_time, end_time, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(user_id, avail_date) DO UPDATE SET
        status = excluded.status,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        note = excluded.note,
        updated_at = datetime('now', 'localtime')
    `).run(user.id, availDate, status, startTime, endTime, note || null);

    const entry = db
      .prepare(
        "SELECT id, avail_date, status, start_time, end_time, note, updated_at FROM user_date_availability WHERE user_id = ? AND avail_date = ?"
      )
      .get(user.id, availDate);

    return NextResponse.json({ ok: true, entry });
  }

  return NextResponse.json({ error: "กรุณาระบุ kind เป็น weekly หรือ date" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") || "";
  const db = getDb();

  if (kind === "weekly") {
    const weekday = Number(searchParams.get("weekday"));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: "วันประจำสัปดาห์ไม่ถูกต้อง" }, { status: 400 });
    }
    db.prepare("DELETE FROM user_weekly_availability WHERE user_id = ? AND weekday = ?").run(
      user.id,
      weekday
    );
    return NextResponse.json({ ok: true });
  }

  if (kind === "date") {
    const dateStr = (searchParams.get("date") || "").trim();
    if (!isValidDateStr(dateStr)) {
      return NextResponse.json({ error: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }
    db.prepare("DELETE FROM user_date_availability WHERE user_id = ? AND avail_date = ?").run(
      user.id,
      dateStr
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "กรุณาระบุ kind เป็น weekly หรือ date" }, { status: 400 });
}
