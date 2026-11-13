import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFriendsWithInterests } from "@/lib/db";
import { buildGroupDietarySnapshot, generateSmartGroupPlans } from "@/lib/plans";

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const rawIds = Array.isArray(body.friendIds) ? body.friendIds : [];
    const friendIds = rawIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n));
    const parsedSize = Number(body.groupSize);
    const groupSize = Number.isFinite(parsedSize)
      ? Math.min(10, Math.max(4, Math.round(parsedSize)))
      : undefined;

    const allFriends = getFriendsWithInterests(user.id);
    const snapshot = buildGroupDietarySnapshot(allFriends, friendIds.length > 0 ? friendIds : undefined);
    const plans = generateSmartGroupPlans(allFriends, friendIds.length > 0 ? friendIds : undefined, {
      groupSize,
    });

    return NextResponse.json({
      snapshot,
      plans,
    });
  } catch (err) {
    console.error("Recommend plans error:", err);
    return NextResponse.json({ error: "ไม่สามารถวิเคราะห์แพลนแนะนำได้" }, { status: 500 });
  }
}
