// Standalone CHUAN-DI Demo Seed & Verification Script
// Usage:
//   node scripts/seed.mjs            -> Inspect seeded database counts
//   node scripts/seed.mjs --reset    -> Safely reset demo@chuan-di.app via local server API

import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "chuan-di.db");
const shouldReset = process.argv.includes("--reset");
const baseUrl = process.env.BASE_URL || "http://localhost:3000";

async function resetViaApi() {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@chuan-di.app",
      password: "ChuanDiDemo123",
    }),
  });
  if (!loginRes.ok) {
    throw new Error(`Demo login failed (${loginRes.status}) at ${baseUrl}`);
  }
  const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];
  const resetRes = await fetch(`${baseUrl}/api/demo/reset`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
  });
  const payload = await resetRes.json().catch(() => ({}));
  if (!resetRes.ok) {
    throw new Error(`Demo reset failed (${resetRes.status}): ${JSON.stringify(payload)}`);
  }
  console.log("Reset completed:", payload.message);
}

async function main() {
  console.log("CHUAN-DI database path:", dbPath);

  if (shouldReset) {
    console.log(`Triggering safe demo reset against ${baseUrl}...`);
    await resetViaApi();
  }

  if (!fs.existsSync(dbPath)) {
    console.log(
      "Database file does not exist yet. Start the app (`npm run dev` or `npm run start`) and open /login or hit /api/auth/login to initialize and auto-seed."
    );
    return;
  }

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  const users = db.prepare("SELECT id, email, name FROM users ORDER BY id ASC").all();
  const demo = users.find((u) => u.email === "demo@chuan-di.app");

  if (!demo) {
    console.log("Demo account (demo@chuan-di.app) not found yet. Hit /api/auth/login to seed.");
    db.close();
    return;
  }

  const friendsCount = db
    .prepare("SELECT COUNT(*) as c FROM friends WHERE user_id = ?")
    .get(demo.id).c;
  const interestsCount = db
    .prepare(
      `SELECT COUNT(*) as c FROM friend_interests fi
       JOIN friends f ON f.id = fi.friend_id WHERE f.user_id = ?`
    )
    .get(demo.id).c;
  const segmentsCount = db
    .prepare("SELECT COUNT(*) as c FROM saved_segments WHERE user_id = ?")
    .get(demo.id).c;
  const activitiesCount = db
    .prepare("SELECT COUNT(*) as c FROM activities WHERE user_id = ?")
    .get(demo.id).c;
  const rsvpBreakdown = db
    .prepare(
      `SELECT ai.rsvp_status, COUNT(*) as c
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE a.user_id = ?
       GROUP BY ai.rsvp_status`
    )
    .all(demo.id);
  const extractedCount = db
    .prepare(
      `SELECT COUNT(*) as c FROM extracted_data ed
       JOIN text_inputs ti ON ti.id = ed.text_input_id
       WHERE ti.user_id = ?`
    )
    .get(demo.id).c;

  console.log("Demo account summary (demo@chuan-di.app):", {
    totalUsersInDb: users.length,
    friendsCount,
    interestsCount,
    savedSegmentsCount: segmentsCount,
    activitiesCount,
    rsvpBreakdown,
    extractedTraceabilityRows: extractedCount,
  });
  db.close();
}

main().catch((err) => {
  console.error("Seed script error:", err.message || err);
  process.exit(1);
});
