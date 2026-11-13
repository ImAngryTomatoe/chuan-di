"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Heart,
  HelpCircle,
  Info,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  FriendCalendarSelector,
  FriendCatalogItem,
  InterestGroupItem,
} from "@/components/calendar/FriendCalendarSelector";
import {
  DateOverrideItem,
  MyAvailabilityCard,
  WeeklyRuleItem,
} from "@/components/calendar/MyAvailabilityCard";
import {
  addDaysBangkok,
  DATE_FILTER_OPTIONS,
  DateFilterKey,
  DayMatchResult,
  formatThaiDateLabel,
  getBangkokWeekday,
  THAI_MONTHS_FULL,
  TIME_FILTER_PRESETS,
  TimeFilterKey,
  WEEKDAY_SHORT_TH,
} from "@/lib/calendar";

interface MatchApiResponse {
  today: string;
  timezone: string;
  selectedFriendIds: number[];
  dateFilter: DateFilterKey;
  timeFilter: TimeFilterKey;
  includeSelf: boolean;
  range: { startDate: string; endDate: string; weekendOnly: boolean };
  timeWindow: { startTime: string; endTime: string; label: string };
  friendsCatalog: FriendCatalogItem[];
  interestGroups: InterestGroupItem[];
  gridDays: DayMatchResult[];
  matches: DayMatchResult[];
  googleCalendar?: {
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
    syncStatus: "disconnected" | "connected" | "error";
    syncError: string | null;
    lastSyncedAt: string | null;
    selectedCount: number;
  };
}

function getCalendarMonthGridBounds(year: number, monthIndex0: number): {
  startDate: string;
  endDate: string;
} {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1)).toISOString().slice(0, 10);
  const lastOfMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).toISOString().slice(0, 10);
  const firstDow = getBangkokWeekday(firstOfMonth); // 0=Sun..6=Sat
  const lastDow = getBangkokWeekday(lastOfMonth);
  const startDate = addDaysBangkok(firstOfMonth, -firstDow);
  const endDate = addDaysBangkok(lastOfMonth, 6 - lastDow);
  return { startDate, endDate };
}

function getWeekBoundsSunday(anchorDateStr: string): { startDate: string; endDate: string } {
  const dow = getBangkokWeekday(anchorDateStr);
  const startDate = addDaysBangkok(anchorDateStr, -dow);
  const endDate = addDaysBangkok(startDate, 6);
  return { startDate, endDate };
}

export default function SmartCalendarPage() {
  return (
    <AppShell>
      <SmartCalendarContent />
    </AppShell>
  );
}

function SmartCalendarContent() {
  const { notify } = useApp();

  const [bootstrapped, setBootstrapped] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);

  const [today, setToday] = useState("2026-11-13");
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [focusMonth, setFocusMonth] = useState<{ year: number; monthIndex0: number }>({
    year: 2026,
    monthIndex0: 10,
  });
  const [weekStartDate, setWeekStartDate] = useState("2026-11-08");
  const [selectedDate, setSelectedDate] = useState("2026-11-14");

  const [dateFilter, setDateFilter] = useState<DateFilterKey>("14d");
  const [customStart, setCustomStart] = useState("2026-11-13");
  const [customEnd, setCustomEnd] = useState("2026-11-27");
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>("all");
  const [customStartTime, setCustomStartTime] = useState("10:00");
  const [customEndTime, setCustomEndTime] = useState("18:00");
  const [includeSelf, setIncludeSelf] = useState(true);

  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [friendsCatalog, setFriendsCatalog] = useState<FriendCatalogItem[]>([]);
  const [interestGroups, setInterestGroups] = useState<InterestGroupItem[]>([]);
  const [gridDays, setGridDays] = useState<DayMatchResult[]>([]);
  const [matches, setMatches] = useState<DayMatchResult[]>([]);
  const [timeWindowLabel, setTimeWindowLabel] = useState("ทุกช่วงเวลา (08:00–22:00)");

  const [weeklyRules, setWeeklyRules] = useState<WeeklyRuleItem[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverrideItem[]>([]);
  const [googleCalendar, setGoogleCalendar] = useState<MatchApiResponse["googleCalendar"] | null>(
    null
  );
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  const fetchSeq = useRef(0);

  const visibleGridBounds = useMemo(() => {
    if (viewMode === "month") {
      return getCalendarMonthGridBounds(focusMonth.year, focusMonth.monthIndex0);
    }
    return {
      startDate: weekStartDate,
      endDate: addDaysBangkok(weekStartDate, 6),
    };
  }, [viewMode, focusMonth, weekStartDate]);

  const loadAvailability = useCallback(async () => {
    const res = await fetch("/api/calendar/availability", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setWeeklyRules(data.weeklyRules || []);
    setDateOverrides(data.dateOverrides || []);
  }, []);

  const fetchMatches = useCallback(
    async (opts?: {
      explicitFriendIds?: number[];
      initialBootstrap?: boolean;
      overrideGridBounds?: { startDate: string; endDate: string };
    }) => {
      const seq = ++fetchSeq.current;
      setLoadingMatch(true);
      try {
        const bounds = opts?.overrideGridBounds || visibleGridBounds;
        let res: Response;
        if (opts?.initialBootstrap) {
          const qs = new URLSearchParams({
            dateFilter,
            timeFilter,
            includeSelf: String(includeSelf),
            gridStartDate: bounds.startDate,
            gridEndDate: bounds.endDate,
          });
          res = await fetch(`/api/calendar/match?${qs.toString()}`, { cache: "no-store" });
        } else {
          res = await fetch("/api/calendar/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              friendIds: opts?.explicitFriendIds ?? selectedFriendIds,
              dateFilter,
              customStart,
              customEnd,
              timeFilter,
              customStartTime,
              customEndTime,
              includeSelf,
              gridStartDate: bounds.startDate,
              gridEndDate: bounds.endDate,
            }),
          });
        }

        if (!res.ok) return;
        const data = (await res.json()) as MatchApiResponse;
        if (seq !== fetchSeq.current) return;

        setToday(data.today);
        setFriendsCatalog(data.friendsCatalog || []);
        setInterestGroups(data.interestGroups || []);
        setGridDays(data.gridDays || []);
        setMatches(data.matches || []);
        setTimeWindowLabel(data.timeWindow?.label || "");
        setGoogleCalendar(data.googleCalendar || null);

        if (opts?.initialBootstrap) {
          setSelectedFriendIds(data.selectedFriendIds || []);
          const [ty, tm] = data.today.split("-").map(Number);
          setFocusMonth({ year: ty, monthIndex0: tm - 1 });
          setWeekStartDate(getWeekBoundsSunday(data.today).startDate);
          setCustomStart(data.today);
          setCustomEnd(addDaysBangkok(data.today, 13));
          // Pick upcoming Saturday or today for default inspector
          const firstInteresting =
            data.matches?.[0]?.date || addDaysBangkok(data.today, 1);
          setSelectedDate(firstInteresting);
          setBootstrapped(true);
        }
      } finally {
        if (seq === fetchSeq.current) {
          setLoadingMatch(false);
        }
      }
    },
    [
      visibleGridBounds,
      dateFilter,
      timeFilter,
      includeSelf,
      selectedFriendIds,
      customStart,
      customEnd,
      customStartTime,
      customEndTime,
    ]
  );

  // Initial bootstrap load using Bangkok today
  useEffect(() => {
    const init = async () => {
      await loadAvailability();
      const availRes = await fetch("/api/calendar/availability", { cache: "no-store" });
      let initialToday = "2026-11-13";
      if (availRes.ok) {
        const av = await availRes.json();
        if (av.today) initialToday = av.today;
      }
      const [ty, tm] = initialToday.split("-").map(Number);
      const bounds = getCalendarMonthGridBounds(ty, tm - 1);
      await fetchMatches({ initialBootstrap: true, overrideGridBounds: bounds });
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive recalculation whenever filters, selected friends, or visible range change
  useEffect(() => {
    if (!bootstrapped) return;
    fetchMatches();
  }, [
    bootstrapped,
    selectedFriendIds,
    dateFilter,
    customStart,
    customEnd,
    timeFilter,
    customStartTime,
    customEndTime,
    includeSelf,
    visibleGridBounds,
    fetchMatches,
  ]);

  function handleDateFilterChange(nextFilter: DateFilterKey) {
    setDateFilter(nextFilter);
    const [ty, tm] = today.split("-").map(Number);
    if (nextFilter === "next_month") {
      const nextDt = new Date(Date.UTC(ty, tm, 1));
      setFocusMonth({ year: nextDt.getUTCFullYear(), monthIndex0: nextDt.getUTCMonth() });
      setViewMode("month");
    } else if (nextFilter === "this_month") {
      setFocusMonth({ year: ty, monthIndex0: tm - 1 });
      setViewMode("month");
    }
  }

  function handlePeriodStep(direction: -1 | 1) {
    if (viewMode === "month") {
      const dt = new Date(Date.UTC(focusMonth.year, focusMonth.monthIndex0 + direction, 1));
      setFocusMonth({ year: dt.getUTCFullYear(), monthIndex0: dt.getUTCMonth() });
    } else {
      setWeekStartDate((prev) => addDaysBangkok(prev, direction * 7));
    }
  }

  function handleJumpToday() {
    const [ty, tm] = today.split("-").map(Number);
    setFocusMonth({ year: ty, monthIndex0: tm - 1 });
    setWeekStartDate(getWeekBoundsSunday(today).startDate);
    setSelectedDate(today);
  }

  async function handleSaveDate(payload: {
    avail_date: string;
    status: "available" | "unavailable" | "unknown";
    start_time: string;
    end_time: string;
    note: string;
  }) {
    setSavingAvail(true);
    try {
      const res = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "date", ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "บันทึกไม่สำเร็จ", "error");
        return;
      }
      notify("บันทึกเวลาวันที่เลือกเรียบร้อยแล้ว");
      await loadAvailability();
      await fetchMatches();
    } finally {
      setSavingAvail(false);
    }
  }

  async function handleDeleteDate(dateStr: string) {
    setSavingAvail(true);
    try {
      const res = await fetch(
        `/api/calendar/availability?kind=date&date=${encodeURIComponent(dateStr)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        notify("ล้างการตั้งค่าเฉพาะวันนี้แล้ว");
        await loadAvailability();
        await fetchMatches();
      }
    } finally {
      setSavingAvail(false);
    }
  }

  async function handleSaveWeekly(payload: {
    weekday: number;
    status: "available" | "unavailable";
    start_time: string;
    end_time: string;
    note: string;
  }) {
    setSavingAvail(true);
    try {
      const res = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "weekly", ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "บันทึกประจำสัปดาห์ไม่สำเร็จ", "error");
        return;
      }
      notify("อัปเดตวันว่างประจำสัปดาห์แล้ว");
      await loadAvailability();
      await fetchMatches();
    } finally {
      setSavingAvail(false);
    }
  }

  async function handleDeleteWeekly(weekday: number) {
    setSavingAvail(true);
    try {
      const res = await fetch(`/api/calendar/availability?kind=weekly&weekday=${weekday}`, {
        method: "DELETE",
      });
      if (res.ok) {
        notify("ลบตารางประจำสัปดาห์เรียบร้อยแล้ว");
        await loadAvailability();
        await fetchMatches();
      }
    } finally {
      setSavingAvail(false);
    }
  }

  const inspectedDay = useMemo(() => {
    return (
      gridDays.find((d) => d.date === selectedDate) ||
      matches.find((d) => d.date === selectedDate) ||
      gridDays[0] ||
      null
    );
  }, [gridDays, matches, selectedDate]);

  const unsharedSelectedCount = useMemo(() => {
    const selectedSet = new Set(selectedFriendIds);
    return friendsCatalog.filter((f) => selectedSet.has(f.id) && !f.is_shared).length;
  }, [friendsCatalog, selectedFriendIds]);

  const periodHeading = useMemo(() => {
    if (viewMode === "month") {
      return `${THAI_MONTHS_FULL[focusMonth.monthIndex0]} ${focusMonth.year + 543}`;
    }
    const end = addDaysBangkok(weekStartDate, 6);
    return `${formatThaiDateLabel(weekStartDate)} – ${formatThaiDateLabel(end)}`;
  }, [viewMode, focusMonth, weekStartDate]);

  const focusedMonthPrefix = `${focusMonth.year}-${String(focusMonth.monthIndex0 + 1).padStart(2, "0")}`;

  async function handleRefreshGoogleCalendar() {
    setSyncingGoogle(true);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "ไม่สามารถรีเฟรชข้อมูล Google Calendar ได้", "error");
        return;
      }
      await fetchMatches();
      notify("อัปเดตข้อมูลว่าง/ไม่ว่างจาก Google Calendar แล้ว");
    } finally {
      setSyncingGoogle(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Compact Page Header */}
      <section className="bg-white rounded-xl border border-[#E2E4E7] px-4 py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MascotAvatar pose="happy" size="sm" float={false} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-[#111827] tracking-tight">
                วันไหนว่างตรงกัน?
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#4B5563] text-[11px] font-medium">
                <Clock className="w-3 h-3" />
                <span>เวลาไทย (Asia/Bangkok)</span>
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              เลือกเพื่อนด้านซ้าย แล้วดูช่องสีเขียวบนปฏิทินเพื่อหาวันที่ตรงกัน
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-2.5 py-1.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-xs">
            <span className="text-[#6B7280]">เพื่อน </span>
            <span className="font-bold text-[#111827]">{selectedFriendIds.length} คน</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-[#ECFDF5] border border-[#BBF7D0] text-xs">
            <span className="text-[#166534]">ว่างตรงกัน </span>
            <span className="font-bold text-[#14532D]">{matches.length} วัน</span>
          </div>
          {googleCalendar?.connected ? (
            <>
              <button
                type="button"
                onClick={handleRefreshGoogleCalendar}
                disabled={syncingGoogle}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#86EFAC] text-[#14532D] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? "animate-spin" : ""}`} />
                <span>{syncingGoogle ? "กำลังรีเฟรช..." : "รีเฟรชปฏิทิน"}</span>
              </button>
              <Link
                href="/settings#google-calendar"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151] text-xs font-medium"
                title={googleCalendar.googleEmail || "ตั้งค่า Google Calendar"}
              >
                <span>Google: เชื่อมแล้ว</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </>
          ) : (
            <Link
              href="/settings#google-calendar"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[#111827] text-xs font-semibold transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>เชื่อม Google Calendar</span>
            </Link>
          )}
        </div>
      </section>

      {/* Compact Filters Bar */}
      <section className="bg-white rounded-xl border border-[#E2E4E7] px-4 py-3 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <label className="md:col-span-4 block">
            <span className="text-[11px] font-semibold text-[#4B5563] flex items-center gap-1.5 mb-1">
              <Filter className="w-3 h-3 text-[#6B7280]" />
              <span>เลือกช่วงวัน</span>
            </span>
            <select
              aria-label="เลือกช่วงวัน"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value as DateFilterKey)}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] text-xs sm:text-sm font-medium text-[#111827] focus:bg-white focus:outline-none focus:border-[#16A34A]"
            >
              {DATE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-4 block">
            <span className="text-[11px] font-semibold text-[#4B5563] flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-[#6B7280]" />
              <span>เลือกช่วงเวลา</span>
            </span>
            <select
              aria-label="เลือกช่วงเวลา"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilterKey)}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] text-xs sm:text-sm font-medium text-[#111827] focus:bg-white focus:outline-none focus:border-[#16A34A]"
            >
              {(Object.keys(TIME_FILTER_PRESETS) as TimeFilterKey[]).map((key) => (
                <option key={key} value={key}>
                  {TIME_FILTER_PRESETS[key].label}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-4 flex flex-wrap items-center justify-between md:justify-end gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-xs font-semibold text-[#111827] cursor-pointer select-none hover:bg-[#F3F4F6]">
              <input
                type="checkbox"
                checked={includeSelf}
                onChange={(e) => setIncludeSelf(e.target.checked)}
                className="accent-[#16A34A] w-4 h-4 rounded"
              />
              <span>นับเวลาว่างของฉันด้วย</span>
            </label>
          </div>
        </div>

        {(dateFilter === "custom" || timeFilter === "custom") && (
          <div className="pt-2 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {dateFilter === "custom" && (
              <>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                    ตั้งแต่วันที่
                  </span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] focus:outline-none focus:border-[#16A34A]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                    ถึงวันที่
                  </span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] focus:outline-none focus:border-[#16A34A]"
                  />
                </label>
              </>
            )}

            {timeFilter === "custom" && (
              <>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                    เวลาเริ่มต้น
                  </span>
                  <input
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] focus:outline-none focus:border-[#16A34A]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                    เวลาสิ้นสุด
                  </span>
                  <input
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] focus:outline-none focus:border-[#16A34A]"
                  />
                </label>
              </>
            )}
          </div>
        )}
      </section>

      {/* Main 2-Column Workspace: Narrow Friend Selector (Left) + Large Calendar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)] gap-4 items-start">
        {/* Left Slim Controls */}
        <div className="space-y-4">
          <FriendCalendarSelector
            friends={friendsCatalog}
            interestGroups={interestGroups}
            selectedFriendIds={selectedFriendIds}
            onChangeSelected={setSelectedFriendIds}
          />

          <MyAvailabilityCard
            selectedDate={selectedDate}
            weeklyRules={weeklyRules}
            dateOverrides={dateOverrides}
            saving={savingAvail}
            onSaveDate={handleSaveDate}
            onDeleteDate={handleDeleteDate}
            onSaveWeekly={handleSaveWeekly}
            onDeleteWeekly={handleDeleteWeekly}
          />
        </div>

        {/* Right Large Calendar Grid & Matched Results */}
        <div className="space-y-4 min-w-0">
          {/* Calendar View Card */}
          <section className="bg-white rounded-xl border border-[#E2E4E7] p-4 sm:p-5 shadow-xs space-y-4">
            {/* Calendar Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="ก่อนหน้า"
                    onClick={() => handlePeriodStep(-1)}
                    className="p-2 rounded-lg border border-[#E2E4E7] hover:bg-[#F9FAFB] text-[#374151] cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className="px-3 py-1.5 rounded-lg border border-[#E2E4E7] hover:bg-[#F3F4F6] text-xs font-semibold text-[#111827] cursor-pointer"
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    aria-label="ถัดไป"
                    onClick={() => handlePeriodStep(1)}
                    className="p-2 rounded-lg border border-[#E2E4E7] hover:bg-[#F9FAFB] text-[#374151] cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#111827] flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#16A34A]" />
                  <span>{periodHeading}</span>
                </h2>
              </div>

              {/* Month / Week Toggle */}
              <div className="inline-flex p-0.5 rounded-lg bg-[#F3F4F6] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "month"
                      ? "bg-white text-[#111827] shadow-xs"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === "week"
                      ? "bg-white text-[#111827] shadow-xs"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  รายสัปดาห์
                </button>
              </div>
            </div>

            {/* Clear Full-Cell Swatch Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#374151] font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#16A34A] border border-[#15803D]" />
                <span>ว่างตรงกันทุกคน</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#DCFCE7] border border-[#4ADE80]" />
                <span>ว่างตรงกันบางส่วน</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#FEE2E2] border border-[#FCA5A5]" />
                <span>ไม่ว่าง</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#F3F4F6] border border-[#D1D5DB]" />
                <span>ยังไม่ทราบ</span>
              </span>
            </div>

            {/* Monthly Grid vs Weekly View */}
            {viewMode === "month" ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_SHORT_TH.map((label, idx) => (
                    <div
                      key={label}
                      className={`text-center text-xs font-bold py-1.5 rounded-md bg-[#F8FAFC] ${
                        idx === 0 || idx === 6 ? "text-[#15803D]" : "text-[#4B5563]"
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {gridDays.map((day) => {
                    const isCurrentMonth = day.date.startsWith(focusedMonthPrefix);
                    const isSelected = day.date === selectedDate;
                    const isToday = day.date === today;
                    const dayNum = Number(day.date.slice(8, 10));

                    const isAllMatch = day.totalSelected > 0 && day.allSelectedAvailable && day.availableCount > 0;
                    const isPartialMatch = day.totalSelected > 0 && !day.allSelectedAvailable && day.availableCount > 0;
                    const isBusyOnly = day.totalSelected > 0 && day.availableCount === 0 && day.unavailableCount > 0 && day.unknownCount === 0;
                    const isSelfAvailOnly = day.totalSelected === 0 && day.selfStatus === "available";
                    const isSelfBusyOnly = day.totalSelected === 0 && day.selfStatus === "unavailable";

                    let cellSurfaceCls =
                      "bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]";
                    if (isAllMatch) {
                      cellSurfaceCls =
                        "bg-[#16A34A] border-[#15803D] text-white hover:bg-[#15803D]";
                    } else if (isPartialMatch || isSelfAvailOnly) {
                      const highRatio =
                        day.totalSelected > 0 && day.availableCount / day.totalSelected >= 0.75;
                      cellSurfaceCls = highRatio
                        ? "bg-[#BBF7D0] border-[#22C55E] text-[#052E16] hover:bg-[#86EFAC]"
                        : "bg-[#DCFCE7] border-[#4ADE80] text-[#14532D] hover:bg-[#BBF7D0]";
                    } else if (isBusyOnly || isSelfBusyOnly) {
                      cellSurfaceCls =
                        "bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B] hover:bg-[#FECACA]/80";
                    }

                    const statusSubTextCls = isAllMatch
                      ? "text-white/95"
                      : isPartialMatch || isSelfAvailOnly
                      ? "text-[#14532D]"
                      : isBusyOnly || isSelfBusyOnly
                      ? "text-[#B91C1C]"
                      : "text-[#64748B]";

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={`min-h-[76px] sm:min-h-[96px] p-1.5 sm:p-2.5 rounded-lg border text-left flex flex-col justify-between transition-[box-shadow] cursor-pointer ${cellSurfaceCls} ${
                          isSelected ? "ring-2 ring-[#111827] ring-offset-1 relative z-10" : ""
                        } ${!isCurrentMonth ? "opacity-45" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span
                            className={`text-xs sm:text-sm font-bold leading-none ${
                              isToday
                                ? isAllMatch
                                  ? "px-1.5 py-0.5 rounded bg-white text-[#14532D]"
                                  : "px-1.5 py-0.5 rounded bg-[#111827] text-white"
                                : ""
                            }`}
                          >
                            {dayNum}
                          </span>
                          {isToday && (
                            <span
                              className={`hidden sm:inline text-[10px] font-bold ${
                                isAllMatch ? "text-emerald-50" : "text-[#111827]"
                              }`}
                            >
                              วันนี้
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5 w-full">
                          {day.totalSelected > 0 ? (
                            day.availableCount > 0 ? (
                              <>
                                <div className="text-[11px] sm:text-sm font-extrabold leading-tight truncate">
                                  <span className="sm:hidden">
                                    {day.availableCount}/{day.totalSelected}
                                  </span>
                                  <span className="hidden sm:inline">
                                    ว่าง {day.availableCount}/{day.totalSelected}
                                  </span>
                                </div>
                                {day.overlapStartTime && day.overlapEndTime && (
                                  <div
                                    className={`hidden sm:block text-[11px] font-semibold truncate ${statusSubTextCls}`}
                                  >
                                    {day.overlapStartTime}–{day.overlapEndTime}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div
                                className={`text-[10px] sm:text-[11px] font-medium truncate ${statusSubTextCls}`}
                              >
                                {isBusyOnly
                                  ? "ไม่ว่าง"
                                  : day.unknownCount === day.totalSelected
                                  ? "ยังไม่ทราบ"
                                  : "ไม่ตรงกัน"}
                              </div>
                            )
                          ) : (
                            <div
                              className={`text-[10px] sm:text-[11px] font-semibold truncate ${statusSubTextCls}`}
                            >
                              {day.selfStatus === "available"
                                ? "ฉันว่าง"
                                : day.selfStatus === "unavailable"
                                ? "ไม่ว่าง"
                                : "ยังไม่ทราบ"}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Weekly View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2">
                {gridDays.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const isToday = day.date === today;
                  const isAllMatch = day.totalSelected > 0 && day.allSelectedAvailable && day.availableCount > 0;
                  const isPartialMatch = day.totalSelected > 0 && !day.allSelectedAvailable && day.availableCount > 0;
                  const isBusyOnly = day.totalSelected > 0 && day.availableCount === 0 && day.unavailableCount > 0 && day.unknownCount === 0;

                  let weekCardCls = "border-[#E2E8F0] bg-[#F8FAFC] text-[#111827]";
                  if (isAllMatch) {
                    weekCardCls = "border-[#15803D] bg-[#16A34A] text-white";
                  } else if (isPartialMatch) {
                    weekCardCls = "border-[#4ADE80] bg-[#DCFCE7] text-[#14532D]";
                  } else if (isBusyOnly) {
                    weekCardCls = "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]";
                  }

                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelectedDate(day.date)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDate(day.date);
                        }
                      }}
                      className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 cursor-pointer transition-[box-shadow] ${weekCardCls} ${
                        isSelected ? "ring-2 ring-[#111827] ring-offset-1" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between md:block">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isAllMatch ? "text-emerald-100" : "opacity-80"}`}>
                            {day.weekdayShort}
                          </span>
                          <span className="text-sm font-bold">
                            {Number(day.date.slice(8, 10))}
                          </span>
                          {isToday && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isAllMatch ? "bg-white text-[#14532D]" : "bg-[#111827] text-white"
                              }`}
                            >
                              วันนี้
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${isAllMatch ? "text-white" : ""}`}>
                          {day.totalSelected > 0
                            ? `ว่าง ${day.availableCount}/${day.totalSelected} คน`
                            : "ยังไม่เลือกเพื่อน"}
                        </div>
                      </div>

                      {day.availableCount > 0 && day.overlapStartTime && day.overlapEndTime ? (
                        <div
                          className={`px-2 py-1 rounded text-[11px] font-bold text-center ${
                            isAllMatch
                              ? "bg-white/20 text-white"
                              : "bg-white/80 text-[#14532D] border border-[#86EFAC]"
                          }`}
                        >
                          {day.overlapStartTime}–{day.overlapEndTime} น.
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded bg-white/70 text-[#475569] text-[11px] font-medium text-center">
                          {day.unknownCount === day.totalSelected ? "ยังไม่ทราบ" : "ไม่ตรงกัน"}
                        </div>
                      )}

                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="opacity-80">ฉัน:</span>
                          <span className="font-semibold">
                            {day.selfStatus === "available"
                              ? "ว่าง"
                              : day.selfStatus === "unavailable"
                              ? "ไม่ว่าง"
                              : "ยังไม่ทราบ"}
                          </span>
                        </div>
                        {day.availableFriends.slice(0, 3).map((f) => (
                          <div key={f.id} className="flex items-center gap-1.5 text-[11px]">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isAllMatch ? "border border-white/70" : ""
                              }`}
                              style={{ backgroundColor: f.avatar_color }}
                            />
                            <span className="truncate font-medium">{f.nickname}</span>
                          </div>
                        ))}
                        {day.availableFriends.length > 3 && (
                          <div className="text-[10px] opacity-80">
                            +{day.availableFriends.length - 3} คน
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Day Inspector Bar */}
            {inspectedDay && (
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-[#111827]">
                      {inspectedDay.thaiDate}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        inspectedDay.selfStatus === "available"
                          ? "bg-[#DCFCE7] text-[#14532D]"
                          : inspectedDay.selfStatus === "unavailable"
                          ? "bg-[#FEE2E2] text-[#991B1B]"
                          : "bg-[#E5E7EB] text-[#374151]"
                      }`}
                    >
                      ฉัน:{" "}
                      {inspectedDay.selfStatus === "available"
                        ? `ว่าง (${inspectedDay.selfSlot})`
                        : inspectedDay.selfStatus === "unavailable"
                        ? `ไม่ว่าง (${inspectedDay.selfReason})`
                        : "ยังไม่ทราบ"}
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563]">
                    ว่างตรงกัน <strong className="text-[#15803D]">{inspectedDay.availableCount}/{inspectedDay.totalSelected} คน</strong> ·
                    ไม่ว่าง {inspectedDay.unavailableCount} คน · ยังไม่ทราบ{" "}
                    {inspectedDay.unknownCount} คน
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={savingAvail}
                    onClick={() =>
                      handleSaveDate({
                        avail_date: inspectedDay.date,
                        status: "available",
                        start_time: "10:00",
                        end_time: "21:00",
                        note: "ว่างวันนี้",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#14532D] text-xs font-semibold cursor-pointer"
                  >
                    ตั้งว่าฉันว่าง
                  </button>
                  <button
                    type="button"
                    disabled={savingAvail}
                    onClick={() =>
                      handleSaveDate({
                        avail_date: inspectedDay.date,
                        status: "unavailable",
                        start_time: "08:00",
                        end_time: "22:00",
                        note: "ไม่ว่างวันนี้",
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] text-xs font-semibold cursor-pointer"
                  >
                    ตั้งว่าไม่ว่าง
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Results Section: น้องชวนเจอวันที่น่าว่างตรงกัน */}
          <section className="bg-white rounded-xl border border-[#E2E4E7] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MascotAvatar pose="love" size="sm" float={false} />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#111827] inline-flex items-center gap-1.5 flex-wrap">
                    <span>น้องชวนเจอวันที่น่าว่างตรงกัน</span>
                    <Heart className="w-4 h-4 text-[#16A34A]" strokeWidth={2} />
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    เรียงจากวันที่เพื่อนว่างมากที่สุด · ช่วงเวลา: {timeWindowLabel}
                  </p>
                </div>
              </div>

              {loadingMatch && (
                <span className="text-xs font-medium text-[#15803D]">
                  กำลังคำนวณเวลาว่าง...
                </span>
              )}
            </div>

            {unsharedSelectedCount > 0 && (
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2.5 text-xs text-[#475569]">
                <Info className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
                <span>
                  มีเพื่อน <strong>{unsharedSelectedCount} คน</strong> ที่เลือกไว้แต่ยังไม่มีข้อมูลหรือยังไม่แชร์ปฏิทิน ระบบจึงจัดให้อยู่ในกลุ่ม{" "}
                  <strong>&quot;ยังไม่ทราบ&quot;</strong> โดยไม่นับรวมเป็นคนที่ว่าง
                </span>
              </div>
            )}

            {matches.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] space-y-3">
                <MascotAvatar pose="curious" size="md" float={false} className="mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#111827]">
                    ยังไม่มีวันที่ตรงกับเงื่อนไขที่เลือก
                  </h3>
                  <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                    {dateFilter === "all_available" && unsharedSelectedCount > 0
                      ? 'ตัวกรอง "ว่างครบทุกคน" จะไม่นับเพื่อนที่ยังไม่ทราบเวลาว่าง ลองเลือกเพื่อนที่แชร์ปฏิทินแล้ว หรือสลับเป็น "ว่างมากที่สุด"'
                      : "ลองขยายช่วงวัน เลือกช่วงเวลาเป็นทุกช่วงเวลา หรือเลือกเพื่อนเพิ่มเติม"}
                  </p>
                </div>
                {dateFilter !== "most_available" && (
                  <button
                    type="button"
                    onClick={() => handleDateFilterChange("most_available")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ดูวันที่ว่างมากที่สุด</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((day, idx) => {
                  const slotStart = day.overlapStartTime || "18:00";
                  const slotEnd = day.overlapEndTime || "21:00";
                  const inviteIds =
                    day.availableFriends.length > 0
                      ? day.availableFriends.map((f) => f.id)
                      : selectedFriendIds;
                  const inviteHref = `/activities/new?date=${encodeURIComponent(
                    day.date
                  )}&start_time=${encodeURIComponent(slotStart)}&end_time=${encodeURIComponent(
                    slotEnd
                  )}&friends=${encodeURIComponent(inviteIds.join(","))}`;

                  return (
                    <article
                      key={day.date}
                      className={`rounded-xl border p-4 transition-colors space-y-3 ${
                        idx === 0
                          ? "border-[#4ADE80] bg-[#F0FDF4]/60"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-[#111827] text-white text-[10px] font-bold">
                                แนะนำอันดับ 1
                              </span>
                            )}
                            {day.allSelectedAvailable && (
                              <span className="px-2 py-0.5 rounded-md bg-[#16A34A] text-white text-[10px] font-bold">
                                ว่างตรงกันทุกคน
                              </span>
                            )}
                            <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                              {day.thaiDate}
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#4B5563]">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#111827]">
                              <Clock className="w-3.5 h-3.5 text-[#16A34A]" />
                              <span>
                                เวลาที่ว่างตรงกัน: {slotStart}–{slotEnd} น.
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-[#15803D]">
                              <Users className="w-3.5 h-3.5" />
                              <span>
                                เพื่อนที่ว่าง {day.availableCount}/{day.totalSelected} คน
                              </span>
                            </span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                                day.selfStatus === "available"
                                  ? "bg-[#DCFCE7] text-[#14532D]"
                                  : day.selfStatus === "unavailable"
                                  ? "bg-[#FEE2E2] text-[#991B1B]"
                                  : "bg-[#F3F4F6] text-[#4B5563]"
                              }`}
                            >
                              คุณ:{" "}
                              {day.selfStatus === "available"
                                ? `ว่าง (${day.selfSlot})`
                                : day.selfStatus === "unavailable"
                                ? `ไม่ว่าง (${day.selfReason})`
                                : "ยังไม่ระบุ"}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={inviteHref}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold transition-colors shrink-0 shadow-xs"
                        >
                          <CalendarHeart className="w-4 h-4" />
                          <span>ชวนเพื่อนวันนี้เลย</span>
                        </Link>
                      </div>

                      {/* 3-State Friend Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2.5 border-t border-[#E5E7EB]">
                        {/* Available Friends */}
                        <div className="rounded-lg bg-[#ECFDF5] border border-[#BBF7D0] p-2.5 space-y-1.5">
                          <div className="text-[11px] font-bold text-[#14532D] flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>เพื่อนที่ว่าง ({day.availableFriends.length})</span>
                          </div>
                          {day.availableFriends.length === 0 ? (
                            <p className="text-[11px] text-[#6B7280]">ไม่มีเพื่อนว่างในช่วงนี้</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {day.availableFriends.map((f) => (
                                <span
                                  key={f.id}
                                  title={f.reason}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#86EFAC] text-[11px] font-medium text-[#111827]"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: f.avatar_color }}
                                  />
                                  <span>{f.nickname}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {day.otherTimeFriends.length > 0 && (
                            <div className="text-[10px] text-[#166534] pt-1">
                              ว่างช่วงเวลาอื่น:{" "}
                              {day.otherTimeFriends
                                .map((f) => `${f.nickname} (${f.slot})`)
                                .join(", ")}
                            </div>
                          )}
                        </div>

                        {/* Unavailable Friends */}
                        <div className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] p-2.5 space-y-1.5">
                          <div className="text-[11px] font-bold text-[#991B1B] flex items-center gap-1">
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>เพื่อนที่ไม่ว่าง ({day.unavailableFriends.length})</span>
                          </div>
                          {day.unavailableFriends.length === 0 ? (
                            <p className="text-[11px] text-[#6B7280]">ไม่มีผู้ติดธุระ</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {day.unavailableFriends.map((f) => (
                                <span
                                  key={f.id}
                                  title={f.reason}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#FCA5A5] text-[11px] font-medium text-[#991B1B]"
                                >
                                  <span>{f.nickname}</span>
                                  <span className="text-[10px] text-[#6B7280]">
                                    · {f.reason}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Unknown / Unshared Friends */}
                        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 space-y-1.5">
                          <div className="text-[11px] font-bold text-[#475569] flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>ยังไม่ทราบ / ยังไม่มีข้อมูล ({day.unknownFriends.length})</span>
                          </div>
                          {day.unknownFriends.length === 0 ? (
                            <p className="text-[11px] text-[#6B7280]">ทราบเวลาครบทุกคน</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {day.unknownFriends.map((f) => (
                                <span
                                  key={f.id}
                                  title={f.reason}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#CBD5E1] text-[11px] font-medium text-[#334155]"
                                >
                                  <span>{f.nickname}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
