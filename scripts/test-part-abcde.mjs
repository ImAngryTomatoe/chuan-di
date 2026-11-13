import assert from "node:assert/strict";
import path from "node:path";

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
  const user = new Client();
  const invitedFriendClient = new Client();
  const stamp = Date.now();
  const organizerEmail = `partabcde.${stamp}@chuan-di.app`;
  const invitedEmail = `fah.${stamp}@chuan-di.app`;

  try {
    console.log("0. Registering isolated test organizer for Part A-E verification...");
    const reg = await user.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: `Organizer ${stamp}`,
        email: organizerEmail,
        password: "Password1234",
      }),
    });
    assert.equal(reg.status, 201, `Failed to register test user: ${JSON.stringify(reg.json)}`);

    // 1. Test all 4 Part C benchmark NLP prompts + zero religion inference
    console.log("1. Testing Part C NLP extraction benchmarks (อามีน, แนน, ซาร่า, บีม)...");

    const ex1 = await user.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "อามีนไม่กินหมู กินเฉพาะอาหารฮาลาล แต่ชอบชาบูและดูหนัง",
        sourceLabel: "test_part_c",
      }),
    });
    assert.equal(ex1.status, 200, `Extract 1 failed: ${JSON.stringify(ex1.json)}`);
    const items1 = ex1.json.items || [];
    assert.ok(
      items1.some(
        (i) =>
          i.detected_friend_name === "อามีน" &&
          i.category_slug === "dietary_restriction" &&
          i.normalized_value === "ไม่กินหมู"
      ),
      `Expected อามีน -> dietary_restriction: ไม่กินหมู, got: ${JSON.stringify(items1)}`
    );
    assert.ok(
      items1.some(
        (i) =>
          i.detected_friend_name === "อามีน" &&
          i.category_slug === "dietary_restriction" &&
          i.normalized_value === "ต้องการอาหารฮาลาล"
      ),
      `Expected อามีน -> dietary_restriction: ต้องการอาหารฮาลาล, got: ${JSON.stringify(items1)}`
    );
    assert.ok(
      items1.some(
        (i) =>
          i.detected_friend_name === "อามีน" &&
          i.category_slug === "food_preferences" &&
          i.normalized_value === "ชาบู"
      ),
      `Expected อามีน -> food_preferences: ชาบู, got: ${JSON.stringify(items1)}`
    );
    assert.ok(
      items1.some(
        (i) =>
          i.detected_friend_name === "อามีน" &&
          i.category_slug === "hobbies" &&
          i.normalized_value === "ดูหนัง"
      ),
      `Expected อามีน -> hobbies: ดูหนัง, got: ${JSON.stringify(items1)}`
    );
    assert.ok(!("religion" in ex1.json), "Extraction response must not infer religion");

    // Confirm items1 (creating อามีน as new friend via NLP) and verify religion === "ไม่ระบุ"
    const cf1 = await user.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({
        textInputId: ex1.json.textInputId,
        items: items1,
      }),
    });
    assert.equal(cf1.status, 200, `Confirm 1 failed: ${JSON.stringify(cf1.json)}`);

    const friendsAfterCf1 = await user.req("/api/friends");
    assert.equal(friendsAfterCf1.status, 200);
    const ameen = (friendsAfterCf1.json.friends || []).find((f) => f.nickname === "อามีน");
    assert.ok(ameen, "Expected อามีน to be created after confirm");
    assert.equal(
      ameen.religion,
      "ไม่ระบุ",
      `CRITICAL: อามีน religion must remain "ไม่ระบุ" (never inferred from name or halal/no-pork), got "${ameen.religion}"`
    );
    assert.ok(
      ameen.dietary_restrictions?.some((d) => d.restriction_label === "ไม่กินหมู"),
      "Expected อามีน to persist ไม่กินหมู in dietary_restrictions"
    );
    assert.ok(
      ameen.dietary_restrictions?.some((d) => d.restriction_label === "ต้องการอาหารฮาลาล"),
      "Expected อามีน to persist ต้องการอาหารฮาลาล in dietary_restrictions"
    );

    // Prompt 2: แนน
    const ex2 = await user.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "แนนแพ้อาหารทะเล ไม่ชอบอาหารเผ็ด ชอบหมูกระทะกับกาแฟ",
        sourceLabel: "test_part_c",
      }),
    });
    assert.equal(ex2.status, 200);
    const items2 = ex2.json.items || [];
    assert.ok(
      items2.some(
        (i) =>
          i.detected_friend_name === "แนน" &&
          i.category_slug === "disliked_food" &&
          i.restriction_type === "allergy" &&
          i.normalized_value.includes("อาหารทะเล")
      ),
      `Expected แนน allergy อาหารทะเล, got: ${JSON.stringify(items2)}`
    );
    assert.ok(
      items2.some(
        (i) =>
          i.detected_friend_name === "แนน" &&
          i.category_slug === "disliked_food" &&
          i.restriction_type === "dislike" &&
          i.normalized_value.includes("อาหารเผ็ด")
      ),
      `Expected แนน dislike อาหารเผ็ด, got: ${JSON.stringify(items2)}`
    );
    assert.ok(
      items2.some(
        (i) =>
          i.detected_friend_name === "แนน" &&
          i.category_slug === "food_preferences" &&
          i.normalized_value === "หมูกระทะ"
      ),
      `Expected แนน food หมูกระทะ, got: ${JSON.stringify(items2)}`
    );
    assert.ok(
      items2.some(
        (i) =>
          i.detected_friend_name === "แนน" &&
          i.category_slug === "food_preferences" &&
          i.normalized_value === "กาแฟ"
      ),
      `Expected แนน food กาแฟ, got: ${JSON.stringify(items2)}`
    );
    const cf2 = await user.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: ex2.json.textInputId, items: items2 }),
    });
    assert.equal(cf2.status, 200);

    // Prompt 3: ซาร่า
    const ex3 = await user.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "ซาร่าเป็นมังสวิรัติ ไม่ดื่มแอลกอฮอล์ ชอบไปคาเฟ่",
        sourceLabel: "test_part_c",
      }),
    });
    assert.equal(ex3.status, 200);
    const items3 = ex3.json.items || [];
    assert.ok(
      items3.some(
        (i) =>
          i.detected_friend_name === "ซาร่า" &&
          i.category_slug === "dietary_restriction" &&
          i.normalized_value === "มังสวิรัติ"
      ),
      `Expected ซาร่า -> dietary_restriction: มังสวิรัติ, got: ${JSON.stringify(items3)}`
    );
    assert.ok(
      items3.some(
        (i) =>
          i.detected_friend_name === "ซาร่า" &&
          i.category_slug === "dietary_restriction" &&
          i.normalized_value === "ไม่ดื่มแอลกอฮอล์"
      ),
      `Expected ซาร่า -> dietary_restriction: ไม่ดื่มแอลกอฮอล์, got: ${JSON.stringify(items3)}`
    );
    assert.ok(
      items3.some((i) => i.detected_friend_name === "ซาร่า" && i.normalized_value === "คาเฟ่"),
      `Expected ซาร่า -> คาเฟ่, got: ${JSON.stringify(items3)}`
    );
    const cf3 = await user.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: ex3.json.textInputId, items: items3 }),
    });
    assert.equal(cf3.status, 200);

    // Prompt 4: บีม
    const ex4 = await user.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "บีมไม่ชอบทุเรียน แต่ชอบบอร์ดเกมและเที่ยวทะเล",
        sourceLabel: "test_part_c",
      }),
    });
    assert.equal(ex4.status, 200);
    const items4 = ex4.json.items || [];
    assert.ok(
      items4.some(
        (i) =>
          i.detected_friend_name === "บีม" &&
          i.category_slug === "disliked_food" &&
          i.restriction_type === "dislike" &&
          i.normalized_value === "ทุเรียน"
      ),
      `Expected บีม -> dislike ทุเรียน, got: ${JSON.stringify(items4)}`
    );
    assert.ok(
      items4.some(
        (i) =>
          i.detected_friend_name === "บีม" &&
          i.category_slug === "hobbies" &&
          i.normalized_value === "บอร์ดเกม"
      ),
      `Expected บีม -> hobbies บอร์ดเกม, got: ${JSON.stringify(items4)}`
    );
    assert.ok(
      items4.some(
        (i) =>
          i.detected_friend_name === "บีม" &&
          i.category_slug === "travel_interests" &&
          i.normalized_value === "ทะเล"
      ),
      `Expected บีม -> travel_interests ทะเล, got: ${JSON.stringify(items4)}`
    );

    // Prompt 5: Inline multi-friend placeholder sentence
    const ex5 = await user.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "แนนชอบหมูกระทะ อามีนไม่กินหมูและเลือกอาหารฮาลาล ส่วนบีมชอบไปคาเฟ่",
        sourceLabel: "test_part_c_inline",
      }),
    });
    assert.equal(ex5.status, 200);
    const items5 = ex5.json.items || [];
    assert.ok(
      items5.some((i) => i.detected_friend_name === "แนน" && i.normalized_value === "หมูกระทะ"),
      `Expected แนน -> หมูกระทะ in inline sentence, got: ${JSON.stringify(items5)}`
    );
    assert.ok(
      items5.some(
        (i) =>
          i.detected_friend_name === "อามีน" &&
          i.category_slug === "dietary_restriction" &&
          i.normalized_value === "ต้องการอาหารฮาลาล"
      ),
      `Expected อามีน -> ต้องการอาหารฮาลาล in inline sentence, got: ${JSON.stringify(items5)}`
    );
    assert.ok(
      items5.some((i) => i.detected_friend_name === "บีม" && i.normalized_value === "คาเฟ่"),
      `Expected บีม -> คาเฟ่ in inline sentence, got: ${JSON.stringify(items5)}`
    );

    // 2. Test Friend CRUD with dietary_restrictions, non-inference on ไม่กินหมู, and clearing religion
    console.log("2. Testing Friend POST/PATCH dietary_restrictions & clearable optional religion...");
    const nonMuslimPorkFriendRes = await user.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: "มิน ไม่กินหมู",
        nickname: "มิน",
        religion: "ไม่ระบุ",
        dietary_restrictions: ["ไม่กินหมู"],
        interests: [{ category_slug: "food_preferences", value: "หมูกระทะ" }],
      }),
    });
    assert.equal(nonMuslimPorkFriendRes.status, 201);
    const minFriend = nonMuslimPorkFriendRes.json.friend;
    assert.equal(minFriend.religion, "ไม่ระบุ");
    assert.ok(
      minFriend.dietary_restrictions.some((d) => d.restriction_label === "ไม่กินหมู"),
      "Expected มิน to persist ไม่กินหมู"
    );
    assert.ok(
      !minFriend.dietary_restrictions.some((d) => d.restriction_label === "ต้องการอาหารฮาลาล"),
      "CRITICAL: selecting ไม่กินหมู must NOT auto-add ต้องการอาหารฮาลาล"
    );

    // Set religion temporarily then clear back to ไม่ระบุ via PATCH
    const setRelRes = await user.req(`/api/friends/${minFriend.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "มิน ไม่กินหมู",
        nickname: "มิน",
        religion: "พุทธ",
        dietary_restrictions: ["ไม่กินหมู"],
      }),
    });
    assert.equal(setRelRes.status, 200);
    assert.equal(setRelRes.json.friend.religion, "พุทธ");

    const clearRelRes = await user.req(`/api/friends/${minFriend.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "มิน ไม่กินหมู",
        nickname: "มิน",
        religion: "ไม่ระบุ",
        dietary_restrictions: ["ไม่กินหมู"],
      }),
    });
    assert.equal(clearRelRes.status, 200);
    assert.equal(clearRelRes.json.friend.religion, "ไม่ระบุ");

    // 3. Test Multi-Condition Segmentation filtering (interests + dietary_restrictions)
    console.log("3. Testing Multi-Condition Segmentation & GET /api/friends?dietary=...");
    const friendsDietaryRes = await user.req(
      `/api/friends?dietary=${encodeURIComponent("ต้องการอาหารฮาลาล")}`
    );
    assert.equal(friendsDietaryRes.status, 200);
    assert.ok(
      (friendsDietaryRes.json.friends || []).some((f) => f.id === ameen.id),
      "Expected อามีน in GET /api/friends?dietary=ต้องการอาหารฮาลาล"
    );
    assert.ok(
      !(friendsDietaryRes.json.friends || []).some((f) => f.id === minFriend.id),
      "Expected มิน NOT in GET /api/friends?dietary=ต้องการอาหารฮาลาล"
    );

    const segCombo = await user.req(
      `/api/segments?interests=${encodeURIComponent("หมูกระทะ")}&dietary=${encodeURIComponent(
        "ไม่กินหมู"
      )}`
    );
    assert.equal(segCombo.status, 200);
    assert.ok(
      segCombo.json.friends.some((f) => f.id === minFriend.id),
      "Expected มิน (likes หมูกระทะ + ไม่กินหมู) to match multi-condition segment"
    );
    assert.ok(
      !segCombo.json.friends.some((f) => f.nickname === "แนน"),
      "Expected แนน (likes หมูกระทะ, no ไม่กินหมู) NOT to match หมูกระทะ+ไม่กินหมู"
    );

    const halalSeg = await user.req(
      `/api/segments?dietary=${encodeURIComponent("ต้องการอาหารฮาลาล")}`
    );
    assert.equal(halalSeg.status, 200);
    assert.ok(
      halalSeg.json.friends.some((f) => f.id === ameen.id),
      "Expected อามีน in ต้องการอาหารฮาลาล segment"
    );
    assert.ok(
      !halalSeg.json.friends.some((f) => f.id === minFriend.id),
      "Expected มิน (only ไม่กินหมู) NOT to appear in ต้องการอาหารฮาลาล segment"
    );

    // 4. Test Activity Recommend Halal Warning & Non-Exclusion
    console.log("4. Testing Activity Recommendation halal/dietary warnings without excluding friends...");
    const recRes = await user.req("/api/activities/recommend", {
      method: "POST",
      body: JSON.stringify({
        title: "ปิ้งย่างวันศุกร์",
        category: "อาหารและสังสรรค์",
        target_interests: ["ชาบู"],
      }),
    });
    assert.equal(recRes.status, 200);
    const ameenRec = (recRes.json.recommendations || []).find((r) => r.id === ameen.id);
    assert.ok(ameenRec, "อามีน must NOT be excluded from activity recommendations");
    assert.ok(
      ameenRec.dietaryWarnings?.some(
        (w) =>
          w.includes("ต้องการอาหารฮาลาล") && w.includes("ลองตรวจสอบร้านก่อนนะ")
      ),
      `Expected exact Nong Chuan halal warning for อามีน, got: ${JSON.stringify(ameenRec.dietaryWarnings)}`
    );

    // 5. Public RSVP redaction (never expose religion) + Invite link & /api/my/profile dietary persistence
    console.log("5. Testing public RSVP redaction (no religion leaked) & invite/my-profile dietary sync...");
    const actRes = await user.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: "นัดทานข้าวกลุ่ม",
        category: "อาหารและสังสรรค์",
        activity_date: "2026-12-01",
        start_time: "18:30",
        location: "ร้านอาหารฮาลาล อารีย์",
        target_interests: ["ชาบู"],
        friendIds: [ameen.id],
      }),
    });
    assert.equal(actRes.status, 201, `Create activity failed: ${JSON.stringify(actRes.json)}`);
    const actDetail = await user.req(`/api/activities/${actRes.json.activity.id}`);
    assert.equal(actDetail.status, 200);
    const inviteToken = actDetail.json.invitations?.[0]?.invite_token;
    assert.ok(inviteToken, "Expected activity invitation token");

    const rsvpPublic = await fetch(`${BASE}/api/public/rsvp/${inviteToken}`);
    const rsvpJson = await rsvpPublic.json();
    assert.equal(rsvpPublic.status, 200);
    assert.ok(!("religion" in (rsvpJson.invitation || {})), "Public RSVP must never expose religion");
    assert.ok(!JSON.stringify(rsvpJson).includes('"religion"'), "Public RSVP payload must not contain religion key");

    // Invite token dietary + /api/my/profile dietary check
    const regLinkRes = await user.req("/api/invitations/register", {
      method: "POST",
      body: JSON.stringify({ label: "เชิญเพื่อนทดสอบ", target_friend_name: "ฟ้า" }),
    });
    assert.equal(regLinkRes.status, 201, `Create registration link failed: ${JSON.stringify(regLinkRes.json)}`);
    const regToken = regLinkRes.json.invitation.invite_token;

    const submitInviteRes = await invitedFriendClient.req(`/api/public/invite/${regToken}`, {
      method: "POST",
      body: JSON.stringify({
        nickname: "ฟ้า",
        full_name: "ฟ้า ใจดี",
        religion: "ไม่ระบุ",
        dietary_restrictions: ["วีแกน", "แพ้ถั่ว"],
        consent_given: true,
        interests: [{ category_slug: "food_preferences", value: "สลัดผัก" }],
        authMode: "register",
        email: invitedEmail,
        password: "Password1234",
      }),
    });
    assert.equal(submitInviteRes.status, 200, `Invite register failed: ${JSON.stringify(submitInviteRes.json)}`);

    const myProfileRes = await invitedFriendClient.req("/api/my/profile");
    assert.equal(myProfileRes.status, 200);
    const fahProfile = myProfileRes.json.profiles?.[0];
    assert.ok(fahProfile, "Expected linked profile for ฟ้า");
    assert.ok(
      fahProfile.dietary_restrictions?.some((d) => d.restriction_label === "วีแกน"),
      "Expected วีแกน in /api/my/profile response"
    );

    // Update via PATCH /api/my/profile and verify persisted via GET /api/my/profile
    const updateMyProfile = await invitedFriendClient.req("/api/my/profile", {
      method: "PATCH",
      body: JSON.stringify({
        friendId: fahProfile.id,
        nickname: "ฟ้า",
        full_name: "ฟ้า ใจดี",
        religion: "ไม่ระบุ",
        dietary_restrictions: ["วีแกน", "ไม่ดื่มแอลกอฮอล์"],
        interests: fahProfile.interests.map((i) => ({
          category_slug: i.category_slug,
          value: i.normalized_value,
          restriction_type: i.restriction_type,
        })),
      }),
    });
    assert.equal(updateMyProfile.status, 200);

    const afterPatchRes = await invitedFriendClient.req("/api/my/profile");
    assert.equal(afterPatchRes.status, 200);
    const updatedFah = afterPatchRes.json.profiles?.[0];
    assert.ok(
      updatedFah?.dietary_restrictions?.some(
        (d) => d.restriction_label === "ไม่ดื่มแอลกอฮอล์"
      ),
      "Expected ไม่ดื่มแอลกอฮอล์ saved via PATCH /api/my/profile"
    );

    console.log("ALL PART A-E INTEGRATION TESTS PASSED!");
  } finally {
    // Clean up only the synthetic test accounts created in this run
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(path.join(process.cwd(), "data", "chuan-di.db"));
      db.prepare("DELETE FROM users WHERE email IN (?, ?)").run(organizerEmail, invitedEmail);
      db.close();
    } catch {
      // ignore cleanup error
    }
  }
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
