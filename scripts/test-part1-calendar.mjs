import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";

class Client {
  constructor() {
    this.cookie = "";
  }

  async req(urlPath, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${BASE}${urlPath}`, {
      ...options,
      headers,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }
}

async function run() {
  const anon = new Client();
  const demo = new Client();
  const userA = new Client();
  const userB = new Client();
  const stamp = Date.now();

  console.log("1. Verifying unauthenticated calendar endpoints return 401...");
  assert.equal((await anon.req("/api/calendar/availability")).status, 401);
  assert.equal(
    (
      await anon.req("/api/calendar/availability", {
        method: "POST",
        body: JSON.stringify({
          kind: "date",
          avail_date: "2026-11-21",
          status: "available",
          start_time: "10:00",
          end_time: "18:00",
        }),
      })
    ).status,
    401
  );
  assert.equal((await anon.req("/api/calendar/match")).status, 401);
  assert.equal(
    (
      await anon.req("/api/calendar/match", {
        method: "POST",
        body: JSON.stringify({ friendIds: [1] }),
      })
    ).status,
    401
  );

  console.log("2. Verifying seeded demo account smart calendar & Asia/Bangkok timezone...");
  const loginRes = await demo.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "demo@chuan-di.app",
      password: "ChuanDiDemo123",
    }),
  });
  assert.equal(loginRes.status, 200, "Demo login failed");

  const initialMatch = await demo.req("/api/calendar/match");
  assert.equal(initialMatch.status, 200);
  const initData = initialMatch.json;
  assert.equal(initData.timezone, "Asia/Bangkok");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(initData.today), "Expected YYYY-MM-DD today");
  assert.ok(initData.friendsCatalog.length >= 20, "Expected seeded demo friends");
  assert.ok(initData.interestGroups.length > 0, "Expected interest groups from DB");
  assert.ok(initData.matches.length > 0, "Expected matched days on initial load");

  // Verify sorting: descending availableCount
  for (let i = 1; i < initData.matches.length; i++) {
    assert.ok(
      initData.matches[i - 1].availableCount >= initData.matches[i].availableCount,
      "Matches must be sorted descending by available friend count"
    );
  }

  console.log("3. Verifying Rule #9: friends without shared calendar MUST be 'ยังไม่ทราบ', never 'ว่าง'...");
  const unsharedFriends = initData.friendsCatalog.filter((f) => !f.is_shared);
  assert.ok(unsharedFriends.length >= 5, "Expected unshared demo friends for 3-state proof");
  const unsharedIds = unsharedFriends.slice(0, 3).map((f) => f.id);

  const unsharedAllAvail = await demo.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: unsharedIds,
      dateFilter: "all_available",
      timeFilter: "all",
    }),
  });
  assert.equal(unsharedAllAvail.status, 200);
  assert.equal(
    unsharedAllAvail.json.matches.length,
    0,
    "Unshared friends MUST NOT produce available matches under 'all_available'"
  );
  assert.ok(
    unsharedAllAvail.json.gridDays.every(
      (d) => d.availableCount === 0 && d.unknownCount === unsharedIds.length
    ),
    "Every unshared friend must have status 'unknown' on every day"
  );

  console.log("4. Verifying date dropdown filters & time slot filters...");
  const sharedFriends = initData.friendsCatalog.filter((f) => f.is_shared);
  assert.ok(sharedFriends.length >= 8, "Expected shared demo friends");
  const sharedIds = sharedFriends.slice(0, 5).map((f) => f.id);

  // Weekend filter
  const weekendRes = await demo.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: sharedIds,
      dateFilter: "weekend",
      timeFilter: "all",
    }),
  });
  assert.equal(weekendRes.status, 200);
  assert.ok(weekendRes.json.matches.length > 0);
  assert.ok(
    weekendRes.json.matches.every((d) => d.weekday === 0 || d.weekday === 6),
    "Weekend filter must only return Saturday (6) or Sunday (0)"
  );

  // Evening filter vs Khowfang (only free 10:00-17:00 Sat/Sun -> unknown in evening 17:00-22:00)
  const khowfang = initData.friendsCatalog.find((f) => f.nickname === "ข้าวฟ่าง");
  assert.ok(khowfang, "Expected ข้าวฟ่าง in catalog");
  const khowfangEvening = await demo.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: [khowfang.id],
      dateFilter: "weekend",
      timeFilter: "evening",
      includeSelf: false,
    }),
  });
  assert.equal(khowfangEvening.status, 200);
  assert.equal(
    khowfangEvening.json.matches.length,
    0,
    "ข้าวฟ่าง (10:00-17:00) must NOT match evening window (17:00-22:00)"
  );

  const khowfangAfternoon = await demo.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: [khowfang.id],
      dateFilter: "weekend",
      timeFilter: "afternoon",
      includeSelf: false,
    }),
  });
  assert.equal(khowfangAfternoon.status, 200);
  assert.ok(
    khowfangAfternoon.json.matches.length > 0,
    "ข้าวฟ่าง must match afternoon window (12:00-17:00)"
  );

  // Next month + custom time
  const nextMonthRes = await demo.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: sharedIds,
      dateFilter: "next_month",
      timeFilter: "custom",
      customStartTime: "13:30",
      customEndTime: "17:00",
    }),
  });
  assert.equal(nextMonthRes.status, 200);
  assert.ok(nextMonthRes.json.matches.length > 0);

  console.log("5. Verifying isolated user CRUD, weekly recurring rules, & cross-user access control (403)...");
  const regA = await userA.req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: `CalUserA ${stamp}`,
      email: `cal.a.${stamp}@chuan-di.app`,
      password: "Password1234",
    }),
  });
  assert.equal(regA.status, 201);

  const regB = await userB.req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: `CalUserB ${stamp}`,
      email: `cal.b.${stamp}@chuan-di.app`,
      password: "Password1234",
    }),
  });
  assert.equal(regB.status, 201);

  const createFriendA = await userA.req("/api/friends", {
    method: "POST",
    body: JSON.stringify({
      full_name: "เพื่อนทดสอบไม่มีปฏิทิน",
      nickname: "โนแคล",
      religion: "พุทธ",
      interests: [{ category_slug: "food_preferences", value: "ชาบู" }],
    }),
  });
  assert.equal(createFriendA.status, 201);
  const friendAId = createFriendA.json.friend.id;

  // User B tries to inspect User A's friend calendar -> MUST get 403
  const forbiddenCheck = await userB.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({ friendIds: [friendAId] }),
  });
  assert.equal(
    forbiddenCheck.status,
    403,
    `Cross-user calendar query must return 403, got ${forbiddenCheck.status}`
  );

  // User A sets weekly recurring Saturday rule + specific date unavailable override
  const badRule = await userA.req("/api/calendar/availability", {
    method: "POST",
    body: JSON.stringify({
      kind: "weekly",
      weekday: 6,
      status: "available",
      start_time: "18:00",
      end_time: "12:00",
    }),
  });
  assert.equal(badRule.status, 400, "Invalid time range must return 400");

  const saveWeekly = await userA.req("/api/calendar/availability", {
    method: "POST",
    body: JSON.stringify({
      kind: "weekly",
      weekday: 6,
      status: "available",
      start_time: "09:30",
      end_time: "20:00",
      note: "ว่างทุกวันเสาร์",
    }),
  });
  assert.equal(saveWeekly.status, 200);

  // Find a Saturday inside next 14 days from userA's match endpoint
  const matchA1 = await userA.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: [friendAId],
      dateFilter: "14d",
      timeFilter: "all",
      gridStartDate: initData.today,
      gridEndDate: "2026-12-10",
    }),
  });
  assert.equal(matchA1.status, 200);
  const saturdays = matchA1.json.gridDays.filter((d) => d.weekday === 6);
  assert.ok(saturdays.length >= 2, "Expected Saturdays in grid");
  assert.ok(
    saturdays.every((s) => s.selfStatus === "available" && s.unknownCount === 1 && s.availableCount === 0),
    "Recurring Saturday rule must mark self available while unshared friend remains unknown"
  );

  // Override first Saturday as unavailable -> must override weekly rule without affecting next Saturday
  const firstSatDate = saturdays[0].date;
  const secondSatDate = saturdays[1].date;
  const saveOverride = await userA.req("/api/calendar/availability", {
    method: "POST",
    body: JSON.stringify({
      kind: "date",
      avail_date: firstSatDate,
      status: "unavailable",
      start_time: "08:00",
      end_time: "22:00",
      note: "ติดสัมมนาวันเสาร์นี้",
    }),
  });
  assert.equal(saveOverride.status, 200);

  const matchA2 = await userA.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: [friendAId],
      dateFilter: "14d",
      timeFilter: "all",
      gridStartDate: firstSatDate,
      gridEndDate: secondSatDate,
    }),
  });
  assert.equal(matchA2.status, 200);
  const sat1After = matchA2.json.gridDays.find((d) => d.date === firstSatDate);
  const sat2After = matchA2.json.gridDays.find((d) => d.date === secondSatDate);
  assert.equal(sat1After.selfStatus, "unavailable", "Specific date override must override weekly rule");
  assert.equal(sat2After.selfStatus, "available", "Next Saturday must keep weekly rule");

  // Delete override -> first Saturday reverts back to available from weekly rule
  const delOverride = await userA.req(
    `/api/calendar/availability?kind=date&date=${encodeURIComponent(firstSatDate)}`,
    { method: "DELETE" }
  );
  assert.equal(delOverride.status, 200);

  const matchA3 = await userA.req("/api/calendar/match", {
    method: "POST",
    body: JSON.stringify({
      friendIds: [friendAId],
      dateFilter: "14d",
      gridStartDate: firstSatDate,
      gridEndDate: firstSatDate,
    }),
  });
  assert.equal(matchA3.json.gridDays[0].selfStatus, "available");

  console.log("6. Verifying end-to-end activity creation using matched calendar slot & times...");
  const bestDemoDay = initData.matches[0];
  assert.ok(bestDemoDay && bestDemoDay.overlapStartTime && bestDemoDay.overlapEndTime);
  const createAct = await userA.req("/api/activities", {
    method: "POST",
    body: JSON.stringify({
      title: "นัดชาบูตามวันว่างตรงกัน",
      description: "สร้างจาก Smart Friend Calendar",
      category: "อาหารและสังสรรค์",
      activity_date: bestDemoDay.date,
      start_time: bestDemoDay.overlapStartTime,
      end_time: bestDemoDay.overlapEndTime,
      location: "อารีย์",
      target_interests: ["ชาบู"],
      friend_ids: [friendAId],
    }),
  });
  assert.equal(createAct.status, 201, `Activity creation failed: ${JSON.stringify(createAct.json)}`);
  assert.equal(createAct.json.activity.activity_date, bestDemoDay.date);
  assert.equal(createAct.json.activity.start_time, bestDemoDay.overlapStartTime);

  console.log("ALL PART 1 SMART FRIEND CALENDAR TESTS PASSED!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
