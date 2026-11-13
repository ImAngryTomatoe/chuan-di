import { getDb, getFriendsWithInterests } from "./db";
import { buildGroupDietarySnapshot, generateSmartGroupPlans } from "./plans";
import { CATEGORY_META, CategorySlug, inferDietaryCategory } from "./types";

export interface NongChuanSuggestion {
  id: string;
  pose: "happy" | "excited" | "curious" | "thinking" | "cool" | "cheering" | "love" | "welcome" | "sleepy";
  title: string;
  message: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
  highlightCount?: number;
  tag?: string;
}

export interface InterestCountRow {
  normalized_value: string;
  category_slug: CategorySlug;
  category_name_th: string;
  color: string;
  friend_count: number;
  friend_nicknames: string | null;
}

export interface SimilarFriendPair {
  friendA: { id: number; nickname: string; full_name: string };
  friendB: { id: number; nickname: string; full_name: string };
  sharedInterests: string[];
  score: number;
}

export interface SegmentSizeItem {
  id: string;
  name: string;
  friendCount: number;
  tags: string[];
  href: string;
  source: "saved" | "dynamic";
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatNicknamePreview(nicknamesCsv: string | string[] | null | undefined, limit = 4): string {
  if (!nicknamesCsv) return "";
  const rawList = Array.isArray(nicknamesCsv) ? nicknamesCsv : nicknamesCsv.split(",");
  const list = rawList.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return "";
  const preview = list.slice(0, limit).join(", ");
  return list.length > limit ? `${preview} และอีก ${list.length - limit} คน` : preview;
}

export function getDashboardAndInsights(userId: number) {
  const db = getDb();

  const totalFriends = (
    db.prepare("SELECT COUNT(*) as c FROM friends WHERE user_id = ?").get(userId) as { c: number }
  ).c;

  const totalRecordedInterests = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM friend_interests fi
         JOIN friends f ON f.id = fi.friend_id
         WHERE f.user_id = ?`
      )
      .get(userId) as { c: number }
  ).c;

  const totalActivities = (
    db.prepare("SELECT COUNT(*) as c FROM activities WHERE user_id = ?").get(userId) as { c: number }
  ).c;

  const pendingInvitations = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM activity_invitations ai
         JOIN activities a ON a.id = ai.activity_id
         WHERE a.user_id = ? AND ai.rsvp_status = 'pending'`
      )
      .get(userId) as { c: number }
  ).c;

  const rsvpSummary = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN ai.rsvp_status = 'going' THEN 1 ELSE 0 END) as going_count,
         SUM(CASE WHEN ai.rsvp_status = 'not_going' THEN 1 ELSE 0 END) as not_going_count,
         SUM(CASE WHEN ai.rsvp_status = 'pending' THEN 1 ELSE 0 END) as pending_count
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE a.user_id = ?`
    )
    .get(userId) as {
    total: number;
    going_count: number | null;
    not_going_count: number | null;
    pending_count: number | null;
  };

  // Decline reasons breakdown from real DB
  const declineReasons = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(ai.decline_reason), ''), 'ไม่ระบุเหตุผล') as reason,
              COUNT(*) as count
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       WHERE a.user_id = ? AND ai.rsvp_status = 'not_going'
       GROUP BY reason
       ORDER BY count DESC`
    )
    .all(userId) as unknown as Array<{ reason: string; count: number }>;

  // Top interests overall with nicknames for transparent AI Friend Assistant explanations
  const interestStats = db
    .prepare(
      `SELECT i.normalized_value, ic.slug as category_slug, ic.name_th as category_name_th,
              ic.color, COUNT(DISTINCT fi.friend_id) as friend_count,
              GROUP_CONCAT(DISTINCT f.nickname) as friend_nicknames
       FROM friend_interests fi
       JOIN friends f ON f.id = fi.friend_id
       JOIN interests i ON i.id = fi.interest_id
       JOIN interest_categories ic ON ic.id = i.category_id
       WHERE f.user_id = ?
       GROUP BY i.id
       ORDER BY friend_count DESC, i.normalized_value ASC`
    )
    .all(userId) as unknown as InterestCountRow[];

  const accurateCatRows = db
    .prepare(
      `SELECT ic.slug, ic.name_th, ic.color,
              (
                SELECT COUNT(*) FROM friend_interests fi2
                JOIN interests i2 ON i2.id = fi2.interest_id
                JOIN friends f2 ON f2.id = fi2.friend_id
                WHERE i2.category_id = ic.id AND f2.user_id = ?
              ) as count
       FROM interest_categories ic
       ORDER BY count DESC`
    )
    .all(userId) as unknown as Array<{ slug: CategorySlug; name_th: string; color: string; count: number }>;

  const topPositive = interestStats.filter((r) => r.category_slug !== "disliked_food").slice(0, 8);
  const topFood = interestStats.filter((r) => r.category_slug === "food_preferences").slice(0, 6);
  const topDislikes = interestStats.filter((r) => r.category_slug === "disliked_food").slice(0, 6);
  const topHobbies = interestStats.filter((r) => r.category_slug === "hobbies").slice(0, 6);
  const topTravel = interestStats.filter((r) => r.category_slug === "travel_interests").slice(0, 6);

  // Activities overview
  const activities = db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id) as total_invited,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'going') as going_count,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'not_going') as not_going_count,
              (SELECT COUNT(*) FROM activity_invitations ai WHERE ai.activity_id = a.id AND ai.rsvp_status = 'pending') as pending_count
       FROM activities a
       WHERE a.user_id = ?
       ORDER BY a.activity_date ASC, a.start_time ASC`
    )
    .all(userId) as unknown as Array<{
    id: number;
    title: string;
    description: string;
    category: string;
    activity_date: string;
    start_time: string;
    end_time: string | null;
    location: string;
    target_interests_json: string;
    status: string;
    created_at: string;
    total_invited: number;
    going_count: number;
    not_going_count: number;
    pending_count: number;
  }>;

  const upcomingActivities = activities.slice(0, 4);
  const recentActivities = [...activities].sort((a, b) => b.id - a.id).slice(0, 4);
  const mostPopularActivities = [...activities]
    .sort((a, b) => b.going_count - a.going_count || b.total_invited - a.total_invited)
    .slice(0, 4);

  const pendingList = db
    .prepare(
      `SELECT ai.id, ai.activity_id, a.title as activity_title, a.activity_date, a.start_time,
              ai.friend_id, f.nickname as friend_nickname, ai.invite_token
       FROM activity_invitations ai
       JOIN activities a ON a.id = ai.activity_id
       JOIN friends f ON f.id = ai.friend_id
       WHERE a.user_id = ? AND ai.rsvp_status = 'pending'
       ORDER BY a.activity_date ASC, f.nickname ASC
       LIMIT 8`
    )
    .all(userId) as unknown as Array<{
    id: number;
    activity_id: number;
    activity_title: string;
    activity_date: string;
    start_time: string;
    friend_id: number;
    friend_nickname: string;
    invite_token: string;
  }>;

  // Evaluate friend segment sizes dynamically (Saved Segments + Top Interest Clusters)
  const allFriends = getFriendsWithInterests(userId);
  const savedSegRows = db
    .prepare(
      `SELECT id, name, include_interests_json, exclude_interests_json, category_filter, match_mode
       FROM saved_segments
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`
    )
    .all(userId) as unknown as Array<{
    id: number;
    name: string;
    include_interests_json: string;
    exclude_interests_json: string;
    category_filter: string | null;
    match_mode: string;
  }>;

  const segmentSizes: SegmentSizeItem[] = [];
  for (const seg of savedSegRows) {
    const includeTags = parseJsonStringArray(seg.include_interests_json).map((t) => t.toLowerCase());
    const excludeTags = parseJsonStringArray(seg.exclude_interests_json).map((t) => t.toLowerCase());
    const catFilter = (seg.category_filter || "").trim();
    const matchAll = seg.match_mode === "all";

    const matchingFriends = allFriends.filter((f) => {
      const positive = f.interests.filter(
        (i) => i.category_slug !== "disliked_food" && (!catFilter || i.category_slug === catFilter)
      );
      const posSet = new Set(positive.map((i) => i.normalized_value.toLowerCase()));
      const allTerms = new Set(f.interests.map((i) => i.normalized_value.toLowerCase()));

      if (excludeTags.some((ex) => allTerms.has(ex))) return false;
      if (includeTags.length === 0) return catFilter ? positive.length > 0 : true;
      return matchAll
        ? includeTags.every((t) => posSet.has(t))
        : includeTags.some((t) => posSet.has(t));
    });

    const firstTag = parseJsonStringArray(seg.include_interests_json)[0] || "";

    segmentSizes.push({
      id: `saved-${seg.id}`,
      name: seg.name,
      friendCount: matchingFriends.length,
      tags: parseJsonStringArray(seg.include_interests_json),
      href: firstTag ? `/friends?interest=${encodeURIComponent(firstTag)}` : "/friends",
      source: "saved",
    });
  }

  // Fill with top dynamic interest clusters up to 6 items without duplicate labels
  const usedSegNames = new Set(segmentSizes.map((s) => s.name));
  for (const row of topPositive) {
    if (segmentSizes.length >= 6) break;
    const dynamicName = `กลุ่ม${row.normalized_value}`;
    if (usedSegNames.has(dynamicName) || usedSegNames.has(`แก๊ง${row.normalized_value}`)) continue;
    segmentSizes.push({
      id: `dyn-${row.normalized_value}`,
      name: row.normalized_value,
      friendCount: row.friend_count,
      tags: [row.normalized_value],
      href: `/friends?interest=${encodeURIComponent(row.normalized_value)}`,
      source: "dynamic",
    });
    usedSegNames.add(row.normalized_value);
  }

  // Similar friend pairs (positive interests overlap >= 2)
  const friendInterestsMap = new Map<
    number,
    { id: number; nickname: string; full_name: string; tags: Set<string> }
  >();
  for (const f of allFriends) {
    const positiveTags = new Set(
      f.interests
        .filter((i) => i.category_slug !== "disliked_food")
        .map((i) => i.normalized_value)
    );
    if (positiveTags.size > 0) {
      friendInterestsMap.set(f.id, {
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        tags: positiveTags,
      });
    }
  }

  const friendList = Array.from(friendInterestsMap.values());
  const similarPairs: SimilarFriendPair[] = [];
  for (let i = 0; i < friendList.length; i++) {
    for (let j = i + 1; j < friendList.length; j++) {
      const a = friendList[i];
      const b = friendList[j];
      const shared: string[] = [];
      a.tags.forEach((tag) => {
        if (b.tags.has(tag)) shared.push(tag);
      });
      if (shared.length >= 2) {
        similarPairs.push({
          friendA: { id: a.id, nickname: a.nickname, full_name: a.full_name },
          friendB: { id: b.id, nickname: b.nickname, full_name: b.full_name },
          sharedInterests: shared,
          score: shared.length,
        });
      }
    }
  }
  similarPairs.sort((x, y) => y.score - x.score);

  // Build data-driven Nong Chuan proactive insights (never fabricated!)
  const suggestions: NongChuanSuggestion[] = [];

  if (totalFriends === 0) {
    suggestions.push({
      id: "empty-friends",
      pose: "sleepy",
      title: "ยังไม่มีข้อมูลเพื่อนในระบบ",
      message: "เริ่มต้นด้วยการตั้งค่าโปรไฟล์ของคุณ แล้วแอดเพื่อนที่ใช้ CHUAN-DI ด้วยกัน เพื่อซิงก์ความชอบและอาหารอัตโนมัติ",
      reason: "ฐานข้อมูลยังไม่มีรายชื่อเพื่อน",
      actionLabel: "แอดเพื่อนในแอป",
      actionHref: "/friends?add=1",
    });
  } else {
    // Dietary & Halal group awareness insight from real DB records
    const dietaryLabelMap = new Map<string, string[]>();
    const halalNicknames: string[] = [];
    const noPorkNicknames: string[] = [];
    const allergyNicknames: string[] = [];
    for (const f of allFriends) {
      const labels = (f.dietary_restrictions || []).map((d) => d.restriction_label);
      for (const lbl of labels) {
        const arr = dietaryLabelMap.get(lbl) || [];
        arr.push(f.nickname);
        dietaryLabelMap.set(lbl, arr);
      }
      const hasHalal = labels.includes("ต้องการอาหารฮาลาล") || f.religion === "อิสลาม";
      const hasNoPork = labels.includes("ไม่กินหมู");
      const hasAllergy =
        labels.some((l) => l.startsWith("แพ้")) ||
        f.interests.some((i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy");
      if (hasHalal) halalNicknames.push(f.nickname);
      if (hasNoPork) noPorkNicknames.push(f.nickname);
      if (hasAllergy) allergyNicknames.push(f.nickname);
    }

    const topFoodItem = topFood[0];
    if (halalNicknames.length > 0 || allergyNicknames.length > 0) {
      const foodClause =
        topFoodItem && topFoodItem.friend_count >= 2
          ? `ในกลุ่มเพื่อนที่ชอบ ${topFoodItem.normalized_value} (${topFoodItem.friend_count} คน) `
          : "";
      const halalPart =
        halalNicknames.length > 0
          ? `มีเพื่อน ${halalNicknames.length} คนต้องการอาหารฮาลาล (${formatNicknamePreview(halalNicknames)})`
          : "";
      const allergyPart =
        allergyNicknames.length > 0
          ? `และมีเพื่อน ${allergyNicknames.length} คนมีอาหารที่แพ้ (${formatNicknamePreview(allergyNicknames)})`
          : "";
      suggestions.push({
        id: "dietary-halal-awareness",
        pose: "thinking",
        title: "ข้อจำกัดด้านอาหารที่ควรเช็กก่อนชวน",
        message: `${foodClause}${[halalPart, allergyPart].filter(Boolean).join(" ")} น้องชวนแนะนำเช็กร้านให้รองรับทุกคนก่อนนัดนะ`,
        reason: `คำนวณจากข้อมูลจริงของเพื่อน ${totalFriends} คน${noPorkNicknames.length > 0 ? ` · ไม่กินหมู ${noPorkNicknames.length} คน` : ""}`,
        actionLabel: "ดูรายชื่อเพื่อนที่มีข้อจำกัดด้านอาหาร",
        actionHref:
          halalNicknames.length > 0
            ? `/friends?dietary=${encodeURIComponent("ต้องการอาหารฮาลาล")}`
            : "/friends?allergy=only",
        highlightCount: halalNicknames.length || allergyNicknames.length,
      });
    }

    // 1. Top food / BBQ opportunity
    if (topFoodItem && topFoodItem.friend_count >= 2) {
      const namesPreview = formatNicknamePreview(topFoodItem.friend_nicknames);
      const countText =
        topFoodItem.friend_count > 8
          ? `มีเพื่อนชอบ ${topFoodItem.normalized_value} รวม ${topFoodItem.friend_count} คน ลองชวนวงเล็ก 5–8 คนนัดทานด้วยกันไหม?`
          : `มีเพื่อน ${topFoodItem.friend_count} คนที่ชอบ ${topFoodItem.normalized_value} นัดทานด้วยกันกำลังดีเลย`;
      suggestions.push({
        id: `food-${topFoodItem.normalized_value}`,
        pose: "excited",
        title: `กลุ่มเพื่อนที่ชอบ ${topFoodItem.normalized_value}`,
        message: countText,
        reason: `พบข้อมูลหมวด ${CATEGORY_META.food_preferences.name_th} ที่ตรงกัน ได้แก่ ${namesPreview} จากทั้งหมด ${totalFriends} คน`,
        actionLabel: `ชวนวงเล็กไป ${topFoodItem.normalized_value}`,
        actionHref: `/activities/new?tag=${encodeURIComponent(topFoodItem.normalized_value)}`,
        highlightCount: topFoodItem.friend_count,
        tag: topFoodItem.normalized_value,
      });
    }

    // 2. Travel or Cafe cluster opportunity
    const cafeRow = interestStats.find(
      (r) =>
        r.category_slug !== "disliked_food" &&
        (r.normalized_value === "คาเฟ่" || r.normalized_value === "สายคาเฟ่")
    );
    const topTravelItem = topTravel[0];
    if (topTravelItem && topTravelItem.friend_count >= 2) {
      const namesPreview = formatNicknamePreview(topTravelItem.friend_nicknames);
      suggestions.push({
        id: `travel-${topTravelItem.normalized_value}`,
        pose: "cheering",
        title: `กลุ่มความสนใจด้านการเที่ยว ${topTravelItem.normalized_value}`,
        message: `มีเพื่อน ${topTravelItem.friend_count} คนที่สนใจ ${topTravelItem.normalized_value} จัดทริป 4–8 คนกำลังลงตัว`,
        reason: `พบเพื่อนในหมวด ${CATEGORY_META.travel_interests.name_th} ที่สนใจ ${topTravelItem.normalized_value} ได้แก่ ${namesPreview}`,
        actionLabel: `ดูเพื่อนที่ชอบ ${topTravelItem.normalized_value}`,
        actionHref: `/friends?interest=${encodeURIComponent(topTravelItem.normalized_value)}`,
        highlightCount: topTravelItem.friend_count,
        tag: topTravelItem.normalized_value,
      });
    } else if (cafeRow && cafeRow.friend_count >= 2) {
      const namesPreview = formatNicknamePreview(cafeRow.friend_nicknames);
      suggestions.push({
        id: "lifestyle-cafe",
        pose: "cheering",
        title: "กลุ่มเพื่อนสายคาเฟ่พร้อมนัดหมาย",
        message: `มีเพื่อน ${cafeRow.friend_count} คนที่สนใจกิจกรรมคาเฟ่ ชวนไปนั่งชิล 4–6 คนกำลังพอดี`,
        reason: `พบเพื่อนที่สนใจ ${cafeRow.normalized_value} ได้แก่ ${namesPreview}`,
        actionLabel: "ดูเพื่อนสายคาเฟ่",
        actionHref: `/friends?interest=${encodeURIComponent(cafeRow.normalized_value)}`,
        highlightCount: cafeRow.friend_count,
        tag: cafeRow.normalized_value,
      });
    }

    // 3. Cafe / Hobby cluster
    const topHobbyItem = topHobbies[0];
    if (topHobbyItem && topHobbyItem.friend_count >= 2) {
      const namesPreview = formatNicknamePreview(topHobbyItem.friend_nicknames);
      suggestions.push({
        id: `hobby-${topHobbyItem.normalized_value}`,
        pose: "thinking",
        title: `กิจกรรมแนะนำ: ${topHobbyItem.normalized_value}`,
        message: `พบเพื่อน ${topHobbyItem.friend_count} คนที่มีงานอดิเรก ${topHobbyItem.normalized_value} ตรงกัน เลือกชวนวง 4–8 คนได้ทันที`,
        reason: `คำนวณจากหมวด ${CATEGORY_META.hobbies.name_th} ได้แก่ ${namesPreview}`,
        actionLabel: "สร้างกิจกรรมจากความสนใจนี้",
        actionHref: `/activities/new?tag=${encodeURIComponent(topHobbyItem.normalized_value)}`,
        highlightCount: topHobbyItem.friend_count,
        tag: topHobbyItem.normalized_value,
      });
    }

    // 4. Pending RSVPs reminder
    if (pendingInvitations > 0) {
      const distinctPendingRow = db
        .prepare(
          `SELECT COUNT(DISTINCT ai.friend_id) as c
           FROM activity_invitations ai
           JOIN activities a ON a.id = ai.activity_id
           WHERE a.user_id = ? AND ai.rsvp_status = 'pending'`
        )
        .get(userId) as { c: number };
      const pendingFriendCount = distinctPendingRow.c || pendingInvitations;
      const pendingFriends = Array.from(new Set(pendingList.map((p) => p.friend_nickname)));
      const pendingActivities = Array.from(new Set(pendingList.map((p) => p.activity_title)));
      const previewFriends = pendingFriends.slice(0, 4).join(", ");
      const previewActivities = pendingActivities.slice(0, 2).join(", ");
      suggestions.push({
        id: "pending-rsvps",
        pose: "curious",
        title: `ติดตามคำเชิญที่รอการตอบรับ · ${pendingInvitations} รายการ`,
        message: `มีเพื่อน ${pendingFriendCount} คน รวม ${pendingInvitations} คำเชิญที่ยังรอการตอบกลับ`,
        reason: `รอการตอบรับจาก ${previewFriends}${previewActivities ? ` ในกิจกรรม ${previewActivities}` : ""}`,
        actionLabel: "จัดการคำเชิญทั้งหมด",
        actionHref: "/invitations?status=pending",
        highlightCount: pendingInvitations,
      });
    }

    // 5. Missing interests check
    const missingFriends = db
      .prepare(
        `SELECT f.nickname FROM friends f
         WHERE f.user_id = ? AND NOT EXISTS (
           SELECT 1 FROM friend_interests fi WHERE fi.friend_id = f.id
         )
         ORDER BY f.id DESC`
      )
      .all(userId) as unknown as Array<{ nickname: string }>;

    if (missingFriends.length > 0) {
      const preview = missingFriends
        .slice(0, 4)
        .map((m) => m.nickname)
        .join(", ");
      suggestions.push({
        id: "missing-profile-data",
        pose: "curious",
        title: `มีเพื่อน ${missingFriends.length} คนที่ยังไม่มีข้อมูลความชอบ`,
        message: "ส่งลิงก์เชิญเข้าแอป หรือแอดเพื่อนที่ใช้ CHUAN-DI ด้วยกัน เพื่อซิงก์ความชอบและข้อจำกัดด้านอาหารอัตโนมัติ",
        reason: `รายชื่อที่ยังไม่มีข้อมูลความชอบ: ${preview}`,
        actionLabel: "แอดเพื่อนในแอป",
        actionHref: "/friends?add=1",
        highlightCount: missingFriends.length,
      });
    }
  }

  const dietarySnapshot = buildGroupDietarySnapshot(allFriends);
  const recommendedPlans = generateSmartGroupPlans(allFriends);

  const dietaryCountsMap = new Map<string, number>();
  for (const f of allFriends) {
    for (const d of f.dietary_restrictions || []) {
      dietaryCountsMap.set(
        d.restriction_label,
        (dietaryCountsMap.get(d.restriction_label) || 0) + 1
      );
    }
  }
  const dietaryBreakdown = Array.from(dietaryCountsMap.entries())
    .map(([label, friend_count]) => ({
      label,
      friend_count,
      restriction_label: label,
      restriction_category: inferDietaryCategory(label),
    }))
    .sort((a, b) => b.friend_count - a.friend_count);

  const friendsOverview = allFriends.map((f) => {
    const favoriteFoods = f.interests
      .filter((i) => i.category_slug === "food_preferences")
      .map((i) => i.normalized_value);
    const allergies = f.interests
      .filter((i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy")
      .map((i) => i.normalized_value);
    const dislikedFoods = f.interests
      .filter((i) => i.category_slug === "disliked_food" && i.restriction_type !== "allergy")
      .map((i) => i.normalized_value);
    const dietaryRestrictions = (f.dietary_restrictions || []).map((d) => d.restriction_label);
    const hobbies = f.interests
      .filter((i) => i.category_slug === "hobbies")
      .map((i) => i.normalized_value);
    const travel = f.interests
      .filter((i) => i.category_slug === "travel_interests")
      .map((i) => i.normalized_value);

    return {
      id: f.id,
      nickname: f.nickname,
      full_name: f.full_name,
      religion: f.religion || "ไม่ระบุ",
      can_eat: f.can_eat || "",
      cannot_eat: f.cannot_eat || "",
      personal_notes: f.personal_notes || "",
      contact_info: f.contact_info || "",
      avatar_color: f.avatar_color,
      favoriteFoods,
      allergies,
      dislikedFoods,
      dietaryRestrictions,
      hobbies,
      travel,
      totalInterests: f.interests.length,
    };
  });

  return {
    engineMode: "rule_based_real_db",
    summary: {
      totalFriends,
      totalRecordedInterests,
      totalActivities,
      pendingInvitations,
      rsvpSummary: {
        total: rsvpSummary.total || 0,
        going: rsvpSummary.going_count || 0,
        notGoing: rsvpSummary.not_going_count || 0,
        pending: rsvpSummary.pending_count || 0,
      },
    },
    charts: {
      topPositive,
      topFood,
      topDislikes,
      topHobbies,
      topTravel,
      categoryBreakdown: accurateCatRows,
      segmentSizes,
      declineReasons,
    },
    activities: {
      upcoming: upcomingActivities,
      recent: recentActivities,
      mostPopular: mostPopularActivities,
      pendingList,
    },
    friendsOverview,
    dietarySnapshot,
    dietaryBreakdown,
    recommendedPlans,
    similarPairs: similarPairs.slice(0, 6),
    suggestions,
  };
}
