import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureUserSelfProfile,
  getDb,
  getFriendsWithInterests,
  linkFriendBetweenUsers,
} from "@/lib/db";

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  ensureUserSelfProfile(db, user.id);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const incomingRequests = db
    .prepare(
      `SELECT fr.id, fr.sender_user_id, fr.receiver_user_id, fr.status, fr.message,
              fr.created_at, fr.responded_at,
              u.id AS other_user_id, u.name AS other_name, u.email AS other_email,
              COALESCE(NULLIF(up.nickname, ''), u.name) AS other_nickname,
              COALESCE(NULLIF(up.avatar_color, ''), '#D69DAE') AS other_avatar_color
       FROM friend_requests fr
       JOIN users u ON u.id = fr.sender_user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE fr.receiver_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.id DESC`
    )
    .all(user.id);

  const outgoingRequests = db
    .prepare(
      `SELECT fr.id, fr.sender_user_id, fr.receiver_user_id, fr.status, fr.message,
              fr.created_at, fr.responded_at,
              u.id AS other_user_id, u.name AS other_name, u.email AS other_email,
              COALESCE(NULLIF(up.nickname, ''), u.name) AS other_nickname,
              COALESCE(NULLIF(up.avatar_color, ''), '#D69DAE') AS other_avatar_color
       FROM friend_requests fr
       JOIN users u ON u.id = fr.receiver_user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE fr.sender_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.id DESC`
    )
    .all(user.id);

  const linkedRows = db
    .prepare("SELECT id, linked_user_id FROM friends WHERE user_id = ? AND linked_user_id IS NOT NULL")
    .all(user.id) as Array<{ id: number; linked_user_id: number }>;
  const linkedMap = new Map<number, number>();
  for (const r of linkedRows) linkedMap.set(r.linked_user_id, r.id);

  const outgoingByUser = new Map<number, number>();
  for (const r of outgoingRequests as Array<{ id: number; other_user_id: number }>) {
    outgoingByUser.set(r.other_user_id, r.id);
  }
  const incomingByUser = new Map<number, number>();
  for (const r of incomingRequests as Array<{ id: number; other_user_id: number }>) {
    incomingByUser.set(r.other_user_id, r.id);
  }

  let users: Array<{
    user_id: number;
    name: string;
    nickname: string;
    email: string;
    avatar_color: string;
    connection_status: "connected" | "outgoing_pending" | "incoming_pending" | "none";
    friend_id: number | null;
    pending_request_id: number | null;
  }> = [];

  if (q.length >= 1) {
    const likeTerm = `%${q}%`;
    const candidates = db
      .prepare(
        `SELECT u.id AS user_id, u.name, u.email,
                COALESCE(NULLIF(up.nickname, ''), u.name) AS nickname,
                COALESCE(NULLIF(up.avatar_color, ''), '#D69DAE') AS avatar_color
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id != ?
           AND (LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(COALESCE(up.nickname, '')) LIKE ? OR LOWER(COALESCE(up.full_name, '')) LIKE ?)
         ORDER BY
           CASE WHEN LOWER(u.email) = ? THEN 0 ELSE 1 END,
           u.id ASC
         LIMIT 15`
      )
      .all(user.id, likeTerm, likeTerm, likeTerm, likeTerm, q) as Array<{
      user_id: number;
      name: string;
      email: string;
      nickname: string;
      avatar_color: string;
    }>;

    users = candidates.map((c) => {
      const connectedFriendId = linkedMap.get(c.user_id) ?? null;
      const outReqId = outgoingByUser.get(c.user_id) ?? null;
      const inReqId = incomingByUser.get(c.user_id) ?? null;
      return {
        ...c,
        connection_status: connectedFriendId
          ? "connected"
          : outReqId
          ? "outgoing_pending"
          : inReqId
          ? "incoming_pending"
          : "none",
        friend_id: connectedFriendId,
        pending_request_id: outReqId ?? inReqId ?? null,
      };
    });
  }

  return NextResponse.json({
    users,
    incomingRequests,
    outgoingRequests,
  });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  ensureUserSelfProfile(db, user.id);

  try {
    const body = await req.json();
    const action = String(body.action || "request").trim();

    if (action === "request") {
      const targetUserId = body.targetUserId ? Number(body.targetUserId) : null;
      const targetEmail = body.targetEmail ? String(body.targetEmail).trim().toLowerCase() : "";
      const message = body.message ? String(body.message).trim().slice(0, 200) : null;

      let target: { id: number; name: string; email: string } | undefined;
      if (targetUserId) {
        target = db
          .prepare("SELECT id, name, email FROM users WHERE id = ?")
          .get(targetUserId) as { id: number; name: string; email: string } | undefined;
      } else if (targetEmail) {
        target = db
          .prepare("SELECT id, name, email FROM users WHERE LOWER(email) = ?")
          .get(targetEmail) as { id: number; name: string; email: string } | undefined;
      }

      if (!target) {
        return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้นี้ในระบบ CHUAN-DI" }, { status: 404 });
      }
      if (target.id === user.id) {
        return NextResponse.json({ error: "ไม่สามารถแอดบัญชีตัวเองเป็นเพื่อนได้" }, { status: 400 });
      }

      const alreadyFriend = db
        .prepare("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?")
        .get(user.id, target.id) as { id: number } | undefined;
      if (alreadyFriend) {
        return NextResponse.json(
          { error: "คุณเชื่อมต่อเป็นเพื่อนกับผู้ใช้นี้แล้ว", friendId: alreadyFriend.id },
          { status: 409 }
        );
      }

      // If target already sent an incoming pending request, accept both sides automatically
      const reverseReq = db
        .prepare(
          "SELECT id FROM friend_requests WHERE sender_user_id = ? AND receiver_user_id = ? AND status = 'pending'"
        )
        .get(target.id, user.id) as { id: number } | undefined;

      if (reverseReq) {
        db.exec("BEGIN TRANSACTION");
        db.prepare(
          "UPDATE friend_requests SET status = 'accepted', responded_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(reverseReq.id);
        const myFriendId = linkFriendBetweenUsers(db, user.id, target.id);
        linkFriendBetweenUsers(db, target.id, user.id);
        db.exec("COMMIT");

        const friend = getFriendsWithInterests(user.id).find((f) => f.id === myFriendId);
        return NextResponse.json({ ok: true, status: "accepted", friend });
      }

      const existingOutgoing = db
        .prepare("SELECT id, status FROM friend_requests WHERE sender_user_id = ? AND receiver_user_id = ?")
        .get(user.id, target.id) as { id: number; status: string } | undefined;

      if (existingOutgoing && existingOutgoing.status === "pending") {
        return NextResponse.json(
          { ok: true, status: "pending", requestId: existingOutgoing.id, alreadyPending: true },
          { status: 200 }
        );
      }

      let requestId: number;
      if (existingOutgoing) {
        db.prepare(
          `UPDATE friend_requests
           SET status = 'pending', message = ?, responded_at = NULL, created_at = datetime('now', 'localtime')
           WHERE id = ?`
        ).run(message, existingOutgoing.id);
        requestId = existingOutgoing.id;
      } else {
        const res = db
          .prepare(
            `INSERT INTO friend_requests (sender_user_id, receiver_user_id, status, message)
             VALUES (?, ?, 'pending', ?)`
          )
          .run(user.id, target.id, message);
        requestId = Number(res.lastInsertRowid);
      }

      return NextResponse.json(
        {
          ok: true,
          status: "pending",
          request: {
            id: requestId,
            sender_user_id: user.id,
            receiver_user_id: target.id,
            target_email: target.email,
            target_name: target.name,
          },
        },
        { status: 201 }
      );
    }

    if (action === "accept") {
      const requestId = Number(body.requestId);
      const reqRow = db
        .prepare("SELECT id, sender_user_id, receiver_user_id, status FROM friend_requests WHERE id = ?")
        .get(requestId) as
        | { id: number; sender_user_id: number; receiver_user_id: number; status: string }
        | undefined;

      if (!reqRow || reqRow.receiver_user_id !== user.id) {
        return NextResponse.json({ error: "ไม่พบคำขอเป็นเพื่อนนี้" }, { status: 404 });
      }
      if (reqRow.status !== "pending") {
        return NextResponse.json({ error: "คำขอนี้ถูกดำเนินการไปแล้ว" }, { status: 400 });
      }

      db.exec("BEGIN TRANSACTION");
      db.prepare(
        "UPDATE friend_requests SET status = 'accepted', responded_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(reqRow.id);
      const myFriendId = linkFriendBetweenUsers(db, user.id, reqRow.sender_user_id);
      linkFriendBetweenUsers(db, reqRow.sender_user_id, user.id);
      db.exec("COMMIT");

      const friend = getFriendsWithInterests(user.id).find((f) => f.id === myFriendId);
      return NextResponse.json({ ok: true, status: "accepted", friend });
    }

    if (action === "reject") {
      const requestId = Number(body.requestId);
      const res = db
        .prepare(
          `UPDATE friend_requests
           SET status = 'rejected', responded_at = datetime('now', 'localtime')
           WHERE id = ? AND receiver_user_id = ? AND status = 'pending'`
        )
        .run(requestId, user.id);
      if (res.changes === 0) {
        return NextResponse.json({ error: "ไม่พบคำขอที่รอตอบรับ" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (action === "cancel") {
      const requestId = Number(body.requestId);
      const res = db
        .prepare(
          "DELETE FROM friend_requests WHERE id = ? AND sender_user_id = ? AND status = 'pending'"
        )
        .run(requestId, user.id);
      if (res.changes === 0) {
        return NextResponse.json({ error: "ไม่พบคำขอที่ส่งไว้" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("Friend connect error:", err);
    return NextResponse.json({ error: "ไม่สามารถดำเนินการคำขอเป็นเพื่อนได้" }, { status: 500 });
  }
}
