import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getFriendsWithInterests } from "@/lib/db";
import { buildFriendRecommendations, detectTagsFromActivityTitle } from "@/lib/activities";
import {
  computeCalendarMatches,
  FriendStatusItem,
  isValidDateStr,
  isValidTimeStr,
} from "@/lib/calendar";

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const category = String(body.category || "อาหารและสังสรรค์").trim();
    const explicitTags = Array.isArray(body.target_interests)
      ? body.target_interests.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [];
    const activityDate = typeof body.activity_date === "string" ? body.activity_date.trim() : "";
    const rawStartTime = typeof body.start_time === "string" ? body.start_time.trim() : "";
    const rawEndTime = typeof body.end_time === "string" ? body.end_time.trim() : "";

    const db = getDb();
    const knownRows = db
      .prepare(
        `SELECT DISTINCT i.normalized_value
         FROM friend_interests fi
         JOIN friends f ON f.id = fi.friend_id
         JOIN interests i ON i.id = fi.interest_id
         JOIN interest_categories ic ON ic.id = i.category_id
         WHERE f.user_id = ? AND ic.slug != 'disliked_food'`
      )
      .all(user.id) as unknown as Array<{ normalized_value: string }>;

    const knownTerms = knownRows.map((r) => r.normalized_value);
    const detectedTags =
      explicitTags.length > 0
        ? explicitTags
        : detectTagsFromActivityTitle(title, knownTerms);

    const friends = getFriendsWithInterests(user.id);
    const ranked = buildFriendRecommendations(friends, detectedTags, category);

    let enriched = ranked;
    if (activityDate && isValidDateStr(activityDate)) {
      const windowStartTime = isValidTimeStr(rawStartTime) ? rawStartTime : "08:00";
      const windowEndTime =
        isValidTimeStr(rawEndTime) && rawEndTime > windowStartTime ? rawEndTime : "22:00";

      const matchRes = computeCalendarMatches(db, {
        userId: user.id,
        friendIds: friends.map((f) => f.id),
        dates: [activityDate],
        windowStartTime,
        windowEndTime,
        includeSelf: true,
      });

      const day = matchRes.days[0];
      const byFriendId = new Map<number, FriendStatusItem>();
      if (day) {
        for (const item of [
          ...day.availableFriends,
          ...day.otherTimeFriends,
          ...day.unavailableFriends,
          ...day.unknownFriends,
        ]) {
          byFriendId.set(item.id, item);
        }
      }

      enriched = ranked.map((rec) => {
        const cal = byFriendId.get(rec.id);
        return {
          ...rec,
          availability_status: cal?.status ?? "unknown",
          availability_slot: cal?.slot ?? null,
          availability_reason: cal?.reason ?? "ยังไม่มีข้อมูลปฏิทิน",
          availability_source: cal?.availability_source ?? "none",
        };
      });
    }

    const matchingCount = enriched.filter((r) => r.matchedLikes.length > 0).length;

    return NextResponse.json({
      detectedTags,
      matchingCount,
      totalFriends: friends.length,
      recommendations: enriched,
    });
  } catch (err) {
    console.error("Recommend friends error:", err);
    return NextResponse.json({ error: "ไม่สามารถแนะนำเพื่อนได้" }, { status: 500 });
  }
}
