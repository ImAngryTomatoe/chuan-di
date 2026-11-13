import assert from "node:assert/strict";
import path from "node:path";

const BASE = "http://localhost:3000";

class HttpClient {
  constructor() {
    this.cookie = "";
  }

  async req(urlPath, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (this.cookie) headers.Cookie = this.cookie;

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
  const stamp = Date.now();
  const emailA = `soc.a.${stamp}@chuan-di.app`;
  const emailB = `soc.b.${stamp}@chuan-di.app`;

  try {
    console.log("1. Checking routes (/my-profile, /friends, /interests redirect compat)...");
    for (const r of ["/my-profile", "/friends", "/interests", "/interests/extract"]) {
      const res = await fetch(`${BASE}${r}`, { redirect: "manual" });
      assert.equal(res.status, 200, `Expected HTTP 200 for ${r}`);
    }

    console.log("2. Logging in as demo account (demo@chuan-di.app) and verifying self-profile fix...");
    const demo = new HttpClient();
    const demoLogin = await demo.req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "demo@chuan-di.app", password: "ChuanDiDemo123" }),
    });
    assert.equal(demoLogin.status, 200, "Demo login failed");

    const demoMyProfile = await demo.req("/api/my/profile");
    assert.equal(demoMyProfile.status, 200);
    assert.ok(demoMyProfile.json.ownProfile, "Expected ownProfile on /api/my/profile");
    assert.equal(
      demoMyProfile.json.ownProfile.nickname,
      "แพรว",
      `Demo ownProfile nickname must be แพรว, got ${demoMyProfile.json.ownProfile.nickname}`
    );
    assert.ok(
      !demoMyProfile.json.profiles.some((p) => p.owner_id === demoMyProfile.json.ownProfile.user_id),
      "Demo user must NOT be self-linked into own network profiles"
    );

    const demoFriends = await demo.req("/api/friends");
    assert.equal(demoFriends.status, 200);
    const aliceRow = demoFriends.json.friends.find((f) => f.nickname === "อลิส");
    assert.ok(aliceRow, "Expected อลิส in demo friends");
    assert.equal(
      aliceRow.linked_user_id ?? null,
      null,
      "อลิส must no longer be mistakenly linked to แพรว's user id"
    );

    console.log("3. Registering User A and User B and editing User B's self-profile...");
    const clientA = new HttpClient();
    const regA = await clientA.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "มินตรา",
        email: emailA,
        password: "Password1234",
      }),
    });
    assert.equal(regA.status, 201);

    const clientB = new HttpClient();
    const regB = await clientB.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "ธันวา",
        email: emailB,
        password: "Password1234",
      }),
    });
    assert.equal(regB.status, 201);

    const updateB = await clientB.req("/api/my/profile", {
      method: "PATCH",
      body: JSON.stringify({
        mode: "own",
        nickname: "ธันวา",
        full_name: "ธันวา สุขดี",
        contact_info: "LINE: thanwa.test",
        religion: "อิสลาม",
        can_eat: "อาหารฮาลาล, ไก่ย่าง, อาหารทะเล",
        cannot_eat: "งดหมูเด็ดขาด และแพ้กุ้ง",
        dietary_restrictions: ["ต้องการอาหารฮาลาล", "ไม่กินหมู", "แพ้อาหารทะเล"],
        interests: [
          { category_slug: "food_preferences", value: "ชาบู" },
          { category_slug: "disliked_food", value: "กุ้ง", restriction_type: "allergy" },
          { category_slug: "hobbies", value: "ดูหนัง" },
        ],
      }),
    });
    assert.equal(updateB.status, 200);

    console.log("4. User A searches User B by email, sends request, User B accepts...");
    const searchRes = await clientA.req(
      `/api/friends/connect?q=${encodeURIComponent(emailB)}`
    );
    assert.equal(searchRes.status, 200);
    const foundB = searchRes.json.users.find((u) => u.email === emailB);
    assert.ok(foundB, "Expected to find User B by email");
    assert.equal(foundB.connection_status, "none");

    const reqRes = await clientA.req("/api/friends/connect", {
      method: "POST",
      body: JSON.stringify({
        action: "request",
        targetUserId: foundB.user_id,
      }),
    });
    assert.equal(reqRes.status, 201);
    assert.equal(reqRes.json.status, "pending");

    const inboxB = await clientB.req("/api/friends/connect");
    assert.equal(inboxB.status, 200);
    const incomingFromA = inboxB.json.incomingRequests.find((r) => r.other_email === emailA);
    assert.ok(incomingFromA, "Expected incoming friend request from User A");

    const acceptRes = await clientB.req("/api/friends/connect", {
      method: "POST",
      body: JSON.stringify({
        action: "accept",
        requestId: incomingFromA.id,
      }),
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.json.status, "accepted");

    console.log("5. Verifying User A sees User B's synced profile and cannot edit it (403)...");
    const friendsOfA = await clientA.req("/api/friends");
    assert.equal(friendsOfA.status, 200);
    const friendRowB = friendsOfA.json.friends.find(
      (f) => f.linked_user_id === foundB.user_id
    );
    assert.ok(friendRowB, "Expected User B to appear in User A's synced friends list");
    assert.equal(friendRowB.religion, "อิสลาม");
    assert.ok(
      friendRowB.dietary_restrictions.some(
        (d) => d.restriction_label === "ต้องการอาหารฮาลาล"
      ),
      "Expected User B's dietary restrictions to sync automatically"
    );
    assert.ok(
      friendRowB.interests.some((i) => i.normalized_value.includes("ชาบู")),
      `Expected User B's food interest to sync automatically, got: ${JSON.stringify(friendRowB.interests)}`
    );

    // Organizer A MUST be blocked from editing User B's linked friend record
    const editBlockedRes = await clientA.req(`/api/friends/${friendRowB.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nickname: "ชื่อโดนแก้",
        full_name: "ชื่อโดนแก้",
        interests: [],
      }),
    });
    assert.equal(
      editBlockedRes.status,
      403,
      "Linked friend MUST be read-only (403) when organizer tries to edit it"
    );

    console.log("6. Verifying live propagation when User B updates own profile...");
    const liveTag = `ฟิล์ม_${stamp}`;
    const liveUpdateB = await clientB.req("/api/my/profile", {
      method: "PATCH",
      body: JSON.stringify({
        mode: "own",
        nickname: "ธันวา",
        full_name: "ธันวา สุขดี",
        religion: "อิสลาม",
        can_eat: "อาหารฮาลาล, ไก่ย่าง",
        cannot_eat: "งดหมูเด็ดขาด, ไม่ดื่มแอลกอฮอล์",
        dietary_restrictions: ["ต้องการอาหารฮาลาล", "ไม่กินหมู", "แพ้อาหารทะเล", "ไม่ดื่มแอลกอฮอล์"],
        interests: [
          { category_slug: "food_preferences", value: "ชาบู" },
          { category_slug: "hobbies", value: liveTag },
        ],
      }),
    });
    assert.equal(liveUpdateB.status, 200);

    const detailAfterSync = await clientA.req(`/api/friends/${friendRowB.id}`);
    assert.equal(detailAfterSync.status, 200);
    assert.ok(
      detailAfterSync.json.friend.interests.some((i) => i.normalized_value === liveTag),
      "Expected User B's new hobby tag to propagate immediately to User A's friend view"
    );
    assert.ok(
      detailAfterSync.json.friend.dietary_restrictions.some(
        (d) => d.restriction_label === "ไม่ดื่มแอลกอฮอล์"
      ),
      "Expected User B's updated dietary restriction to propagate immediately"
    );

    console.log("7. Verifying organizer cannot self-link by opening own registration invite link...");
    const regInvRes = await clientA.req("/api/invitations/register", {
      method: "POST",
      body: JSON.stringify({ label: "guard test link" }),
    });
    assert.equal(regInvRes.status, 201);
    const invSubmitSelf = await clientA.req(
      `/api/public/invite/${regInvRes.json.invitation.invite_token}`,
      {
        method: "POST",
        body: JSON.stringify({
          authMode: "guest",
          nickname: "GuestSelfTest",
          full_name: "Guest Self Test",
          consent_given: true,
          interests: [],
        }),
      }
    );
    assert.equal(invSubmitSelf.status, 200);
    assert.equal(
      invSubmitSelf.json.linkedUserId,
      null,
      "Organizer submitting guest invite link must NEVER link their own user_id"
    );

    console.log("ALL SOCIAL FRIENDS & SELF-PROFILE TESTS PASSED!");
  } finally {
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(path.join(process.cwd(), "data", "chuan-di.db"));
      db.prepare("DELETE FROM users WHERE email IN (?, ?)").run(emailA, emailB);
      db.close();
    } catch {
      // ignore cleanup
    }
  }
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
