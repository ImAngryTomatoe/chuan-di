import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getFriendsWithInterests } from "@/lib/db";

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const interestsParam = searchParams.get("interests") || "";
  const excludeParam = searchParams.get("exclude") || "";
  const dietaryParam = searchParams.get("dietary") || "";
  const category = (searchParams.get("category") || "").trim();
  const mode = searchParams.get("mode") === "all" ? "all" : "any";
  const dietaryMode = searchParams.get("dietaryMode") === "any" ? "any" : "all";

  const selectedInterests = interestsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const excludedInterests = excludeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedDietary = dietaryParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const db = getDb();
  const availableInterests = db
    .prepare(
      `SELECT i.normalized_value, ic.slug as category_slug, ic.name_th as category_name_th,
              COUNT(DISTINCT fi.friend_id) as friend_count
       FROM friend_interests fi
       JOIN friends f ON f.id = fi.friend_id
       JOIN interests i ON i.id = fi.interest_id
       JOIN interest_categories ic ON ic.id = i.category_id
       WHERE f.user_id = ?
       GROUP BY i.id
       ORDER BY friend_count DESC, i.normalized_value ASC`
    )
    .all(user.id);

  const availableDietary = db
    .prepare(
      `SELECT fdr.restriction_label, fdr.restriction_category,
              COUNT(DISTINCT fdr.friend_id) as friend_count
       FROM friend_dietary_restrictions fdr
       JOIN friends f ON f.id = fdr.friend_id
       WHERE f.user_id = ?
       GROUP BY fdr.restriction_label, fdr.restriction_category
       ORDER BY friend_count DESC, fdr.restriction_label ASC`
    )
    .all(user.id);

  const allFriends = getFriendsWithInterests(user.id);

  const matchingFriends = allFriends.filter((friend) => {
    const positiveTags = new Set(
      friend.interests
        .filter((i) => i.category_slug !== "disliked_food")
        .map((i) => i.normalized_value.toLowerCase())
    );
    const dislikedTags = new Set(
      friend.interests
        .filter((i) => i.category_slug === "disliked_food")
        .map((i) => i.normalized_value.toLowerCase())
    );
    const dietaryTags = new Set(
      (friend.dietary_restrictions || []).map((d) => d.restriction_label.toLowerCase())
    );
    // Also map structured allergies into canonical dietary filter labels
    for (const i of friend.interests) {
      if (i.category_slug === "disliked_food" && i.restriction_type === "allergy") {
        const lower = i.normalized_value.toLowerCase();
        if (/กุ้ง|ปู|หอย|หมึก|อาหารทะเล|ซีฟู้ด/.test(lower)) dietaryTags.add("แพ้อาหารทะเล");
        if (/ถั่ว|อัลมอนด์/.test(lower)) dietaryTags.add("แพ้ถั่ว");
        if (/นม|แลคโตส/.test(lower)) dietaryTags.add("แพ้นม");
      }
    }

    const allTags = new Set([
      ...friend.interests.map((i) => i.normalized_value.toLowerCase()),
      ...Array.from(dietaryTags),
    ]);

    if (category) {
      const hasCat = friend.interests.some((i) => i.category_slug === category);
      if (!hasCat) return false;
    }

    if (excludedInterests.length > 0) {
      const hasExcluded = excludedInterests.some((ex) => allTags.has(ex.toLowerCase()));
      if (hasExcluded) return false;
    }

    if (selectedDietary.length > 0) {
      const dietaryOk =
        dietaryMode === "any"
          ? selectedDietary.some((tag) => dietaryTags.has(tag.toLowerCase()))
          : selectedDietary.every((tag) => dietaryTags.has(tag.toLowerCase()));
      if (!dietaryOk) return false;
    }

    if (selectedInterests.length === 0) return true;

    // Negative preferences / allergies MUST NOT match positive interest searches.
    // Only match disliked_food tags when explicitly filtering by category === "disliked_food".
    const searchableTags = category === "disliked_food" ? dislikedTags : positiveTags;

    if (mode === "all") {
      return selectedInterests.every((tag) => searchableTags.has(tag.toLowerCase()));
    }
    return selectedInterests.some((tag) => searchableTags.has(tag.toLowerCase()));
  });

  // Compute shared positive interests & relevant dislikes/restrictions in the matching group
  const sharedInterestMap = new Map<
    string,
    { normalized_value: string; category_slug: string; count: number }
  >();
  const relevantDislikes: Array<{
    friend_id: number;
    friend_nickname: string;
    normalized_value: string;
    restriction_type: string;
  }> = [];

  for (const friend of matchingFriends) {
    const seenPositive = new Set<string>();
    for (const item of friend.interests) {
      if (item.category_slug === "disliked_food") {
        relevantDislikes.push({
          friend_id: friend.id,
          friend_nickname: friend.nickname,
          normalized_value: item.normalized_value,
          restriction_type: item.restriction_type || "dislike",
        });
        continue;
      }

      const key = `${item.category_slug}:${item.normalized_value.toLowerCase()}`;
      if (seenPositive.has(key)) continue;
      seenPositive.add(key);

      const cur = sharedInterestMap.get(key) || {
        normalized_value: item.normalized_value,
        category_slug: item.category_slug,
        count: 0,
      };
      cur.count += 1;
      sharedInterestMap.set(key, cur);
    }
  }

  const minSharedCount = matchingFriends.length >= 2 ? 2 : 1;
  const sharedInterests = Array.from(sharedInterestMap.values())
    .filter((entry) => entry.count >= minSharedCount)
    .sort((a, b) => b.count - a.count || a.normalized_value.localeCompare(b.normalized_value))
    .slice(0, 12);

  const relevantDietary = matchingFriends.flatMap((friend) =>
    (friend.dietary_restrictions || []).map((d) => ({
      friend_id: friend.id,
      friend_nickname: friend.nickname,
      restriction_label: d.restriction_label,
      restriction_category: d.restriction_category,
    }))
  );

  return NextResponse.json({
    availableInterests,
    availableDietary,
    friends: matchingFriends,
    totalFriends: allFriends.length,
    sharedInterests,
    relevantDislikes,
    relevantDietary,
  });
}
