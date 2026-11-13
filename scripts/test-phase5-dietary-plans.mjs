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
    return { status: res.status, json, headers: res.headers };
  }
}

async function run() {
  const demo = new Client();
  const stamp = Date.now();
  let tempFriendId = null;

  try {
    console.log("1. Logging in with demo account (demo@chuan-di.app)...");
    const login = await demo.req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "demo@chuan-di.app",
        password: "ChuanDiDemo123",
      }),
    });
    assert.equal(login.status, 200, "Demo login failed");

    console.log("2. Testing GET /api/friends?religion=อิสลาม and ?allergy=only...");
    const muslimRes = await demo.req(`/api/friends?religion=${encodeURIComponent("อิสลาม")}`);
    assert.equal(muslimRes.status, 200);
    assert.ok(muslimRes.json.friends.length >= 2, "Expected seeded Muslim friends");
    for (const f of muslimRes.json.friends) {
      assert.equal(f.religion, "อิสลาม");
    }

    const allergyRes = await demo.req("/api/friends?allergy=only");
    assert.equal(allergyRes.status, 200);
    assert.ok(allergyRes.json.friends.length >= 4, "Expected seeded allergy friends");
    for (const f of allergyRes.json.friends) {
      assert.ok(
        f.interests.some(
          (i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy"
        ),
        `Friend ${f.nickname} returned by allergy=only lacks allergy item`
      );
    }

    console.log("3. Creating temporary friend with religion, can_eat, cannot_eat, allergy...");
    const createRes = await demo.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: `ฟาติมะห์ ทดสอบระบบ ${stamp}`,
        nickname: `ฟ้าทดสอบ${stamp % 1000}`,
        religion: "อิสลาม",
        can_eat: "อาหารฮาลาล, ไก่, ปลา",
        cannot_eat: "งดหมู (ฮาลาล)",
        interests: [
          { category_slug: "disliked_food", value: "กุ้ง", restriction_type: "allergy" },
          { category_slug: "food_preferences", value: "ชาบู" },
        ],
      }),
    });
    assert.equal(createRes.status, 201, `Create friend failed: ${JSON.stringify(createRes.json)}`);
    tempFriendId = createRes.json.friend.id;

    const getOne = await demo.req(`/api/friends/${tempFriendId}`);
    assert.equal(getOne.status, 200);
    assert.equal(getOne.json.friend.religion, "อิสลาม");
    assert.equal(getOne.json.friend.can_eat, "อาหารฮาลาล, ไก่, ปลา");
    assert.equal(getOne.json.friend.cannot_eat, "งดหมู (ฮาลาล)");
    const shrimpAllergy = getOne.json.friend.interests.find(
      (i) => i.category_slug === "disliked_food" && i.normalized_value.includes("กุ้ง")
    );
    assert.ok(shrimpAllergy, "Expected shrimp restriction to persist");
    assert.equal(shrimpAllergy.restriction_type, "allergy");

    console.log("4. Testing POST /api/plans/recommend with mixed religion + allergy friends...");
    const allFriendsRes = await demo.req("/api/friends");
    assert.equal(allFriendsRes.status, 200);
    const mintFriend = allFriendsRes.json.friends.find((f) => f.nickname === "มิ้นท์");
    const safeFriend = allFriendsRes.json.friends.find((f) => f.nickname === "กันต์");
    assert.ok(mintFriend && safeFriend, "Expected seeded friends มิ้นท์ and กันต์");

    const planRes = await demo.req("/api/plans/recommend", {
      method: "POST",
      body: JSON.stringify({ friendIds: [tempFriendId, mintFriend.id, safeFriend.id] }),
    });
    assert.equal(planRes.status, 200);
    const { snapshot, plans } = planRes.json;
    assert.equal(snapshot.targetCount, 3);
    assert.ok(
      snapshot.noPorkFriends.some((x) => x.friendId === tempFriendId),
      "Expected temp Muslim friend in noPorkFriends"
    );

    const mookata = plans.find((p) => p.id === "plan-mookata");
    const cafe = plans.find((p) => p.id === "plan-cafe");
    const shabu = plans.find((p) => p.id === "plan-shabu");
    assert.ok(mookata && cafe && shabu, "Expected standard recommended plans");

    assert.equal(mookata.suitabilityLevel, "partial_group");
    assert.ok(
      mookata.excludedFriends.some((e) => e.id === tempFriendId),
      "Pork BBQ plan must exclude Muslim friend"
    );
    assert.equal(cafe.safeCount, 3, "Cafe plan should accommodate all 3 selected friends");
    assert.equal(shabu.safeCount, 3, "Halal separated-pot Shabu plan should accommodate all 3");
    assert.ok(
      cafe.allergyWarnings.some((w) => w.includes("มิ้นท์")) ||
        shabu.allergyWarnings.some((w) => w.includes("มิ้นท์")),
      "Expected peanut allergy warning for มิ้นท์"
    );

    console.log("5. Testing activity recommendation dietary conflict flag...");
    const actRecRes = await demo.req("/api/activities/recommend", {
      method: "POST",
      body: JSON.stringify({ title: "หมูกระทะวันศุกร์" }),
    });
    assert.equal(actRecRes.status, 200);
    const recTemp = actRecRes.json.recommendations.find((r) => r.id === tempFriendId);
    assert.ok(recTemp, "Expected temp friend in recommendation list");
    assert.equal(recTemp.hasTargetConflict, true);
    assert.equal(recTemp.matchScore, 0);

    console.log("6. Verifying GET /api/dashboard exposes friendsOverview, dietarySnapshot, recommendedPlans...");
    const dashRes = await demo.req("/api/dashboard");
    assert.equal(dashRes.status, 200);
    assert.ok(Array.isArray(dashRes.json.friendsOverview) && dashRes.json.friendsOverview.length >= 22);
    assert.ok(dashRes.json.dietarySnapshot && dashRes.json.dietarySnapshot.targetCount >= 22);
    assert.ok(Array.isArray(dashRes.json.recommendedPlans) && dashRes.json.recommendedPlans.length >= 4);

    console.log("PASS: Phase 5 dietary/religion/allergy & smart plan verification passed!");
  } finally {
    if (tempFriendId) {
      await demo.req(`/api/friends/${tempFriendId}`, { method: "DELETE" });
    }
  }
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
