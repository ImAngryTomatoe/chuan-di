import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
    return { status: res.status, json, headers: res.headers };
  }
}

async function run() {
  const demo = new Client();
  const prodUser = new Client();
  const stamp = Date.now();
  const prodEmail = `phase4-prod-${stamp}@example.test`;

  const createdActivityIds = [];
  const createdFriendIds = [];
  const createdTextInputIds = [];

  try {
    console.log("1. Logging in using demo account (demo@chuan-di.app)...");
    const login = await demo.req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "demo@chuan-di.app",
        password: "ChuanDiDemo123",
      }),
    });
    assert.equal(login.status, 200, "Demo account login failed");

    console.log("2. Verifying complete demo dataset & initial Dashboard metrics...");
    const friendsList = await demo.req("/api/friends");
    assert.equal(friendsList.status, 200);
    assert.ok(
      friendsList.json.friends.length >= 20,
      `Expected >= 20 demo friends, got ${friendsList.json.friends.length}`
    );

    const dashBeforeRes = await demo.req("/api/dashboard");
    assert.equal(dashBeforeRes.status, 200);
    const dashBefore = dashBeforeRes.json;

    assert.ok(dashBefore.summary.totalFriends >= 20);
    assert.ok(dashBefore.summary.totalRecordedInterests > 50);
    assert.ok(dashBefore.summary.totalActivities >= 5);
    assert.ok(dashBefore.summary.rsvpSummary.going > 0, "Expected seeded going RSVPs");
    assert.ok(dashBefore.summary.rsvpSummary.notGoing > 0, "Expected seeded not_going RSVPs");
    assert.ok(dashBefore.summary.rsvpSummary.pending > 0, "Expected seeded pending RSVPs");
    assert.ok(dashBefore.charts.topFood.length > 0, "Expected topFood chart data");
    assert.ok(dashBefore.charts.topDislikes.length > 0, "Expected topDislikes chart data");
    assert.ok(dashBefore.charts.segmentSizes.length > 0, "Expected segmentSizes chart data");
    assert.ok(dashBefore.charts.declineReasons.length > 0, "Expected declineReasons chart data");
    assert.ok(dashBefore.similarPairs.length > 0, "Expected similarPairs shared interests");
    assert.ok(dashBefore.activities.upcoming.length > 0, "Expected upcoming activities");
    assert.ok(dashBefore.activities.recent.length > 0, "Expected recent activities");
    assert.ok(dashBefore.activities.mostPopular.length > 0, "Expected mostPopular activities");
    assert.ok(dashBefore.activities.pendingList.length > 0, "Expected pending invitations list");
    assert.ok(dashBefore.suggestions.length > 0, "Expected Nong Chuan suggestions");

    // Confirm HTTP 200 across main App pages
    for (const route of [
      "/dashboard",
      "/friends",
      "/interests",
      "/segments",
      "/activities",
      "/invitations",
      "/my-profile",
      "/settings",
    ]) {
      const pageRes = await fetch(`${BASE}${route}`, { redirect: "manual" });
      assert.equal(pageRes.status, 200, `Expected 200 for ${route}`);
    }

    console.log("3. Extracting likes/dislikes from new Thai friend description (built-in NLP fallback)...");
    const friendNick = "น้องเฟิร์น";
    const rawThaiText = `เพื่อนใหม่ชื่อ ${friendNick} ชอบกินหมูกระทะกับชาบู ไม่ชอบอาหารเผ็ด ชอบไปคาเฟ่และถ่ายรูป`;
    const extRes = await demo.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: rawThaiText,
        sourceLabel: "phase4-integration-test",
      }),
    });
    assert.equal(extRes.status, 200, "Text extraction failed");
    const textInputId = extRes.json.textInputId;
    createdTextInputIds.push(textInputId);
    const items = extRes.json.items || [];
    assert.ok(
      items.some(
        (i) =>
          i.detected_friend_name === friendNick &&
          i.category_slug === "food_preferences" &&
          i.normalized_value === "หมูกระทะ"
      ),
      "Expected หมูกระทะ extracted for new friend"
    );
    assert.ok(
      items.some(
        (i) =>
          i.detected_friend_name === friendNick &&
          i.category_slug === "disliked_food" &&
          i.normalized_value === "อาหารเผ็ด"
      ),
      "Expected อาหารเผ็ด extracted as disliked_food"
    );

    console.log("4. Reviewing & confirming extracted interests into structured database...");
    const confirmRes = await demo.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({
        textInputId,
        items: items.map((i) => ({
          extractedId: i.extractedId,
          detected_friend_name: i.detected_friend_name,
          category_slug: i.category_slug,
          normalized_value: i.normalized_value,
          raw_value: i.raw_value,
          restriction_type: i.category_slug === "disliked_food" ? "dislike" : null,
        })),
      }),
    });
    assert.equal(confirmRes.status, 200, "Confirmation of extracted items failed");

    console.log("5. Opening friend's updated profile to verify persisted interests & traceability...");
    const updatedFriends = await demo.req(`/api/friends?q=${encodeURIComponent(friendNick)}`);
    assert.equal(updatedFriends.status, 200);
    assert.equal(updatedFriends.json.friends.length, 1);
    const createdFriend = updatedFriends.json.friends[0];
    createdFriendIds.push(createdFriend.id);

    const profileRes = await demo.req(`/api/friends/${createdFriend.id}`);
    assert.equal(profileRes.status, 200);
    assert.ok(
      profileRes.json.friend.interests.some(
        (i) => i.category_slug === "food_preferences" && i.normalized_value === "หมูกระทะ"
      ),
      "Friend profile must show confirmed หมูกระทะ preference"
    );

    console.log("6. Searching dynamic segmentation for friends who like 'หมูกระทะ'...");
    const segRes = await demo.req(`/api/segments?interests=${encodeURIComponent("หมูกระทะ")}`);
    assert.equal(segRes.status, 200);
    const bbqSegmentFriends = segRes.json.friends || [];
    assert.ok(
      bbqSegmentFriends.some((f) => f.id === createdFriend.id),
      "Updated friend must appear immediately in dynamic หมูกระทะ segment"
    );

    console.log("7. Recommending & creating new 'หมูกระทะ' activity for matched friends...");
    const recRes = await demo.req("/api/activities/recommend", {
      method: "POST",
      body: JSON.stringify({
        title: `หมูกระทะรับเพื่อนใหม่ ${stamp}`,
        category: "อาหารและสังสรรค์",
      }),
    });
    assert.equal(recRes.status, 200);
    assert.ok(
      recRes.json.recommendations.some(
        (r) => r.id === createdFriend.id && r.matchedLikes.includes("หมูกระทะ")
      ),
      "Newly extracted friend must be recommended for หมูกระทะ activity"
    );

    // Pick new friend + 2 more existing friends who like หมูกระทะ
    const matchedOtherIds = recRes.json.recommendations
      .filter((r) => r.id !== createdFriend.id && r.matchedLikes.includes("หมูกระทะ"))
      .slice(0, 2)
      .map((r) => r.id);
    assert.equal(matchedOtherIds.length, 2);

    const actCreate = await demo.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: `ปาร์ตี้หมูกระทะ P4 ${stamp}`,
        description: "Integration test end-to-end activity",
        category: "อาหารและสังสรรค์",
        activity_date: "2026-12-18",
        start_time: "18:30",
        end_time: "21:30",
        location: "ร้านหมูกระทะลาดพร้าว",
        target_interests: ["หมูกระทะ"],
        friendIds: [createdFriend.id, ...matchedOtherIds],
      }),
    });
    assert.equal(actCreate.status, 201);
    const actId = actCreate.json.activity.id;
    createdActivityIds.push(actId);

    console.log("8. Opening RSVP links, submitting Going + Not Going with decline reason...");
    const actDetail1 = await demo.req(`/api/activities/${actId}`);
    assert.equal(actDetail1.status, 200);
    const invs = actDetail1.json.invitations;
    assert.equal(invs.length, 3);

    const rsvpGoingRes = await fetch(`${BASE}/api/public/rsvp/${invs[0].invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: "going", response_note: "พร้อมปิ้งย่าง!" }),
    });
    assert.equal(rsvpGoingRes.status, 200);

    const uniqueReason = "ติดธุระ";
    const rsvpDeclineRes = await fetch(`${BASE}/api/public/rsvp/${invs[1].invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rsvp_status: "not_going",
        decline_reason: uniqueReason,
        response_note: "ขอเป็นอาทิตย์หน้าแทนนะ",
      }),
    });
    assert.equal(rsvpDeclineRes.status, 200);

    const actDetail2 = await demo.req(`/api/activities/${actId}`);
    assert.equal(actDetail2.status, 200);
    assert.equal(actDetail2.json.stats.going, 1);
    assert.equal(actDetail2.json.stats.notGoing, 1);
    assert.equal(actDetail2.json.stats.pending, 1);
    assert.equal(actDetail2.json.stats.responseRate, 67);

    console.log("9. Returning to Dashboard to confirm live Analytics & Nong Chuan reflection...");
    const dashAfterRes = await demo.req("/api/dashboard");
    assert.equal(dashAfterRes.status, 200);
    const dashAfter = dashAfterRes.json;

    assert.equal(
      dashAfter.summary.totalFriends,
      dashBefore.summary.totalFriends + 1,
      "Dashboard totalFriends must reflect newly confirmed friend"
    );
    assert.equal(
      dashAfter.summary.totalActivities,
      dashBefore.summary.totalActivities + 1,
      "Dashboard totalActivities must reflect newly created activity"
    );
    assert.equal(
      dashAfter.summary.rsvpSummary.going,
      dashBefore.summary.rsvpSummary.going + 1,
      "Dashboard going count must reflect new Going RSVP"
    );
    assert.equal(
      dashAfter.summary.rsvpSummary.notGoing,
      dashBefore.summary.rsvpSummary.notGoing + 1,
      "Dashboard notGoing count must reflect new Not Going RSVP"
    );
    assert.equal(
      dashAfter.summary.pendingInvitations,
      dashBefore.summary.pendingInvitations + 1,
      "Dashboard pendingInvitations must reflect 1 leftover pending invite"
    );

    const bbqFoodCountBefore =
      dashBefore.charts.topFood.find((f) => f.normalized_value === "หมูกระทะ")?.friend_count || 0;
    const bbqFoodCountAfter =
      dashAfter.charts.topFood.find((f) => f.normalized_value === "หมูกระทะ")?.friend_count || 0;
    assert.equal(
      bbqFoodCountAfter,
      bbqFoodCountBefore + 1,
      "Top food chart & Nong Chuan BBQ count must reflect real DB increment"
    );

    const bbqSuggestion = dashAfter.suggestions.find((s) => s.tag === "หมูกระทะ");
    assert.ok(
      bbqSuggestion &&
        bbqSuggestion.message.includes(String(bbqFoodCountAfter)) &&
        bbqSuggestion.reason.length > 0,
      "Nong Chuan suggestion must reference accurate updated BBQ count and reasoning"
    );

    console.log("10. Verifying safe Demo Reset protection for production user accounts...");
    const regProd = await prodUser.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Real Production User",
        email: prodEmail,
        password: "ProdUserPass123",
      }),
    });
    assert.equal(regProd.status, 201);

    const addProdFriend = await prodUser.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: "เพื่อนผู้ใช้จริง ห้ามถูกลบ",
        nickname: "เพื่อนจริง",
        interests: [{ category_slug: "food_preferences", value: "ก๋วยเตี๋ยว" }],
      }),
    });
    assert.equal(addProdFriend.status, 201);

    const forbiddenReset = await prodUser.req("/api/demo/reset", { method: "POST" });
    assert.equal(
      forbiddenReset.status,
      403,
      "Non-demo production users MUST receive 403 on POST /api/demo/reset"
    );

    const prodFriendsCheck = await prodUser.req("/api/friends");
    assert.equal(
      prodFriendsCheck.json.friends.length,
      1,
      "Production user's data must remain completely intact after rejected demo reset"
    );

    console.log("ALL PHASE 4 FULL-PIPELINE INTEGRATION TESTS PASSED!");
  } finally {
    console.log("Restoring clean Phase 4 test records...");
    for (const aid of createdActivityIds) {
      await demo.req(`/api/activities/${aid}`, { method: "DELETE" });
    }
    for (const fid of createdFriendIds) {
      await demo.req(`/api/friends/${fid}`, { method: "DELETE" });
    }
    for (const tid of createdTextInputIds) {
      await demo.req(`/api/nlp/history/${tid}`, { method: "DELETE" });
    }
    try {
      const dbPath = path.join(process.cwd(), "data", "chuan-di.db");
      const db = new DatabaseSync(dbPath);
      db.prepare("DELETE FROM users WHERE email = ?").run(prodEmail);
      db.close();
    } catch (cleanupErr) {
      console.error("DB test user cleanup warning:", cleanupErr);
    }
  }
}

run().catch((err) => {
  console.error("PHASE 4 TEST FAILED:", err);
  process.exit(1);
});
