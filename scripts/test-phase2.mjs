import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";

class Client {
  constructor() {
    this.cookie = "";
  }

  async req(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${BASE}${path}`, {
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
  const client = new Client();

  console.log("1. Logging in with demo account...");
  const login = await client.req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "demo@chuan-di.app",
      password: "ChuanDiDemo123",
    }),
  });
  assert.equal(login.status, 200, "Demo login failed");

  console.log("2. Testing GET /interests/extract route...");
  const extractPageRes = await fetch(`${BASE}/interests/extract`);
  assert.equal(extractPageRes.status, 200, "/interests/extract route did not return 200");

  const createdFriendIds = [];
  const createdExtractedIds = [];

  const hasTuple = (list, friend, cat, val) =>
    list.some(
      (i) =>
        i.detected_friend_name === friend &&
        i.category_slug === cat &&
        i.normalized_value === val
    );

  try {
    console.log("3. Testing exact Phase 2 อลิส & บ็อบ prompt (multi-person + normalization + already_exists)...");
    const sample1 =
      "เพื่อนเราชื่อ อลิส ชอบกินหมูกระทะกับชาบู ไม่ชอบอาหารทะเล ชอบเที่ยวทะเลและถ่ายรูป ส่วน บ็อบ ชอบกาแฟ ชอบไปคาเฟ่ และชอบเดินทาง";
    const ext1 = await client.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({ rawText: sample1, sourceLabel: "phase2-test-alice-bob" }),
    });
    assert.equal(ext1.status, 200, "Extract failed");
    assert.ok(ext1.json.textInputId > 0, "Missing textInputId");
    const items1 = ext1.json.items || [];
    for (const d of items1) createdExtractedIds.push(d.extractedId);

    assert.ok(hasTuple(items1, "อลิส", "food_preferences", "หมูกระทะ"), "อลิส likes หมูกระทะ missing");
    assert.ok(hasTuple(items1, "อลิส", "food_preferences", "ชาบู"), "อลิส likes ชาบู missing");
    assert.ok(hasTuple(items1, "อลิส", "disliked_food", "อาหารทะเล"), "อลิส dislikes อาหารทะเล missing");
    assert.ok(hasTuple(items1, "อลิส", "travel_interests", "ทะเล"), "อลิส travel ทะเล missing");
    assert.ok(hasTuple(items1, "อลิส", "hobbies", "ถ่ายรูป"), "อลิส hobby ถ่ายรูป missing");

    assert.ok(hasTuple(items1, "บ็อบ", "food_preferences", "กาแฟ"), "บ็อบ likes กาแฟ missing");
    assert.ok(hasTuple(items1, "บ็อบ", "lifestyle", "คาเฟ่"), "บ็อบ lifestyle คาเฟ่ missing");
    assert.ok(hasTuple(items1, "บ็อบ", "travel_interests", "เดินทาง"), "บ็อบ travel เดินทาง missing");

    assert.ok(!hasTuple(items1, "บ็อบ", "food_preferences", "หมูกระทะ"), "บ็อบ incorrectly got อลิส's food");
    assert.ok(!hasTuple(items1, "อลิส", "food_preferences", "กาแฟ"), "อลิส incorrectly got บ็อบ's coffee");
    assert.ok(
      items1.some((i) => i.already_exists === true),
      "Demo อลิส/บ็อบ existing preferences should be flagged already_exists=true"
    );

    const conf1 = await client.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: ext1.json.textInputId, items: items1 }),
    });
    assert.equal(conf1.status, 200);
    assert.ok(
      conf1.json.savedInterestsCount + conf1.json.skippedExistingCount >= 8,
      "Combined saved + preserved count should be >= 8"
    );
    assert.ok(conf1.json.skippedExistingCount >= 1, "Existing verified interests must be preserved");

    console.log("4. Testing fresh friend extraction -> review reclassify -> confirm create...");
    const sampleFresh =
      "เพื่อนเราชื่อ PhaseAlice ชอบกินหมูกระทะกับชาบู ไม่ชอบอาหารทะเล ชอบเที่ยวทะเลและถ่ายรูป ส่วน PhaseBob ชอบกาแฟ ชอบไปคาเฟ่ และชอบเดินทาง";
    const extFresh = await client.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({ rawText: sampleFresh, sourceLabel: "phase2-fresh-pair" }),
    });
    assert.equal(extFresh.status, 200);
    const itemsFresh = extFresh.json.items || [];
    for (const d of itemsFresh) createdExtractedIds.push(d.extractedId);

    const confFresh = await client.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: extFresh.json.textInputId, items: itemsFresh }),
    });
    assert.equal(confFresh.status, 200);
    assert.equal(confFresh.json.savedInterestsCount, 8, "Expected 8 saved interests for fresh PhaseAlice & PhaseBob");
    assert.equal((confFresh.json.newlyCreatedFriends || []).length, 2, "Expected 2 new friends created");
    for (const nf of confFresh.json.newlyCreatedFriends || []) {
      createdFriendIds.push(nf.id);
    }

    console.log("5. Testing Normalization, Allergy vs Dislike, & Review Reclassification...");
    const sample2 = "เพื่อนชื่อ TestTae ชอบหมูย่างกระทะ แพ้ถั่ว ไม่กินของเผ็ด ชอบไปร้านกาแฟ";
    const ext2 = await client.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({ rawText: sample2, sourceLabel: "phase2-test-tae" }),
    });
    assert.equal(ext2.status, 200);
    const items2 = ext2.json.items || [];
    for (const d of items2) createdExtractedIds.push(d.extractedId);

    assert.ok(hasTuple(items2, "TestTae", "food_preferences", "หมูกระทะ"), "หมูย่างกระทะ -> หมูกระทะ failed");
    const cafeItem = items2.find(
      (i) => i.detected_friend_name === "TestTae" && i.normalized_value === "คาเฟ่"
    );
    assert.ok(cafeItem, "ร้านกาแฟ -> คาเฟ่ failed");
    const allergyItem = items2.find(
      (i) =>
        i.detected_friend_name === "TestTae" &&
        i.category_slug === "disliked_food" &&
        i.normalized_value.includes("ถั่ว")
    );
    assert.ok(allergyItem, "Allergy item missing");
    assert.equal(allergyItem.restriction_type, "allergy", "Allergy should have restriction_type='allergy'");

    // Reclassify cafeItem in Review before saving!
    cafeItem.category_slug = "other_interests";
    const conf2 = await client.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: ext2.json.textInputId, items: items2 }),
    });
    assert.equal(conf2.status, 200);
    for (const nf of conf2.json.newlyCreatedFriends || []) {
      createdFriendIds.push(nf.id);
    }

    console.log("6. Verifying saved profiles & existing-preference preservation...");
    const friendsListRes = await client.req("/api/friends");
    assert.equal(friendsListRes.status, 200);
    const allFriends = friendsListRes.json.friends || [];
    const pAlice = allFriends.find((f) => f.nickname === "PhaseAlice");
    const pBob = allFriends.find((f) => f.nickname === "PhaseBob");
    const tae = allFriends.find((f) => f.nickname === "TestTae");
    assert.ok(pAlice && pBob && tae, "PhaseAlice, PhaseBob, and TestTae must exist in DB");
    assert.ok(
      tae.interests.some((i) => i.normalized_value === "คาเฟ่" && i.category_slug === "other_interests"),
      "Reclassified category in Review should persist on profile"
    );
    assert.ok(
      tae.interests.some((i) => i.restriction_type === "allergy" && i.normalized_value.includes("ถั่ว")),
      "Allergy restriction_type should persist on friend profile"
    );

    // Re-extract PhaseAlice likes หมูกระทะ + variant หมูย่างกระทะ -> verify duplicate dedup & existing preservation
    const extDup = await client.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "PhaseAlice ชอบหมูกระทะกับหมูย่างกระทะ",
        sourceLabel: "phase2-dup-test",
      }),
    });
    assert.equal(extDup.status, 200);
    for (const d of extDup.json.items || []) createdExtractedIds.push(d.extractedId);
    assert.equal(extDup.json.items.length, 1, "Equivalent variant in same sentence must deduplicate to 1 draft");
    assert.ok(extDup.json.items[0].already_exists === true, "already_exists must be true for verified existing item");
    const confDup = await client.req("/api/nlp/confirm", {
      method: "POST",
      body: JSON.stringify({ textInputId: extDup.json.textInputId, items: extDup.json.items }),
    });
    assert.equal(confDup.status, 200);
    assert.equal(confDup.json.skippedExistingCount, 1, "Existing verified preference must be preserved unless overwritten");

    console.log("7. Verifying Traceability Log Edit/Reclassify (PATCH /api/nlp/history/[id])...");
    const patchRes = await client.req(`/api/nlp/history/${cafeItem.extractedId}`, {
      method: "PATCH",
      body: JSON.stringify({
        category_slug: "lifestyle",
        normalized_value: "คาเฟ่",
        confirmation_status: "confirmed",
      }),
    });
    assert.equal(patchRes.status, 200, "Traceability PATCH failed");
    const taeDetailRes = await client.req(`/api/friends/${tae.id}`);
    assert.ok(
      taeDetailRes.json.friend.interests.some(
        (i) => i.normalized_value === "คาเฟ่" && i.category_slug === "lifestyle"
      ),
      "Traceability edit should update friend profile category to lifestyle"
    );

    console.log("8. Testing Segmentation, Negative Exclusion Safety & Shared/Dislike Group Data...");
    const segPork = await client.req("/api/segments?interests=" + encodeURIComponent("หมูกระทะ"));
    assert.equal(segPork.status, 200);
    assert.ok(segPork.json.friends.some((f) => f.id === pAlice.id), "PhaseAlice must match หมูกระทะ");
    assert.ok(segPork.json.friends.some((f) => f.id === tae.id), "TestTae must match หมูกระทะ");
    assert.ok(!segPork.json.friends.some((f) => f.id === pBob.id), "PhaseBob must NOT match หมูกระทะ initially");
    assert.ok(
      segPork.json.relevantDislikes.some(
        (d) => d.friend_id === pAlice.id && d.normalized_value === "อาหารทะเล"
      ),
      "Relevant dislikes in group must surface PhaseAlice's อาหารทะเล"
    );

    // Negative Safety: searching positive interest "อาหารทะเล" MUST NOT return PhaseAlice!
    const segSeafoodPos = await client.req("/api/segments?interests=" + encodeURIComponent("อาหารทะเล"));
    assert.equal(segSeafoodPos.status, 200);
    assert.ok(
      !segSeafoodPos.json.friends.some((f) => f.id === pAlice.id),
      "NEGATIVE MATCH BUG: PhaseAlice dislikes อาหารทะเล and MUST NOT match positive search!"
    );

    // Explicit category=disliked_food search SHOULD return PhaseAlice
    const segSeafoodNeg = await client.req(
      "/api/segments?category=disliked_food&interests=" + encodeURIComponent("อาหารทะเล")
    );
    assert.ok(
      segSeafoodNeg.json.friends.some((f) => f.id === pAlice.id),
      "Explicit disliked_food filter should match PhaseAlice"
    );

    // Exclude "อาหารทะเล" from หมูกระทะ -> PhaseAlice excluded, TestTae kept
    const segExclude = await client.req(
      `/api/segments?interests=${encodeURIComponent("หมูกระทะ")}&exclude=${encodeURIComponent("อาหารทะเล")}`
    );
    assert.ok(!segExclude.json.friends.some((f) => f.id === pAlice.id), "PhaseAlice should be excluded");
    assert.ok(segExclude.json.friends.some((f) => f.id === tae.id), "TestTae should remain");

    console.log("9. Testing Dynamic Segment Update after editing PhaseBob's preferences...");
    const bobUpdate = await client.req(`/api/friends/${pBob.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: pBob.full_name,
        nickname: pBob.nickname,
        interests: [
          ...pBob.interests.map((i) => ({
            category_slug: i.category_slug,
            normalized_value: i.normalized_value,
          })),
          { category_slug: "food_preferences", normalized_value: "หมูกระทะ" },
        ],
      }),
    });
    assert.equal(bobUpdate.status, 200, "Updating PhaseBob failed");
    const segPorkAfter = await client.req("/api/segments?interests=" + encodeURIComponent("หมูกระทะ"));
    assert.ok(
      segPorkAfter.json.friends.some((f) => f.id === pBob.id),
      "Dynamic segmentation should immediately include PhaseBob after adding หมูกระทะ"
    );

    console.log("10. Testing Saved Segments CRUD...");
    const saveSeg = await client.req("/api/segments/saved", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Saved Pork Group",
        include_interests: ["หมูกระทะ"],
        exclude_interests: ["อาหารทะเล"],
        match_mode: "all",
      }),
    });
    assert.equal(saveSeg.status, 201);
    const savedId = saveSeg.json.segment.id;
    const listSeg = await client.req("/api/segments/saved");
    assert.ok(listSeg.json.segments.some((s) => s.id === savedId), "Saved segment not listed");
    const delSeg = await client.req(`/api/segments/saved?id=${savedId}`, { method: "DELETE" });
    assert.equal(delSeg.status, 200);

    console.log("11. Testing Insights API & Ambiguous Input Handling...");
    const insRes = await client.req(
      "/api/interests/insights?category=food_preferences&q=" + encodeURIComponent("หมูกระทะ")
    );
    assert.equal(insRes.status, 200);
    assert.ok(insRes.json.filteredTerms.length > 0, "Insights filtered terms empty");
    assert.ok(insRes.json.mostPopularFoods.length > 0, "Popular foods empty");
    assert.ok(insRes.json.dislikesAndAllergies.length > 0, "Dislikes/allergies empty");
    assert.ok(insRes.json.similarFriendPairs.length > 0, "Similar friend pairs empty");

    const ambExt = await client.req("/api/nlp/extract", {
      method: "POST",
      body: JSON.stringify({
        rawText: "เพื่อนเราคนนึงอาจจะชอบไปคาเฟ่มั้ง ไม่แน่ใจ",
        sourceLabel: "phase2-ambiguous-test",
      }),
    });
    assert.equal(ambExt.status, 200);
    for (const d of ambExt.json.items || []) createdExtractedIds.push(d.extractedId);
    assert.ok(
      (ambExt.json.warnings || []).length > 0 ||
        (ambExt.json.items || []).some((i) => i.is_ambiguous === true),
      "Ambiguous input must produce warnings or is_ambiguous=true"
    );

    console.log("ALL PHASE 2 ACCEPTANCE TESTS PASSED!");
  } finally {
    console.log("Cleaning up temporary test friends & traceability rows...");
    for (const edId of createdExtractedIds) {
      await client.req(`/api/nlp/history/${edId}`, { method: "DELETE" });
    }
    for (const fId of createdFriendIds) {
      await client.req(`/api/friends/${fId}`, { method: "DELETE" });
    }
  }
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
