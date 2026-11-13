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
  const organizer = new Client();
  const friendClient = new Client();
  const intruderClient = new Client();

  const stamp = Date.now();
  const joinEmail = `phase3-join-${stamp}@example.test`;
  const intruderEmail = `phase3-intruder-${stamp}@example.test`;

  const createdActivityIds = [];
  const createdFriendIds = [];
  const createdRegInviteIds = [];
  const createdTestEmails = [joinEmail, intruderEmail];

  try {
    console.log("1. Logging in with organizer demo account...");
    const login = await organizer.req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "demo@chuan-di.app",
        password: "ChuanDiDemo123",
      }),
    });
    assert.equal(login.status, 200, "Demo login failed");

    console.log("2. Checking Phase 3 App Router pages return HTTP 200...");
    for (const p of ["/activities", "/activities/new", "/invitations", "/my-profile", "/settings"]) {
      const pageRes = await fetch(`${BASE}${p}`, { redirect: "manual" });
      assert.equal(pageRes.status, 200, `Route ${p} did not return 200 (got ${pageRes.status})`);
    }

    console.log("3. Validating Activity creation input guards (dates, start_time < end_time, required fields)...");
    const badMissing = await organizer.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({ title: "", location: "" }),
    });
    assert.equal(badMissing.status, 400, "Empty activity payload must fail 400");

    const badTimeOrder = await organizer.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid Time Test",
        location: "Bangkok",
        activity_date: "2026-12-10",
        start_time: "20:00",
        end_time: "18:00",
      }),
    });
    assert.equal(badTimeOrder.status, 400, "end_time <= start_time must fail 400");

    const badDate = await organizer.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: "Invalid Date Test",
        location: "Bangkok",
        activity_date: "not-a-date",
        start_time: "18:00",
      }),
    });
    assert.equal(badDate.status, 400, "Invalid date must fail 400");

    console.log("4. Creating isolated test friends (including negative-dislike guard friend)...");
    const fJoinRes = await organizer.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: "เพื่อนทดสอบ ระบบ Phase3",
        nickname: `P3Join_${stamp}`,
        contact_info: "@p3join",
        interests: [
          { category_slug: "food_preferences", value: "หมูกระทะ" },
          { category_slug: "disliked_food", value: "อาหารทะเล", restriction_type: "dislike" },
        ],
      }),
    });
    assert.equal(fJoinRes.status, 201, "Failed to create test join friend");
    const joinFriendId = fJoinRes.json.friend.id;
    createdFriendIds.push(joinFriendId);

    const fDeclineRes = await organizer.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: "เพื่อนทดสอบ สอง",
        nickname: `P3Decline_${stamp}`,
        interests: [{ category_slug: "food_preferences", value: "หมูกระทะ" }],
      }),
    });
    assert.equal(fDeclineRes.status, 201);
    const declineFriendId = fDeclineRes.json.friend.id;
    createdFriendIds.push(declineFriendId);

    const fDislikeOnlyRes = await organizer.req("/api/friends", {
      method: "POST",
      body: JSON.stringify({
        full_name: "เพื่อนทดสอบ ไม่กินหมูกระทะ",
        nickname: `P3Dislike_${stamp}`,
        interests: [
          { category_slug: "disliked_food", value: "หมูกระทะ", restriction_type: "dislike" },
          { category_slug: "food_preferences", value: "ชาเขียว" },
        ],
      }),
    });
    assert.equal(fDislikeOnlyRes.status, 201);
    const dislikeOnlyFriendId = fDislikeOnlyRes.json.friend.id;
    createdFriendIds.push(dislikeOnlyFriendId);

    console.log("5. Scenario 7: Smart Friend Recommendation for 'หมูกระทะวันศุกร์'...");
    const recRes = await organizer.req("/api/activities/recommend", {
      method: "POST",
      body: JSON.stringify({
        title: "หมูกระทะวันศุกร์",
        category: "อาหารและสังสรรค์",
      }),
    });
    assert.equal(recRes.status, 200, "Recommend endpoint failed");
    assert.ok(
      recRes.json.detectedTags.includes("หมูกระทะ"),
      "Should detect หมูกระทะ from activity title"
    );
    assert.ok(recRes.json.matchingCount > 0, "Should match real friends in DB");

    const recMap = new Map(recRes.json.recommendations.map((r) => [r.id, r]));
    const recJoin = recMap.get(joinFriendId);
    assert.ok(recJoin && recJoin.matchScore > 0, "Test friend who likes หมูกระทะ should match");
    assert.ok(
      recJoin.recommendationReason.includes("หมูกระทะ"),
      "Recommendation reason should explain why friend was matched"
    );
    const recDislikeOnly = recMap.get(dislikeOnlyFriendId);
    assert.ok(
      recDislikeOnly && recDislikeOnly.matchScore === 0,
      "Disliked food must NEVER produce positive match score"
    );

    console.log("6. Creating activity + reviewing & generating 3 individual RSVP links...");
    const createAct = await organizer.req("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: `หมูกระทะวันศุกร์ E2E ${stamp}`,
        description: "นัดปาร์ตี้หมูกระทะเย็นวันศุกร์หลังเลิกงาน",
        category: "อาหารและสังสรรค์",
        activity_date: "2026-12-11",
        start_time: "18:30",
        end_time: "21:30",
        location: "ร้านหมูกระทะอารีย์",
        target_interests: ["หมูกระทะ"],
        friendIds: [joinFriendId, declineFriendId, dislikeOnlyFriendId],
      }),
    });
    assert.equal(createAct.status, 201, "Activity creation failed");
    const activityId = createAct.json.activity.id;
    createdActivityIds.push(activityId);
    assert.equal(createAct.json.generatedLinksCount, 3, "Expected 3 individual links");
    assert.ok(createAct.json.activity.organizer_name, "Missing organizer_name");

    console.log("7. Searching activities with ?q= filter and testing PATCH validation...");
    const searchAct = await organizer.req(
      `/api/activities?q=${encodeURIComponent(`E2E ${stamp}`)}`
    );
    assert.equal(searchAct.status, 200);
    assert.equal(searchAct.json.activities.length, 1);

    const badPatch = await organizer.req(`/api/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify({ start_time: "21:00", end_time: "20:00" }),
    });
    assert.equal(badPatch.status, 400, "PATCH with end_time <= start_time must reject 400");

    const okPatch = await organizer.req(`/api/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify({ location: "ร้านหมูกระทะสุขุมวิท" }),
    });
    assert.equal(okPatch.status, 200);
    assert.equal(okPatch.json.activity.location, "ร้านหมูกระทะสุขุมวิท");

    console.log("8. Opening individual RSVP links, duplicate submission check, & decline reason validation...");
    const detailBefore = await organizer.req(`/api/activities/${activityId}`);
    assert.equal(detailBefore.status, 200);
    assert.equal(detailBefore.json.stats.totalInvited, 3);
    assert.equal(detailBefore.json.stats.pending, 3);
    assert.equal(detailBefore.json.stats.responseRate, 0);

    const invByFriend = new Map(
      detailBefore.json.invitations.map((i) => [i.friend_id, i])
    );
    const invA = invByFriend.get(joinFriendId);
    const invB = invByFriend.get(declineFriendId);
    const invC = invByFriend.get(dislikeOnlyFriendId);
    const tokens = new Set([invA.invite_token, invB.invite_token, invC.invite_token]);
    assert.equal(tokens.size, 3, "Each friend must receive a unique individual RSVP token");

    // Public route /rsvp/[token] returns 200
    const rsvpPageRes = await fetch(`${BASE}/rsvp/${invA.invite_token}`);
    assert.equal(rsvpPageRes.status, 200, "Public RSVP page did not return 200");

    // Friend A opens and accepts
    const getRsvpA = await fetch(`${BASE}/api/public/rsvp/${invA.invite_token}`);
    assert.equal(getRsvpA.status, 200);
    const postRsvpA1 = await fetch(`${BASE}/api/public/rsvp/${invA.invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: "going", response_note: "ถึงร้าน 18:30" }),
    });
    assert.equal(postRsvpA1.status, 200);

    // Duplicate RSVP submit must NOT inflate Going count
    const postRsvpA2 = await fetch(`${BASE}/api/public/rsvp/${invA.invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: "going", response_note: "ยืนยันอีกครั้ง" }),
    });
    assert.equal(postRsvpA2.status, 200);

    // Friend B declines with 'อื่น ๆ' without details -> 400
    const badDecline = await fetch(`${BASE}/api/public/rsvp/${invB.invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: "not_going", decline_reason: "อื่น ๆ" }),
    });
    assert.equal(badDecline.status, 400, "Custom decline reason 'อื่น ๆ' must require note");

    // Friend B declines with note -> 200
    const okDecline = await fetch(`${BASE}/api/public/rsvp/${invB.invite_token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rsvp_status: "not_going",
        decline_reason: "อื่น ๆ",
        response_note: "ติดประชุมด่วนช่วงเย็น",
      }),
    });
    assert.equal(okDecline.status, 200);

    // Check Invitation Dashboard stats & grouped names (Friend C stays pending)
    const detailAfter = await organizer.req(`/api/activities/${activityId}`);
    assert.equal(detailAfter.status, 200);
    const s = detailAfter.json.stats;
    assert.equal(s.totalInvited, 3);
    assert.equal(s.going, 1, "Duplicate RSVP submission must not inflate going count");
    assert.equal(s.notGoing, 1);
    assert.equal(s.pending, 1);
    assert.equal(s.responseRate, 67);
    assert.ok(s.goingNames.includes(`P3Join_${stamp}`));
    assert.ok(s.pendingNames.includes(`P3Dislike_${stamp}`));
    assert.equal(s.notGoingNames[0].nickname, `P3Decline_${stamp}`);
    assert.equal(s.notGoingNames[0].reason, "อื่น ๆ");
    assert.equal(s.notGoingNames[0].note, "ติดประชุมด่วนช่วงเย็น");

    console.log("9. Scenario 8: Friend Registration Link -> Connect Without Duplicates -> Self-Service Profile...");
    const beforeFriendsCount = (await organizer.req("/api/friends")).json.friends.length;

    const regCreate = await organizer.req("/api/invitations/register", {
      method: "POST",
      body: JSON.stringify({
        label: `เชิญ P3Join ${stamp}`,
        prefill_friend_id: joinFriendId,
      }),
    });
    assert.equal(regCreate.status, 201);
    const regInv = regCreate.json.invitation;
    createdRegInviteIds.push(regInv.id);
    assert.ok(regInv.invite_token.startsWith("join-"));

    const invitePageRes = await fetch(`${BASE}/invite/${regInv.invite_token}`);
    assert.equal(invitePageRes.status, 200, "Public invite page did not return 200");

    // Must reject without explicit consent
    const noConsent = await friendClient.req(`/api/public/invite/${regInv.invite_token}`, {
      method: "POST",
      body: JSON.stringify({
        authMode: "register",
        email: joinEmail,
        password: "FriendPass123",
        nickname: `P3Join_${stamp}`,
        consent_given: false,
      }),
    });
    assert.equal(noConsent.status, 400, "Invite acceptance must require explicit consent");

    // Accept & register with explicit consent
    const uniqueTag = `มัทฉะลาเต้_${stamp}`;
    const acceptInvite = await friendClient.req(`/api/public/invite/${regInv.invite_token}`, {
      method: "POST",
      body: JSON.stringify({
        authMode: "register",
        email: joinEmail,
        password: "FriendPass123",
        nickname: `P3Join_${stamp}`,
        full_name: "เพื่อนทดสอบ ระบบ Phase3",
        contact_info: "@p3join_updated",
        consent_given: true,
        interests: [
          { category_slug: "food_preferences", value: "หมูกระทะ" },
          { category_slug: "food_preferences", value: uniqueTag },
          { category_slug: "disliked_food", value: "กุ้ง", restriction_type: "allergy" },
        ],
      }),
    });
    assert.equal(acceptInvite.status, 200, `Invite accept failed: ${JSON.stringify(acceptInvite.json)}`);
    assert.equal(acceptInvite.json.friendId, joinFriendId, "Must link to existing friend record");
    assert.equal(acceptInvite.json.authenticated, true);

    const afterFriendsCount = (await organizer.req("/api/friends")).json.friends.length;
    assert.equal(
      afterFriendsCount,
      beforeFriendsCount,
      "Registering via prefilled invite must NOT create a duplicate friend record"
    );

    console.log("10. Self-Service Profile (/api/my/profile) + Dynamic Segmentation Sync...");
    const myProfile1 = await friendClient.req("/api/my/profile");
    assert.equal(myProfile1.status, 200);
    assert.equal(myProfile1.json.profiles.length, 1);
    assert.equal(myProfile1.json.profiles[0].id, joinFriendId);
    assert.equal(myProfile1.json.invitations.length, 1);

    const dynamicTag = `บอร์ดเกมคาเฟ่_${stamp}`;
    const patchMyProfile = await friendClient.req("/api/my/profile", {
      method: "PATCH",
      body: JSON.stringify({
        friendId: joinFriendId,
        full_name: "เพื่อนทดสอบ อัปเดตเอง",
        nickname: `P3Join_${stamp}`,
        contact_info: "@p3join_self",
        interests: [
          { category_slug: "food_preferences", value: "หมูกระทะ" },
          { category_slug: "hobbies", value: dynamicTag },
          { category_slug: "disliked_food", value: "กุ้ง", restriction_type: "allergy" },
        ],
      }),
    });
    assert.equal(patchMyProfile.status, 200);

    // Check organizer dynamic segmentation immediately reflects friend's self-service change!
    const segCheck = await organizer.req(
      `/api/segments?interests=${encodeURIComponent(dynamicTag)}`
    );
    assert.equal(segCheck.status, 200);
    assert.ok(
      segCheck.json.friends.some((f) => f.id === joinFriendId),
      "Self-service interest update must reflect in segmentation immediately"
    );

    // Friend updates own RSVP via /api/my/invitations/[id]
    const myInvId = myProfile1.json.invitations[0].id;
    const selfRsvpUpdate = await friendClient.req(`/api/my/invitations/${myInvId}`, {
      method: "PATCH",
      body: JSON.stringify({
        rsvp_status: "not_going",
        decline_reason: "ติดงาน/เรียน",
        response_note: "ขอเป็นรอบหน้านะ",
      }),
    });
    assert.equal(selfRsvpUpdate.status, 200);
    assert.equal(selfRsvpUpdate.json.rsvp_status, "not_going");

    console.log("11. Verifying strict 403 authorization isolation against different user...");
    const intruderReg = await intruderClient.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Intruder User",
        email: intruderEmail,
        password: "IntruderPass123",
      }),
    });
    assert.equal(intruderReg.status, 201);

    const unauthAct = await intruderClient.req(`/api/activities/${activityId}`);
    assert.ok(unauthAct.status === 403 || unauthAct.status === 404);

    const hijackMyProfile = await intruderClient.req("/api/my/profile", {
      method: "PATCH",
      body: JSON.stringify({
        friendId: joinFriendId,
        full_name: "Hacked",
        nickname: "Hacked",
        interests: [],
      }),
    });
    assert.equal(hijackMyProfile.status, 403, "Must block editing another friend's profile");

    const hijackMyInv = await intruderClient.req(`/api/my/invitations/${myInvId}`, {
      method: "PATCH",
      body: JSON.stringify({ rsvp_status: "going" }),
    });
    assert.equal(hijackMyInv.status, 403, "Must block modifying another friend's invitation");

    const hijackPublicRsvp = await intruderClient.req(`/api/public/rsvp/${invA.invite_token}`, {
      method: "POST",
      body: JSON.stringify({ rsvp_status: "going" }),
    });
    assert.equal(hijackPublicRsvp.status, 403, "Must block another logged-in user altering linked friend's RSVP");

    const hijackInviteLink = await intruderClient.req(`/api/public/invite/${regInv.invite_token}`, {
      method: "POST",
      body: JSON.stringify({
        authMode: "guest",
        nickname: "Hijacker",
        consent_given: true,
      }),
    });
    assert.equal(hijackInviteLink.status, 403, "Must block hijacking already claimed invite link");

    const hijackOrgInvite = await intruderClient.req(`/api/invitations/activity/${invA.id}`, {
      method: "PATCH",
      body: JSON.stringify({ rsvp_status: "going" }),
    });
    assert.equal(hijackOrgInvite.status, 403, "Must return 403 when non-owner modifies activity invitation");

    console.log("ALL PHASE 3 ACCEPTANCE TESTS PASSED!");
  } finally {
    console.log("Cleaning up Phase 3 temporary test records...");
    for (const aid of createdActivityIds) {
      await organizer.req(`/api/activities/${aid}`, { method: "DELETE" });
    }
    for (const rid of createdRegInviteIds) {
      await organizer.req(`/api/invitations/register?id=${rid}`, { method: "DELETE" });
    }
    for (const fid of createdFriendIds) {
      await organizer.req(`/api/friends/${fid}`, { method: "DELETE" });
    }
    try {
      const dbPath = path.join(process.cwd(), "data", "chuan-di.db");
      const db = new DatabaseSync(dbPath);
      const delUser = db.prepare("DELETE FROM users WHERE email = ?");
      for (const em of createdTestEmails) {
        delUser.run(em);
      }
      db.close();
    } catch (cleanupErr) {
      console.error("DB user cleanup warning:", cleanupErr);
    }
  }
}

run().catch((err) => {
  console.error("PHASE 3 TEST FAILED:", err);
  process.exit(1);
});
