import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getFriendsWithInterests } from "@/lib/db";

interface TermInsightRow {
  normalized_value: string;
  category_slug: string;
  category_name_th: string;
  friend_count: number;
  allergy_count: number;
  dislike_count: number;
  friend_nicknames: string;
}

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "").trim();
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const db = getDb();
  const totalFriendsRow = db
    .prepare("SELECT COUNT(*) as total FROM friends WHERE user_id = ?")
    .get(user.id) as { total: number };
  const totalFriends = Number(totalFriendsRow?.total || 0);

  const rawTermRows = db
    .prepare(
      `SELECT
         i.normalized_value,
         ic.slug as category_slug,
         ic.name_th as category_name_th,
         COUNT(DISTINCT fi.friend_id) as friend_count,
         SUM(CASE WHEN fi.restriction_type = 'allergy' THEN 1 ELSE 0 END) as allergy_count,
         SUM(CASE WHEN ic.slug = 'disliked_food' AND (fi.restriction_type IS NULL OR fi.restriction_type = 'dislike') THEN 1 ELSE 0 END) as dislike_count,
         GROUP_CONCAT(DISTINCT f.nickname) as friend_nicknames
       FROM friend_interests fi
       JOIN friends f ON f.id = fi.friend_id
       JOIN interests i ON i.id = fi.interest_id
       JOIN interest_categories ic ON ic.id = i.category_id
       WHERE f.user_id = ?
       GROUP BY i.id
       ORDER BY friend_count DESC, i.normalized_value ASC`
    )
    .all(user.id) as unknown as TermInsightRow[];

  const filteredRows = rawTermRows.filter((row) => {
    if (category && row.category_slug !== category) return false;
    if (
      q &&
      !row.normalized_value.toLowerCase().includes(q) &&
      !row.category_name_th.toLowerCase().includes(q) &&
      !(row.friend_nicknames || "").toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const formatRows = (rows: TermInsightRow[]) =>
    rows.map((r) => ({
      normalized_value: r.normalized_value,
      category_slug: r.category_slug,
      category_name_th: r.category_name_th,
      friend_count: Number(r.friend_count),
      allergy_count: Number(r.allergy_count || 0),
      dislike_count: Number(r.dislike_count || 0),
      friends: r.friend_nicknames ? r.friend_nicknames.split(",").filter(Boolean) : [],
    }));

  const categoryDistribution = db
    .prepare(
      `SELECT ic.slug, ic.name_th,
              COUNT(fi.id) as link_count,
              COUNT(DISTINCT i.id) as unique_terms,
              COUNT(DISTINCT fi.friend_id) as friend_count
       FROM interest_categories ic
       LEFT JOIN interests i ON i.category_id = ic.id
       LEFT JOIN friend_interests fi ON fi.interest_id = i.id
         AND fi.friend_id IN (SELECT id FROM friends WHERE user_id = ?)
       GROUP BY ic.id
       ORDER BY ic.id ASC`
    )
    .all(user.id);

  // Similar friend pairs based on positive interests
  const friends = getFriendsWithInterests(user.id);
  const positiveSets = friends.map((f) => ({
    id: f.id,
    nickname: f.nickname,
    full_name: f.full_name,
    tags: new Map(
      f.interests
        .filter((i) => i.category_slug !== "disliked_food")
        .map((i) => [i.normalized_value.toLowerCase(), i.normalized_value])
    ),
  }));

  const similarFriendPairs: Array<{
    friendA: { id: number; nickname: string };
    friendB: { id: number; nickname: string };
    sharedCount: number;
    sharedTags: string[];
  }> = [];

  for (let i = 0; i < positiveSets.length; i++) {
    for (let j = i + 1; j < positiveSets.length; j++) {
      const a = positiveSets[i];
      const b = positiveSets[j];
      const shared: string[] = [];
      for (const [lower, label] of Array.from(a.tags.entries())) {
        if (b.tags.has(lower)) {
          shared.push(label);
        }
      }
      if (shared.length >= 2) {
        similarFriendPairs.push({
          friendA: { id: a.id, nickname: a.nickname },
          friendB: { id: b.id, nickname: b.nickname },
          sharedCount: shared.length,
          sharedTags: shared,
        });
      }
    }
  }
  similarFriendPairs.sort((x, y) => y.sharedCount - x.sharedCount);

  return NextResponse.json({
    totalFriends,
    totalTagLinks: rawTermRows.reduce((acc, r) => acc + Number(r.friend_count), 0),
    filteredTerms: formatRows(filteredRows),
    mostPopularInterests: formatRows(
      rawTermRows.filter((r) => r.category_slug !== "disliked_food").slice(0, 12)
    ),
    mostPopularFoods: formatRows(
      rawTermRows.filter((r) => r.category_slug === "food_preferences").slice(0, 10)
    ),
    dislikesAndAllergies: formatRows(
      rawTermRows.filter((r) => r.category_slug === "disliked_food")
    ),
    hobbyDistribution: formatRows(rawTermRows.filter((r) => r.category_slug === "hobbies")),
    travelDistribution: formatRows(rawTermRows.filter((r) => r.category_slug === "travel_interests")),
    lifestyleDistribution: formatRows(rawTermRows.filter((r) => r.category_slug === "lifestyle")),
    categoryDistribution,
    similarFriendPairs: similarFriendPairs.slice(0, 10),
  });
}
