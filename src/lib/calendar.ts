import { DatabaseSync } from "node:sqlite";

export const BANGKOK_TZ = "Asia/Bangkok";

export const WEEKDAY_NAMES_TH = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
] as const;

export const WEEKDAY_SHORT_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export type AvailabilityStatus = "available" | "unavailable" | "unknown";

export type DateFilterKey =
  | "7d"
  | "14d"
  | "this_month"
  | "next_month"
  | "custom"
  | "weekend"
  | "all_available"
  | "most_available";

export type TimeFilterKey = "all" | "morning" | "afternoon" | "evening" | "custom";

export const DATE_FILTER_OPTIONS: Array<{ value: DateFilterKey; label: string }> = [
  { value: "7d", label: "7 วันข้างหน้า" },
  { value: "14d", label: "14 วันข้างหน้า" },
  { value: "this_month", label: "เดือนนี้" },
  { value: "next_month", label: "เดือนหน้า" },
  { value: "custom", label: "เลือกช่วงวันที่เอง" },
  { value: "weekend", label: "วันเสาร์–อาทิตย์" },
  { value: "all_available", label: "ว่างครบทุกคน" },
  { value: "most_available", label: "ว่างมากที่สุด" },
];

export const TIME_FILTER_PRESETS: Record<
  TimeFilterKey,
  { label: string; shortLabel: string; start: string; end: string }
> = {
  all: { label: "ทุกช่วงเวลา (08:00–22:00)", shortLabel: "ทุกช่วงเวลา", start: "08:00", end: "22:00" },
  morning: { label: "เช้า (08:00–12:00)", shortLabel: "เช้า", start: "08:00", end: "12:00" },
  afternoon: { label: "บ่าย (12:00–17:00)", shortLabel: "บ่าย", start: "12:00", end: "17:00" },
  evening: { label: "เย็น (17:00–22:00)", shortLabel: "เย็น", start: "17:00", end: "22:00" },
  custom: { label: "กำหนดเวลาเอง", shortLabel: "กำหนดเวลาเอง", start: "10:00", end: "18:00" },
};

const MIN_OVERLAP_MINUTES = 30;

export function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTimeStr(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hh, mm] = value.split(":").map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function getBangkokToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "11";
  const d = parts.find((p) => p.type === "day")?.value ?? "13";
  return `${y}-${m}-${d}`;
}

export function addDaysBangkok(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return dt.toISOString().slice(0, 10);
}

export function getBangkokWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getMonthRange(year: number, monthIndex0: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, monthIndex0, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function formatThaiDateLabel(dateStr: string): string {
  if (!isValidDateStr(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = getBangkokWeekday(dateStr);
  const thaiYear = y + 543;
  return `วัน${WEEKDAY_NAMES_TH[weekday]}ที่ ${d} ${THAI_MONTHS_SHORT[m - 1]} ${thaiYear}`;
}

export function enumerateDates(startDate: string, endDate: string, maxDays = 120): string[] {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate) || startDate > endDate) {
    return [];
  }
  const out: string[] = [];
  let cur = startDate;
  while (cur <= endDate && out.length < maxDays) {
    out.push(cur);
    cur = addDaysBangkok(cur, 1);
  }
  return out;
}

export function resolveDateFilterRange(params: {
  dateFilter: DateFilterKey;
  customStart?: string;
  customEnd?: string;
}): { startDate: string; endDate: string; weekendOnly: boolean } {
  const today = getBangkokToday();
  const [ty, tm] = today.split("-").map(Number);

  switch (params.dateFilter) {
    case "7d":
      return { startDate: today, endDate: addDaysBangkok(today, 6), weekendOnly: false };
    case "14d":
      return { startDate: today, endDate: addDaysBangkok(today, 13), weekendOnly: false };
    case "this_month": {
      const { end } = getMonthRange(ty, tm - 1);
      return { startDate: today, endDate: end < today ? today : end, weekendOnly: false };
    }
    case "next_month": {
      const { start, end } = getMonthRange(ty, tm);
      return { startDate: start, endDate: end, weekendOnly: false };
    }
    case "custom": {
      const start =
        params.customStart && isValidDateStr(params.customStart) ? params.customStart : today;
      const fallbackEnd = addDaysBangkok(start, 13);
      let end = params.customEnd && isValidDateStr(params.customEnd) ? params.customEnd : fallbackEnd;
      if (end < start) end = start;
      const maxEnd = addDaysBangkok(start, 90);
      if (end > maxEnd) end = maxEnd;
      return { startDate: start, endDate: end, weekendOnly: false };
    }
    case "weekend":
      return { startDate: today, endDate: addDaysBangkok(today, 30), weekendOnly: true };
    case "all_available":
    case "most_available":
    default:
      return { startDate: today, endDate: addDaysBangkok(today, 30), weekendOnly: false };
  }
}

export function resolveTimeFilterWindow(params: {
  timeFilter: TimeFilterKey;
  customStartTime?: string;
  customEndTime?: string;
}): { startTime: string; endTime: string; label: string } {
  if (params.timeFilter === "custom") {
    const start =
      params.customStartTime && isValidTimeStr(params.customStartTime)
        ? params.customStartTime
        : "10:00";
    let end =
      params.customEndTime && isValidTimeStr(params.customEndTime)
        ? params.customEndTime
        : "18:00";
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      end = minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(start) + 120));
    }
    return { startTime: start, endTime: end, label: `${start}–${end} น.` };
  }
  const preset = TIME_FILTER_PRESETS[params.timeFilter] || TIME_FILTER_PRESETS.all;
  return { startTime: preset.start, endTime: preset.end, label: preset.label };
}

export interface ScheduleRuleRow {
  weekday: number;
  status: "available" | "unavailable";
  start_time: string;
  end_time: string;
  note: string | null;
}

export interface ScheduleDateRow {
  avail_date: string;
  status: "available" | "unavailable" | "unknown";
  start_time: string;
  end_time: string;
  note: string | null;
}

export interface PersonDayEvaluation {
  status: AvailabilityStatus;
  interval: [number, number] | null;
  intervals: Array<[number, number]>;
  rawSlot: string | null;
  reason: string;
  source: "override" | "weekly" | "google" | "unshared" | "none";
}

function intersectRange(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): [number, number] | null {
  const s = Math.max(aStart, bStart);
  const e = Math.min(aEnd, bEnd);
  return e - s >= MIN_OVERLAP_MINUTES ? [s, e] : null;
}

function formatIntervalsRawSlot(intervals: Array<[number, number]>): string | null {
  if (intervals.length === 0) return null;
  const parts = intervals.slice(0, 3).map(([s, e]) => `${minutesToTime(s)}–${minutesToTime(e)}`);
  if (intervals.length > 3) {
    return `${parts.join(", ")} (+${intervals.length - 3})`;
  }
  return parts.join(", ");
}

export function subtractBusyIntervals(
  baseIntervals: Array<[number, number]>,
  busyIntervals: Array<[number, number]>,
  minDuration = MIN_OVERLAP_MINUTES
): Array<[number, number]> {
  if (baseIntervals.length === 0) return [];
  const validBusy = busyIntervals
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .slice()
    .sort((a, b) => a[0] - b[0]);

  const mergedBusy: Array<[number, number]> = [];
  for (const [bs, be] of validBusy) {
    const prev = mergedBusy[mergedBusy.length - 1];
    if (prev && bs <= prev[1]) {
      prev[1] = Math.max(prev[1], be);
    } else {
      mergedBusy.push([bs, be]);
    }
  }

  let current = baseIntervals.map(([s, e]) => [s, e] as [number, number]);
  for (const [bs, be] of mergedBusy) {
    const next: Array<[number, number]> = [];
    for (const [cs, ce] of current) {
      if (be <= cs || bs >= ce) {
        next.push([cs, ce]);
      } else {
        if (bs > cs) next.push([cs, bs]);
        if (ce > be) next.push([be, ce]);
      }
    }
    current = next;
  }

  return current.filter(([s, e]) => e - s >= minDuration);
}

function pickLongestInterval(intervals: Array<[number, number]>): [number, number] | null {
  if (intervals.length === 0) return null;
  return intervals.reduce((best, cur) => (cur[1] - cur[0] > best[1] - best[0] ? cur : best));
}

export interface GoogleDayInput {
  connected: boolean;
  hasSelectedCalendars: boolean;
  inSyncWindow: boolean;
  busyIntervals: Array<[number, number]>;
}

export function evaluatePersonDay(params: {
  dateStr: string;
  isShared: boolean;
  override?: ScheduleDateRow;
  weekly?: ScheduleRuleRow;
  google?: GoogleDayInput;
  windowStartMin: number;
  windowEndMin: number;
}): PersonDayEvaluation {
  const { dateStr, isShared, override, weekly, google, windowStartMin, windowEndMin } = params;
  const weekday = getBangkokWeekday(dateStr);

  if (!isShared) {
    return {
      status: "unknown",
      interval: null,
      intervals: [],
      rawSlot: null,
      reason: "เพื่อนยังไม่แชร์ข้อมูลปฏิทิน",
      source: "unshared",
    };
  }

  if (google && google.connected) {
    if (!google.hasSelectedCalendars) {
      return {
        status: "unknown",
        interval: null,
        intervals: [],
        rawSlot: null,
        reason: "ยังไม่เลือกปฏิทิน Google ที่จะแชร์",
        source: "google",
      };
    }

    if (google.inSyncWindow) {
      const mergedBusy = [...google.busyIntervals];
      if (override && override.status === "unavailable") {
        mergedBusy.push([timeToMinutes(override.start_time), timeToMinutes(override.end_time)]);
      }

      const freeIntervals = subtractBusyIntervals([[windowStartMin, windowEndMin]], mergedBusy);
      if (freeIntervals.length === 0) {
        const clippedBusy = google.busyIntervals
          .map(([s, e]) => [Math.max(s, windowStartMin), Math.min(e, windowEndMin)] as [number, number])
          .filter(([s, e]) => e > s);
        return {
          status: "unavailable",
          interval: null,
          intervals: [],
          rawSlot: formatIntervalsRawSlot(clippedBusy),
          reason: "ไม่ว่างตาม Google Calendar",
          source: "google",
        };
      }

      const longest = pickLongestInterval(freeIntervals);
      return {
        status: "available",
        interval: longest,
        intervals: freeIntervals,
        rawSlot: formatIntervalsRawSlot(freeIntervals),
        reason:
          mergedBusy.length > 0
            ? "ว่างจาก Google Calendar นอกช่วงที่ไม่ว่าง"
            : "ว่างตาม Google Calendar",
        source: "google",
      };
    }
  }

  if (override) {
    if (override.status === "unknown") {
      return {
        status: "unknown",
        interval: null,
        intervals: [],
        rawSlot: null,
        reason: override.note || "ยังไม่ระบุเวลาว่างวันนี้",
        source: "override",
      };
    }

    if (override.status === "available") {
      const oStart = timeToMinutes(override.start_time);
      const oEnd = timeToMinutes(override.end_time);
      const rawSlot = `${override.start_time}–${override.end_time}`;
      const hit = intersectRange(oStart, oEnd, windowStartMin, windowEndMin);
      if (hit) {
        return {
          status: "available",
          interval: hit,
          intervals: [hit],
          rawSlot,
          reason: override.note || `ว่าง ${rawSlot}`,
          source: "override",
        };
      }
      return {
        status: "unknown",
        interval: null,
        intervals: [],
        rawSlot,
        reason: `ว่างเฉพาะ ${rawSlot}`,
        source: "override",
      };
    }

    // override.status === "unavailable"
    const uStart = timeToMinutes(override.start_time);
    const uEnd = timeToMinutes(override.end_time);
    const rawSlot = `${override.start_time}–${override.end_time}`;
    if (weekly && weekly.status === "available") {
      const wStart = timeToMinutes(weekly.start_time);
      const wEnd = timeToMinutes(weekly.end_time);
      const inWindow = intersectRange(wStart, wEnd, windowStartMin, windowEndMin);
      if (inWindow) {
        const remainingList = subtractBusyIntervals([inWindow], [[uStart, uEnd]]);
        const remaining = pickLongestInterval(remainingList);
        if (remaining) {
          return {
            status: "available",
            interval: remaining,
            intervals: remainingList,
            rawSlot: formatIntervalsRawSlot(remainingList),
            reason: `ว่างนอกเวลาที่ติดธุระ (${rawSlot})`,
            source: "override",
          };
        }
      }
    }
    return {
      status: "unavailable",
      interval: null,
      intervals: [],
      rawSlot,
      reason: override.note || `ไม่ว่าง ${rawSlot}`,
      source: "override",
    };
  }

  if (!weekly) {
    return {
      status: "unknown",
      interval: null,
      intervals: [],
      rawSlot: null,
      reason:
        google && google.connected
          ? "ยังไม่มีข้อมูล Google Calendar สำหรับวันนี้"
          : `ไม่มีข้อมูลวัน${WEEKDAY_NAMES_TH[weekday]}`,
      source: "none",
    };
  }

  const wStart = timeToMinutes(weekly.start_time);
  const wEnd = timeToMinutes(weekly.end_time);
  const rawSlot = `${weekly.start_time}–${weekly.end_time}`;

  if (weekly.status === "unavailable") {
    const overlapUnavailable = intersectRange(wStart, wEnd, windowStartMin, windowEndMin);
    if (overlapUnavailable) {
      return {
        status: "unavailable",
        interval: null,
        intervals: [],
        rawSlot,
        reason: weekly.note || `ไม่ว่างทุกวัน${WEEKDAY_NAMES_TH[weekday]}`,
        source: "weekly",
      };
    }
    return {
      status: "unknown",
      interval: null,
      intervals: [],
      rawSlot,
      reason: `ไม่ว่างช่วง ${rawSlot} (ยังไม่ระบุช่วงเวลานี้)`,
      source: "weekly",
    };
  }

  const hit = intersectRange(wStart, wEnd, windowStartMin, windowEndMin);
  if (hit) {
    return {
      status: "available",
      interval: hit,
      intervals: [hit],
      rawSlot,
      reason: weekly.note || `ว่างประจำวัน${WEEKDAY_NAMES_TH[weekday]}`,
      source: "weekly",
    };
  }

  return {
    status: "unknown",
    interval: null,
    intervals: [],
    rawSlot,
    reason: `ว่างเฉพาะ ${rawSlot}`,
    source: "weekly",
  };
}

export interface FriendCalendarSummary {
  id: number;
  nickname: string;
  full_name: string;
  avatar_color: string;
  linked_user_id: number | null;
  is_shared: boolean;
  share_source: string;
  google_connected?: boolean;
  interests: string[];
}

export interface FriendStatusItem {
  id: number;
  nickname: string;
  full_name: string;
  avatar_color: string;
  is_shared: boolean;
  status: AvailabilityStatus;
  slot: string | null;
  reason: string;
  availability_source?: "google" | "manual" | "none";
}

export interface DayMatchResult {
  date: string;
  thaiDate: string;
  weekday: number;
  weekdayShort: string;
  totalSelected: number;
  availableCount: number;
  dailyAvailableCount: number;
  unavailableCount: number;
  unknownCount: number;
  allSelectedAvailable: boolean;
  overlapStartTime: string | null;
  overlapEndTime: string | null;
  overlapDurationMin: number;
  selfStatus: AvailabilityStatus;
  selfSlot: string | null;
  selfReason: string;
  availableFriends: FriendStatusItem[];
  otherTimeFriends: FriendStatusItem[];
  unavailableFriends: FriendStatusItem[];
  unknownFriends: FriendStatusItem[];
}

interface OverlapSegment {
  start: number;
  end: number;
  friendIds: number[];
  selfCovers: boolean;
}

function findBestOverlapSegment(params: {
  entries: Array<{ friendId: number; intervals: Array<[number, number]> }>;
  selfIntervals: Array<[number, number]>;
  includeSelf: boolean;
}): OverlapSegment | null {
  const { entries, selfIntervals, includeSelf } = params;
  if (entries.length === 0) return null;

  const pointSet = new Set<number>();
  for (const e of entries) {
    for (const [s, end] of e.intervals) {
      pointSet.add(s);
      pointSet.add(end);
    }
  }
  for (const [s, end] of selfIntervals) {
    pointSet.add(s);
    pointSet.add(end);
  }
  const points = Array.from(pointSet).sort((a, b) => a - b);
  if (points.length < 2) return null;

  const elementary: OverlapSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segEnd <= segStart) continue;
    const friendIds = entries
      .filter((e) => e.intervals.some(([s, end]) => s <= segStart && end >= segEnd))
      .map((e) => e.friendId);
    if (friendIds.length === 0) continue;
    const selfCovers = selfIntervals.some(([s, end]) => s <= segStart && end >= segEnd);
    elementary.push({ start: segStart, end: segEnd, friendIds, selfCovers });
  }

  if (elementary.length === 0) return null;

  // Merge adjacent segments with identical participant sets
  const merged: OverlapSegment[] = [];
  for (const seg of elementary) {
    const prev = merged[merged.length - 1];
    const key = seg.friendIds.join(",");
    const prevKey = prev ? prev.friendIds.join(",") : "";
    if (
      prev &&
      prev.end === seg.start &&
      prevKey === key &&
      prev.selfCovers === seg.selfCovers
    ) {
      prev.end = seg.end;
    } else {
      merged.push({ ...seg, friendIds: [...seg.friendIds] });
    }
  }

  const viable = merged.filter((m) => m.end - m.start >= MIN_OVERLAP_MINUTES);
  const candidates = viable.length > 0 ? viable : merged;

  candidates.sort((a, b) => {
    const aCount = a.friendIds.length;
    const bCount = b.friendIds.length;
    if (bCount !== aCount) return bCount - aCount;
    if (includeSelf && b.selfCovers !== a.selfCovers) return b.selfCovers ? 1 : -1;
    const durDiff = b.end - b.start - (a.end - a.start);
    if (durDiff !== 0) return durDiff;
    return a.start - b.start;
  });

  return candidates[0];
}

export function computeCalendarMatches(
  db: DatabaseSync,
  params: {
    userId: number;
    friendIds: number[];
    dates: string[];
    windowStartTime: string;
    windowEndTime: string;
    includeSelf?: boolean;
  }
): {
  friends: FriendCalendarSummary[];
  days: DayMatchResult[];
  unauthorizedFriendIds: number[];
} {
  const uniqueIds = Array.from(new Set(params.friendIds)).filter((n) => Number.isFinite(n) && n > 0);
  const includeSelf = params.includeSelf !== false;
  const windowStartMin = timeToMinutes(params.windowStartTime);
  const windowEndMin = timeToMinutes(params.windowEndTime);

  // Access control check: verify every requested friend belongs to params.userId
  let ownedFriendsRows: Array<{
    id: number;
    nickname: string;
    full_name: string;
    avatar_color: string;
    linked_user_id: number | null;
    is_shared: number | null;
    share_source: string | null;
  }> = [];

  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => "?").join(",");
    const allMatchingRows = db
      .prepare(`SELECT id, user_id FROM friends WHERE id IN (${placeholders})`)
      .all(...uniqueIds) as Array<{ id: number; user_id: number }>;

    const foundSet = new Set(allMatchingRows.map((r) => r.id));
    const unauthorizedFriendIds = allMatchingRows
      .filter((r) => r.user_id !== params.userId)
      .map((r) => r.id);
    const missingIds = uniqueIds.filter((id) => !foundSet.has(id));

    if (unauthorizedFriendIds.length > 0 || missingIds.length > 0) {
      return {
        friends: [],
        days: [],
        unauthorizedFriendIds: [...unauthorizedFriendIds, ...missingIds],
      };
    }

    ownedFriendsRows = db
      .prepare(
        `SELECT f.id, f.nickname, f.full_name, f.avatar_color, f.linked_user_id,
                fcp.is_shared, fcp.share_source
         FROM friends f
         LEFT JOIN friend_calendar_permissions fcp
           ON fcp.friend_id = f.id AND fcp.user_id = f.user_id
         WHERE f.user_id = ? AND f.id IN (${placeholders})
         ORDER BY f.id ASC`
      )
      .all(params.userId, ...uniqueIds) as typeof ownedFriendsRows;
  }

  // Interests for quick summary badges
  const interestsByFriend = new Map<number, string[]>();
  if (ownedFriendsRows.length > 0) {
    const placeholders = ownedFriendsRows.map(() => "?").join(",");
    const intRows = db
      .prepare(
        `SELECT fi.friend_id, i.normalized_value
         FROM friend_interests fi
         JOIN interests i ON i.id = fi.interest_id
         JOIN interest_categories ic ON ic.id = i.category_id
         WHERE fi.friend_id IN (${placeholders})
           AND ic.slug != 'disliked_food'
         ORDER BY i.normalized_value ASC`
      )
      .all(...ownedFriendsRows.map((f) => f.id)) as Array<{
      friend_id: number;
      normalized_value: string;
    }>;
    for (const r of intRows) {
      const arr = interestsByFriend.get(r.friend_id) || [];
      arr.push(r.normalized_value);
      interestsByFriend.set(r.friend_id, arr);
    }
  }

  const friends: FriendCalendarSummary[] = ownedFriendsRows.map((f) => ({
    id: f.id,
    nickname: f.nickname,
    full_name: f.full_name,
    avatar_color: f.avatar_color,
    linked_user_id: f.linked_user_id,
    is_shared: f.is_shared === 1,
    share_source: f.share_source || "none",
    interests: interestsByFriend.get(f.id) || [],
  }));

  // Load organizer availability
  const selfWeeklyMap = new Map<number, ScheduleRuleRow>();
  const selfWeeklyRows = db
    .prepare(
      "SELECT weekday, status, start_time, end_time, note FROM user_weekly_availability WHERE user_id = ?"
    )
    .all(params.userId) as unknown as ScheduleRuleRow[];
  for (const r of selfWeeklyRows) selfWeeklyMap.set(r.weekday, r);

  const selfDateMap = new Map<string, ScheduleDateRow>();
  const minDate = params.dates[0];
  const maxDate = params.dates[params.dates.length - 1];
  if (minDate && maxDate) {
    const selfDateRows = db
      .prepare(
        "SELECT avail_date, status, start_time, end_time, note FROM user_date_availability WHERE user_id = ? AND avail_date BETWEEN ? AND ?"
      )
      .all(params.userId, minDate, maxDate) as unknown as ScheduleDateRow[];
    for (const r of selfDateRows) selfDateMap.set(r.avail_date, r);
  }

  // Load friend availability ONLY for friends with is_shared === true
  const sharedIds = friends.filter((f) => f.is_shared).map((f) => f.id);
  const friendWeeklyByFriend = new Map<number, Map<number, ScheduleRuleRow>>();
  const friendDateByFriend = new Map<number, Map<string, ScheduleDateRow>>();

  if (sharedIds.length > 0) {
    const ph = sharedIds.map(() => "?").join(",");
    const fwRows = db
      .prepare(
        `SELECT friend_id, weekday, status, start_time, end_time, note
         FROM friend_weekly_availability WHERE friend_id IN (${ph})`
      )
      .all(...sharedIds) as unknown as Array<ScheduleRuleRow & { friend_id: number }>;
    for (const r of fwRows) {
      const m = friendWeeklyByFriend.get(r.friend_id) || new Map<number, ScheduleRuleRow>();
      m.set(r.weekday, r);
      friendWeeklyByFriend.set(r.friend_id, m);
    }

    if (minDate && maxDate) {
      const fdRows = db
        .prepare(
          `SELECT friend_id, avail_date, status, start_time, end_time, note
           FROM friend_date_availability
           WHERE friend_id IN (${ph}) AND avail_date BETWEEN ? AND ?`
        )
        .all(...sharedIds, minDate, maxDate) as unknown as Array<ScheduleDateRow & { friend_id: number }>;
      for (const r of fdRows) {
        const m = friendDateByFriend.get(r.friend_id) || new Map<string, ScheduleDateRow>();
        m.set(r.avail_date, r);
        friendDateByFriend.set(r.friend_id, m);
      }
    }
  }

  // Also load linked user schedules strictly for shared friends with linked_user_id
  const linkedUserIds = Array.from(
    new Set(
      friends
        .filter((f) => f.is_shared && f.linked_user_id && f.linked_user_id > 0)
        .map((f) => f.linked_user_id as number)
    )
  );
  const linkedWeeklyByUser = new Map<number, Map<number, ScheduleRuleRow>>();
  const linkedDateByUser = new Map<number, Map<string, ScheduleDateRow>>();
  if (linkedUserIds.length > 0) {
    const ph = linkedUserIds.map(() => "?").join(",");
    const lwRows = db
      .prepare(
        `SELECT user_id, weekday, status, start_time, end_time, note
         FROM user_weekly_availability WHERE user_id IN (${ph})`
      )
      .all(...linkedUserIds) as unknown as Array<ScheduleRuleRow & { user_id: number }>;
    for (const r of lwRows) {
      const m = linkedWeeklyByUser.get(r.user_id) || new Map<number, ScheduleRuleRow>();
      m.set(r.weekday, r);
      linkedWeeklyByUser.set(r.user_id, m);
    }

    if (minDate && maxDate) {
      const ldRows = db
        .prepare(
          `SELECT user_id, avail_date, status, start_time, end_time, note
           FROM user_date_availability
           WHERE user_id IN (${ph}) AND avail_date BETWEEN ? AND ?`
        )
        .all(...linkedUserIds, minDate, maxDate) as unknown as Array<ScheduleDateRow & { user_id: number }>;
      for (const r of ldRows) {
        const m = linkedDateByUser.get(r.user_id) || new Map<string, ScheduleDateRow>();
        m.set(r.avail_date, r);
        linkedDateByUser.set(r.user_id, m);
      }
    }
  }

  // Load Google Calendar Free/Busy data strictly for organizer (self) + shared linked users
  const gcalUserIds = Array.from(new Set([params.userId, ...linkedUserIds]));
  const gcalConnByUser = new Map<
    number,
    {
      sync_status: string;
      sync_window_start: string | null;
      sync_window_end: string | null;
      selectedCount: number;
    }
  >();
  const gcalBusyByUser = new Map<number, Map<string, Array<[number, number]>>>();

  if (gcalUserIds.length > 0) {
    const ph = gcalUserIds.map(() => "?").join(",");
    const connRows = db
      .prepare(
        `SELECT c.user_id, c.sync_status, c.sync_window_start, c.sync_window_end,
                COUNT(s.id) AS selected_count
         FROM google_calendar_connections c
         LEFT JOIN google_calendar_sources s
           ON s.user_id = c.user_id AND s.is_selected = 1
         WHERE c.user_id IN (${ph})
         GROUP BY c.user_id`
      )
      .all(...gcalUserIds) as Array<{
      user_id: number;
      sync_status: string;
      sync_window_start: string | null;
      sync_window_end: string | null;
      selected_count: number;
    }>;

    for (const c of connRows) {
      gcalConnByUser.set(c.user_id, {
        sync_status: c.sync_status,
        sync_window_start: c.sync_window_start,
        sync_window_end: c.sync_window_end,
        selectedCount: Number(c.selected_count || 0),
      });
    }

    if (connRows.length > 0 && minDate && maxDate) {
      const busyRows = db
        .prepare(
          `SELECT b.user_id, b.bangkok_date, b.start_time, b.end_time
           FROM google_freebusy_blocks b
           JOIN google_calendar_sources s
             ON s.user_id = b.user_id AND s.calendar_id = b.calendar_id AND s.is_selected = 1
           WHERE b.user_id IN (${ph}) AND b.bangkok_date BETWEEN ? AND ?`
        )
        .all(...gcalUserIds, minDate, maxDate) as Array<{
        user_id: number;
        bangkok_date: string;
        start_time: string;
        end_time: string;
      }>;

      for (const b of busyRows) {
        const sMin = timeToMinutes(b.start_time);
        const eMin = timeToMinutes(b.end_time);
        if (eMin <= sMin) continue;
        const byDate = gcalBusyByUser.get(b.user_id) || new Map<string, Array<[number, number]>>();
        const arr = byDate.get(b.bangkok_date) || [];
        arr.push([sMin, eMin]);
        byDate.set(b.bangkok_date, arr);
        gcalBusyByUser.set(b.user_id, byDate);
      }
    }
  }

  for (const f of friends) {
    if (f.is_shared && f.linked_user_id && gcalConnByUser.has(f.linked_user_id)) {
      f.google_connected = true;
    } else {
      f.google_connected = false;
    }
  }

  const buildGoogleInputForUser = (uid: number | null | undefined, dateStr: string): GoogleDayInput | undefined => {
    if (!uid) return undefined;
    const conn = gcalConnByUser.get(uid);
    if (!conn) return undefined;
    const inWindow = Boolean(
      conn.sync_window_start &&
        conn.sync_window_end &&
        dateStr >= conn.sync_window_start &&
        dateStr <= conn.sync_window_end
    );
    return {
      connected: true,
      hasSelectedCalendars: conn.selectedCount > 0,
      inSyncWindow: inWindow,
      busyIntervals: gcalBusyByUser.get(uid)?.get(dateStr) || [],
    };
  };

  const toAvailabilitySource = (
    src: PersonDayEvaluation["source"]
  ): "google" | "manual" | "none" => {
    if (src === "google") return "google";
    if (src === "override" || src === "weekly") return "manual";
    return "none";
  };

  const days: DayMatchResult[] = params.dates.map((dateStr) => {
    const weekday = getBangkokWeekday(dateStr);
    const selfEval = evaluatePersonDay({
      dateStr,
      isShared: true,
      override: selfDateMap.get(dateStr),
      weekly: selfWeeklyMap.get(weekday),
      google: buildGoogleInputForUser(params.userId, dateStr),
      windowStartMin,
      windowEndMin,
    });

    const evals: Array<{ friend: FriendCalendarSummary; ev: PersonDayEvaluation }> = friends.map(
      (f) => {
        if (!f.is_shared) {
          return {
            friend: f,
            ev: evaluatePersonDay({
              dateStr,
              isShared: false,
              windowStartMin,
              windowEndMin,
            }),
          };
        }

        const override =
          friendDateByFriend.get(f.id)?.get(dateStr) ||
          (f.linked_user_id ? linkedDateByUser.get(f.linked_user_id)?.get(dateStr) : undefined);
        const weekly =
          friendWeeklyByFriend.get(f.id)?.get(weekday) ||
          (f.linked_user_id ? linkedWeeklyByUser.get(f.linked_user_id)?.get(weekday) : undefined);
        const google = buildGoogleInputForUser(f.linked_user_id, dateStr);

        return {
          friend: f,
          ev: evaluatePersonDay({
            dateStr,
            isShared: true,
            override,
            weekly,
            google,
            windowStartMin,
            windowEndMin,
          }),
        };
      }
    );

    const dayAvailable = evals.filter(
      (e) => e.ev.status === "available" && e.ev.intervals.length > 0
    );
    const unavailableFriends: FriendStatusItem[] = evals
      .filter((e) => e.ev.status === "unavailable")
      .map((e) => ({
        id: e.friend.id,
        nickname: e.friend.nickname,
        full_name: e.friend.full_name,
        avatar_color: e.friend.avatar_color,
        is_shared: e.friend.is_shared,
        status: "unavailable",
        slot: e.ev.rawSlot,
        reason: e.ev.reason,
        availability_source: toAvailabilitySource(e.ev.source),
      }));
    const unknownFriends: FriendStatusItem[] = evals
      .filter((e) => e.ev.status === "unknown")
      .map((e) => ({
        id: e.friend.id,
        nickname: e.friend.nickname,
        full_name: e.friend.full_name,
        avatar_color: e.friend.avatar_color,
        is_shared: e.friend.is_shared,
        status: "unknown",
        slot: e.ev.rawSlot,
        reason: e.ev.reason,
        availability_source: toAvailabilitySource(e.ev.source),
      }));

    const bestSeg = findBestOverlapSegment({
      entries: dayAvailable.map((d) => ({
        friendId: d.friend.id,
        intervals: d.ev.intervals,
      })),
      selfIntervals: selfEval.status === "available" ? selfEval.intervals : [],
      includeSelf,
    });

    const inBestSet = new Set(bestSeg ? bestSeg.friendIds : []);
    const availableFriends: FriendStatusItem[] = [];
    const otherTimeFriends: FriendStatusItem[] = [];

    for (const d of dayAvailable) {
      const item: FriendStatusItem = {
        id: d.friend.id,
        nickname: d.friend.nickname,
        full_name: d.friend.full_name,
        avatar_color: d.friend.avatar_color,
        is_shared: d.friend.is_shared,
        status: "available",
        slot: d.ev.rawSlot,
        reason: d.ev.reason,
        availability_source: toAvailabilitySource(d.ev.source),
      };
      if (!bestSeg || inBestSet.has(d.friend.id)) {
        availableFriends.push(item);
      } else {
        otherTimeFriends.push(item);
      }
    }

    const overlapStartTime = bestSeg ? minutesToTime(bestSeg.start) : null;
    const overlapEndTime = bestSeg ? minutesToTime(bestSeg.end) : null;
    const overlapDurationMin = bestSeg ? Math.max(0, bestSeg.end - bestSeg.start) : 0;

    // Fallback: if organizer has no selected friends yet, still report organizer slot cleanly
    const finalStart =
      overlapStartTime ?? (selfEval.interval ? minutesToTime(selfEval.interval[0]) : null);
    const finalEnd =
      overlapEndTime ?? (selfEval.interval ? minutesToTime(selfEval.interval[1]) : null);

    const selfBlocked = includeSelf && selfEval.status === "unavailable";
    const allSelectedAvailable =
      friends.length > 0 &&
      availableFriends.length === friends.length &&
      unavailableFriends.length === 0 &&
      unknownFriends.length === 0 &&
      !selfBlocked;

    return {
      date: dateStr,
      thaiDate: formatThaiDateLabel(dateStr),
      weekday,
      weekdayShort: WEEKDAY_SHORT_TH[weekday],
      totalSelected: friends.length,
      availableCount: availableFriends.length,
      dailyAvailableCount: dayAvailable.length,
      unavailableCount: unavailableFriends.length,
      unknownCount: unknownFriends.length,
      allSelectedAvailable,
      overlapStartTime: finalStart,
      overlapEndTime: finalEnd,
      overlapDurationMin,
      selfStatus: selfEval.status,
      selfSlot: selfEval.rawSlot,
      selfReason: selfEval.reason,
      availableFriends,
      otherTimeFriends,
      unavailableFriends,
      unknownFriends,
    };
  });

  return { friends, days, unauthorizedFriendIds: [] };
}

export function sortAndFilterMatchResults(params: {
  days: DayMatchResult[];
  dateFilter: DateFilterKey;
  weekendOnly: boolean;
  includeSelf: boolean;
}): DayMatchResult[] {
  const { days, dateFilter, weekendOnly, includeSelf } = params;
  const filtered = days.filter((d) => {
    if (weekendOnly && d.weekday !== 0 && d.weekday !== 6) return false;
    if (d.totalSelected === 0) return d.selfStatus === "available";
    if (dateFilter === "all_available") {
      return d.allSelectedAvailable;
    }
    return d.availableCount > 0;
  });

  return filtered.slice().sort((a, b) => {
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }
    if (includeSelf) {
      const aSelfRank = a.selfStatus === "available" ? 2 : a.selfStatus === "unknown" ? 1 : 0;
      const bSelfRank = b.selfStatus === "available" ? 2 : b.selfStatus === "unknown" ? 1 : 0;
      if (bSelfRank !== aSelfRank) return bSelfRank - aSelfRank;
    }
    if (b.dailyAvailableCount !== a.dailyAvailableCount) {
      return b.dailyAvailableCount - a.dailyAvailableCount;
    }
    if (b.overlapDurationMin !== a.overlapDurationMin) {
      return b.overlapDurationMin - a.overlapDurationMin;
    }
    return a.date.localeCompare(b.date);
  });
}
