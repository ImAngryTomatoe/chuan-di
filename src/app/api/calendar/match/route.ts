import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  computeCalendarMatches,
  DATE_FILTER_OPTIONS,
  DateFilterKey,
  enumerateDates,
  getBangkokToday,
  getMonthRange,
  isValidDateStr,
  resolveDateFilterRange,
  resolveTimeFilterWindow,
  sortAndFilterMatchResults,
  TIME_FILTER_PRESETS,
  TimeFilterKey,
} from "@/lib/calendar";
import { getDb } from "@/lib/db";
import {
  getGoogleCalendarPublicStatus,
  refreshStaleSharedFriendsGoogleCalendars,
} from "@/lib/google-calendar";

const VALID_DATE_FILTERS = new Set<DateFilterKey>(DATE_FILTER_OPTIONS.map((o) => o.value));
const VALID_TIME_FILTERS = new Set<TimeFilterKey>(Object.keys(TIME_FILTER_PRESETS) as TimeFilterKey[]);

interface MatchInput {
  friendIds: number[];
  hasExplicitFriendIds: boolean;
  dateFilter: DateFilterKey;
  customStart?: string;
  customEnd?: string;
  timeFilter: TimeFilterKey;
  customStartTime?: string;
  customEndTime?: string;
  includeSelf: boolean;
  gridStartDate?: string;
  gridEndDate?: string;
}

async function runCalendarMatch(userId: number, input: MatchInput) {
  await refreshStaleSharedFriendsGoogleCalendars({
    organizerUserId: userId,
    friendIds: input.friendIds,
  });

  const db = getDb();

  // Build friend catalog with share permission & positive interests strictly for owned friends
  const catalogRows = db
    .prepare(
      `SELECT f.id, f.nickname, f.full_name, f.avatar_color, f.linked_user_id,
              COALESCE(fcp.is_shared, 0) as is_shared
       FROM friends f
       LEFT JOIN friend_calendar_permissions fcp
         ON fcp.friend_id = f.id AND fcp.user_id = f.user_id
       WHERE f.user_id = ?
       ORDER BY is_shared DESC, f.id ASC`
    )
    .all(userId) as Array<{
    id: number;
    nickname: string;
    full_name: string;
    avatar_color: string;
    linked_user_id: number | null;
    is_shared: number;
  }>;

  const sharedLinkedIds = Array.from(
    new Set(
      catalogRows
        .filter((r) => r.is_shared === 1 && r.linked_user_id && r.linked_user_id > 0)
        .map((r) => r.linked_user_id as number)
    )
  );
  const connectedLinkedSet = new Set<number>();
  if (sharedLinkedIds.length > 0) {
    const ph = sharedLinkedIds.map(() => "?").join(",");
    const connRows = db
      .prepare(`SELECT user_id FROM google_calendar_connections WHERE user_id IN (${ph})`)
      .all(...sharedLinkedIds) as Array<{ user_id: number }>;
    for (const r of connRows) connectedLinkedSet.add(r.user_id);
  }

  const interestRows = db
    .prepare(
      `SELECT fi.friend_id, i.normalized_value
       FROM friend_interests fi
       JOIN friends f ON f.id = fi.friend_id
       JOIN interests i ON i.id = fi.interest_id
       JOIN interest_categories ic ON ic.id = i.category_id
       WHERE f.user_id = ?
         AND ic.slug != 'disliked_food'
       ORDER BY i.normalized_value ASC`
    )
    .all(userId) as Array<{ friend_id: number; normalized_value: string }>;

  const tagsByFriend = new Map<number, string[]>();
  const friendsByTag = new Map<string, number[]>();

  for (const r of interestRows) {
    const fTags = tagsByFriend.get(r.friend_id) || [];
    if (!fTags.includes(r.normalized_value)) fTags.push(r.normalized_value);
    tagsByFriend.set(r.friend_id, fTags);

    const gIds = friendsByTag.get(r.normalized_value) || [];
    if (!gIds.includes(r.friend_id)) gIds.push(r.friend_id);
    friendsByTag.set(r.normalized_value, gIds);
  }

  const friendsCatalog = catalogRows.map((f) => {
    const isShared = f.is_shared === 1;
    return {
      id: f.id,
      nickname: f.nickname,
      full_name: f.full_name,
      avatar_color: f.avatar_color,
      is_shared: isShared,
      google_connected: Boolean(isShared && f.linked_user_id && connectedLinkedSet.has(f.linked_user_id)),
      interests: tagsByFriend.get(f.id) || [],
    };
  });

  const interestGroups = Array.from(friendsByTag.entries())
    .map(([tag, friendIds]) => ({ tag, count: friendIds.length, friendIds }))
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "th"))
    .slice(0, 12);

  // If user didn't pass explicit friendIds on initial GET load, preselect up to 4 shared
  // starter friends so full-match green days and partial-match Fridays are immediately visible.
  let selectedFriendIds = input.friendIds;
  if (!input.hasExplicitFriendIds && friendsCatalog.length > 0) {
    const sharedSample = friendsCatalog.filter((f) => f.is_shared).slice(0, 4).map((f) => f.id);
    selectedFriendIds =
      sharedSample.length > 0
        ? sharedSample
        : friendsCatalog.slice(0, 4).map((f) => f.id);
  }

  const range = resolveDateFilterRange({
    dateFilter: input.dateFilter,
    customStart: input.customStart,
    customEnd: input.customEnd,
  });
  const timeWindow = resolveTimeFilterWindow({
    timeFilter: input.timeFilter,
    customStartTime: input.customStartTime,
    customEndTime: input.customEndTime,
  });

  const matchDates = enumerateDates(range.startDate, range.endDate, 95);

  const today = getBangkokToday();
  const [ty, tm] = today.split("-").map(Number);
  const defaultMonthRange = getMonthRange(ty, tm - 1);
  const gStart =
    input.gridStartDate && isValidDateStr(input.gridStartDate)
      ? input.gridStartDate
      : defaultMonthRange.start;
  const gEnd =
    input.gridEndDate && isValidDateStr(input.gridEndDate) && input.gridEndDate >= gStart
      ? input.gridEndDate
      : defaultMonthRange.end;
  const gridDates = enumerateDates(gStart, gEnd, 62);

  // Combine unique dates cleanly so DB queries run once across both match range and visible calendar grid
  const combinedDates = Array.from(new Set([...gridDates, ...matchDates])).sort();

  const evaluated = computeCalendarMatches(db, {
    userId,
    friendIds: selectedFriendIds,
    dates: combinedDates,
    windowStartTime: timeWindow.startTime,
    windowEndTime: timeWindow.endTime,
    includeSelf: input.includeSelf,
  });

  if (evaluated.unauthorizedFriendIds.length > 0) {
    return {
      status: 403 as const,
      payload: {
        error: "ไม่มีสิทธิ์เข้าถึงข้อมูลปฏิทินของเพื่อนที่ระบุ",
        unauthorizedFriendIds: evaluated.unauthorizedFriendIds,
      },
    };
  }

  const byDate = new Map(evaluated.days.map((d) => [d.date, d]));
  const gridDays = gridDates.map((dt) => byDate.get(dt)!).filter(Boolean);
  const rangeDays = matchDates.map((dt) => byDate.get(dt)!).filter(Boolean);
  const matches = sortAndFilterMatchResults({
    days: rangeDays,
    dateFilter: input.dateFilter,
    weekendOnly: range.weekendOnly,
    includeSelf: input.includeSelf,
  });

  const gcalStatus = getGoogleCalendarPublicStatus(userId);

  return {
    status: 200 as const,
    payload: {
      today,
      timezone: "Asia/Bangkok",
      selectedFriendIds,
      dateFilter: input.dateFilter,
      timeFilter: input.timeFilter,
      includeSelf: input.includeSelf,
      range,
      timeWindow,
      friendsCatalog,
      interestGroups,
      gridDays,
      matches,
      googleCalendar: {
        configured: gcalStatus.configured,
        connected: gcalStatus.connected,
        googleEmail: gcalStatus.googleEmail,
        syncStatus: gcalStatus.syncStatus,
        syncError: gcalStatus.syncError,
        lastSyncedAt: gcalStatus.lastSyncedAt,
        selectedCount: gcalStatus.selectedCount,
      },
    },
  };
}

export async function GET(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hasExplicitFriendIds = searchParams.has("friendIds");
  const rawIds = (searchParams.get("friendIds") || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const rawDateFilter = (searchParams.get("dateFilter") || "14d") as DateFilterKey;
  const dateFilter: DateFilterKey = VALID_DATE_FILTERS.has(rawDateFilter) ? rawDateFilter : "14d";

  const rawTimeFilter = (searchParams.get("timeFilter") || "all") as TimeFilterKey;
  const timeFilter: TimeFilterKey = VALID_TIME_FILTERS.has(rawTimeFilter) ? rawTimeFilter : "all";

  const includeSelf = searchParams.get("includeSelf") !== "false";

  const res = await runCalendarMatch(user.id, {
    friendIds: rawIds,
    hasExplicitFriendIds,
    dateFilter,
    customStart: searchParams.get("customStart") || undefined,
    customEnd: searchParams.get("customEnd") || undefined,
    timeFilter,
    customStartTime: searchParams.get("customStartTime") || undefined,
    customEndTime: searchParams.get("customEndTime") || undefined,
    includeSelf,
    gridStartDate: searchParams.get("gridStartDate") || undefined,
    gridEndDate: searchParams.get("gridEndDate") || undefined,
  });

  return NextResponse.json(res.payload, { status: res.status });
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasExplicitFriendIds = Array.isArray(body.friendIds);
  const rawIds = Array.isArray(body.friendIds)
    ? body.friendIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const rawDateFilter = String(body.dateFilter || "14d") as DateFilterKey;
  const dateFilter: DateFilterKey = VALID_DATE_FILTERS.has(rawDateFilter) ? rawDateFilter : "14d";

  const rawTimeFilter = String(body.timeFilter || "all") as TimeFilterKey;
  const timeFilter: TimeFilterKey = VALID_TIME_FILTERS.has(rawTimeFilter) ? rawTimeFilter : "all";

  const includeSelf = body.includeSelf !== false;

  const res = await runCalendarMatch(user.id, {
    friendIds: rawIds,
    hasExplicitFriendIds,
    dateFilter,
    customStart: typeof body.customStart === "string" ? body.customStart : undefined,
    customEnd: typeof body.customEnd === "string" ? body.customEnd : undefined,
    timeFilter,
    customStartTime: typeof body.customStartTime === "string" ? body.customStartTime : undefined,
    customEndTime: typeof body.customEndTime === "string" ? body.customEndTime : undefined,
    includeSelf,
    gridStartDate: typeof body.gridStartDate === "string" ? body.gridStartDate : undefined,
    gridEndDate: typeof body.gridEndDate === "string" ? body.gridEndDate : undefined,
  });

  return NextResponse.json(res.payload, { status: res.status });
}
