"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarHeart,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Heart,
  Hourglass,
  ListOrdered,
  MailWarning,
  MapPin,
  PieChart,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar, MascotPose } from "@/components/MascotAvatar";
import { CategoryDonutChart, PastelBarChart } from "@/components/Charts";
import { DashboardSkeleton } from "@/components/Skeletons";
import { getDietaryBadgeClass, inferDietaryCategory } from "@/lib/types";
import type { GroupDietarySnapshot, SmartRecommendedPlan } from "@/lib/plans";

interface DashboardData {
  engineMode?: string;
  summary: {
    totalFriends: number;
    totalRecordedInterests: number;
    totalActivities: number;
    pendingInvitations: number;
    rsvpSummary: { total: number; going: number; notGoing: number; pending: number };
  };
  charts: {
    topPositive: Array<{
      normalized_value: string;
      friend_count: number;
      color: string;
      category_name_th: string;
    }>;
    topFood: Array<{ normalized_value: string; friend_count: number }>;
    topDislikes: Array<{ normalized_value: string; friend_count: number }>;
    topHobbies: Array<{ normalized_value: string; friend_count: number }>;
    topTravel: Array<{ normalized_value: string; friend_count: number }>;
    categoryBreakdown: Array<{ slug: string; name_th: string; color: string; count: number }>;
    segmentSizes: Array<{
      id: string;
      name: string;
      friendCount: number;
      tags: string[];
      href: string;
      source: "saved" | "dynamic";
    }>;
    declineReasons: Array<{ reason: string; count: number }>;
  };
  activities: {
    upcoming: Array<{
      id: number;
      title: string;
      activity_date: string;
      start_time: string;
      location: string;
      going_count: number;
      total_invited: number;
      pending_count: number;
    }>;
    recent: Array<{
      id: number;
      title: string;
      activity_date: string;
      start_time: string;
      category: string;
      location: string;
      going_count: number;
      total_invited: number;
    }>;
    mostPopular: Array<{
      id: number;
      title: string;
      going_count: number;
      total_invited: number;
    }>;
    pendingList: Array<{
      id: number;
      activity_id: number;
      activity_title: string;
      activity_date: string;
      start_time: string;
      friend_id: number;
      friend_nickname: string;
      invite_token: string;
    }>;
  };
  similarPairs: Array<{
    friendA: { id: number; nickname: string; full_name: string };
    friendB: { id: number; nickname: string; full_name: string };
    sharedInterests: string[];
    score: number;
  }>;
  suggestions: Array<{
    id: string;
    pose: MascotPose;
    title: string;
    message: string;
    reason: string;
    actionLabel: string;
    actionHref: string;
  }>;
  friendsOverview?: Array<{
    id: number;
    nickname: string;
    full_name: string;
    religion: string;
    can_eat: string;
    cannot_eat: string;
    personal_notes: string;
    contact_info: string;
    avatar_color: string;
    favoriteFoods: string[];
    allergies: string[];
    dislikedFoods: string[];
    dietaryRestrictions?: string[];
    hobbies: string[];
    travel: string[];
    totalInterests: number;
  }>;
  dietaryBreakdown?: Array<{
    label?: string;
    restriction_label?: string;
    restriction_category?: string;
    friend_count: number;
  }>;
  dietarySnapshot?: GroupDietarySnapshot;
  recommendedPlans?: SmartRecommendedPlan[];
}

function CollapsiblePanel({
  title,
  subtitle,
  icon,
  summaryBadge,
  open,
  onToggle,
  rightLink,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  summaryBadge?: string;
  open: boolean;
  onToggle: () => void;
  rightLink?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-[220px] flex items-center justify-between gap-3 text-left cursor-pointer group focus-visible:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[#FFF3F6] text-[#993858] flex items-center justify-center shrink-0">
              {icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-[#1F1A1C] group-hover:text-[#993858] transition-colors">
                  {title}
                </h2>
                {!open && summaryBadge && (
                  <span className="text-[11px] font-medium text-[#6E5E65] bg-[#FAF9F8] border border-[#EAE6E8] px-2.5 py-0.5 rounded-full truncate max-w-[340px]">
                    {summaryBadge}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-[#6E666A] mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF9F8] group-hover:bg-[#FFF0F5] border border-[#EAE6E8] group-hover:border-[#F0DCE3] text-xs font-semibold text-[#544D51] group-hover:text-[#993858] shrink-0 transition-colors">
            {open ? "ซ่อน" : "เปิดดู"}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {rightLink && <div className="shrink-0">{rightLink}</div>}
      </div>

      {open && <div className="px-5 pb-5 pt-2 border-t border-[#F4ECEF] space-y-5">{children}</div>}
    </section>
  );
}

function DashboardContent() {
  const { user } = useApp();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Interactive Smart Plan state
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [planSnapshot, setPlanSnapshot] = useState<GroupDietarySnapshot | null>(null);
  const [activePlans, setActivePlans] = useState<SmartRecommendedPlan[]>([]);
  const [recalcLoading, setRecalcLoading] = useState(false);

  // Dropdown / progressive disclosure states (uncluttered defaults)
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [dietaryDetailsOpen, setDietaryDetailsOpen] = useState(false);
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Collapsible unified analytics panel + multi-mode chart filters
  const [analyticsSectionOpen, setAnalyticsSectionOpen] = useState(false);
  const [interestFilter, setInterestFilter] = useState<
    "all" | "category" | "food" | "hobbies" | "travel"
  >("all");
  const [interestMode, setInterestMode] = useState<"bar" | "donut" | "list">("bar");
  const [activityFilter, setActivityFilter] = useState<"rsvp" | "popular" | "dietary" | "pairs">(
    "rsvp"
  );
  const [activityMode, setActivityMode] = useState<"bar" | "donut" | "list">("donut");

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ");
        return r.json();
      })
      .then((d: DashboardData) => {
        setData(d);
        if (d.dietarySnapshot) setPlanSnapshot(d.dietarySnapshot);
        if (d.recommendedPlans) setActivePlans(d.recommendedPlans);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  }, []);

  async function recalculatePlans(friendIds: number[]) {
    setRecalcLoading(true);
    try {
      const res = await fetch("/api/plans/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds }),
      });
      if (res.ok) {
        const result = (await res.json()) as {
          snapshot: GroupDietarySnapshot;
          plans: SmartRecommendedPlan[];
        };
        setPlanSnapshot(result.snapshot);
        setActivePlans(result.plans);
      }
    } finally {
      setRecalcLoading(false);
    }
  }

  function toggleFriendForPlan(friendId: number) {
    const next = selectedFriendIds.includes(friendId)
      ? selectedFriendIds.filter((id) => id !== friendId)
      : [...selectedFriendIds, friendId];
    setSelectedFriendIds(next);
    void recalculatePlans(next);
  }

  function resetPlanSelection() {
    setSelectedFriendIds([]);
    void recalculatePlans([]);
  }

  function togglePlanDetail(planId: string) {
    setExpandedPlans((prev) => ({ ...prev, [planId]: !prev[planId] }));
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-[#EAE6E8] text-center space-y-4">
        <MascotAvatar pose="curious" size="lg" className="mx-auto" />
        <p className="text-sm font-bold text-[#A3322E]">{error || "ไม่พบข้อมูลแดชบอร์ด"}</p>
      </div>
    );
  }

  const {
    summary,
    charts,
    activities,
    similarPairs = [],
    suggestions,
    friendsOverview = [],
    dietaryBreakdown = [],
  } = data;

  const effectiveSnapshot = planSnapshot ?? data.dietarySnapshot ?? null;
  const effectivePlans = activePlans.length > 0 ? activePlans : data.recommendedPlans ?? [];
  const visiblePlans = showAllPlans ? effectivePlans : effectivePlans.slice(0, 2);
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 2);

  const rsvpDonutItems = [
    { slug: "going", name_th: "ไปด้วย", color: "#5E8B77", count: summary.rsvpSummary.going },
    { slug: "pending", name_th: "ยังไม่ตอบ", color: "#9C8458", count: summary.rsvpSummary.pending },
    { slug: "not_going", name_th: "ไปไม่ได้", color: "#B85C58", count: summary.rsvpSummary.notGoing },
  ];

  const topInterestSummary = charts.topPositive
    .slice(0, 3)
    .map((t) => `${t.normalized_value} (${t.friend_count})`)
    .join(" · ");

  const CHART_PALETTE = ["#C2597C", "#7F738E", "#9C8458", "#5E8B77", "#5A7D9A", "#B06D82"];

  // Dataset builder for Chart 1 (Interests & Categories — 1 chart, multiple filters & 3 view modes)
  const chart1Entries: Array<{
    label: string;
    value: number;
    color: string;
    sublabel?: string;
    href: string;
  }> = (() => {
    if (interestFilter === "category") {
      return charts.categoryBreakdown.map((c) => ({
        label: c.name_th,
        value: c.count,
        color: c.color,
        href: `/friends?category=${encodeURIComponent(c.slug)}`,
      }));
    }
    if (interestFilter === "food") {
      return charts.topFood.slice(0, 6).map((i, idx) => ({
        label: i.normalized_value,
        value: i.friend_count,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
        href: `/friends?interest=${encodeURIComponent(i.normalized_value)}`,
      }));
    }
    if (interestFilter === "hobbies") {
      return charts.topHobbies.slice(0, 6).map((i, idx) => ({
        label: i.normalized_value,
        value: i.friend_count,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
        href: `/friends?interest=${encodeURIComponent(i.normalized_value)}`,
      }));
    }
    if (interestFilter === "travel") {
      return charts.topTravel.slice(0, 6).map((i, idx) => ({
        label: i.normalized_value,
        value: i.friend_count,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
        href: `/friends?interest=${encodeURIComponent(i.normalized_value)}`,
      }));
    }
    return charts.topPositive.slice(0, 6).map((t) => ({
      label: t.normalized_value,
      value: t.friend_count,
      color: t.color,
      sublabel: t.category_name_th,
      href: `/friends?interest=${encodeURIComponent(t.normalized_value)}`,
    }));
  })();

  // Dataset builder for Chart 2 (Activities, RSVPs & Dietary — 1 chart, multiple filters & 3 view modes)
  const chart2Entries: Array<{
    label: string;
    value: number;
    color: string;
    sublabel?: string;
    href: string;
    unit?: string;
  }> = (() => {
    if (activityFilter === "popular") {
      return activities.mostPopular.slice(0, 6).map((a, idx) => ({
        label: a.title,
        value: a.going_count,
        sublabel: `ชวน ${a.total_invited} คน`,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
        href: `/activities/${a.id}`,
        unit: "คนไปด้วย",
      }));
    }
    if (activityFilter === "dietary") {
      const merged: Array<{
        label: string;
        value: number;
        color: string;
        sublabel?: string;
        href: string;
      }> = [];
      const seen = new Set<string>();
      for (const d of dietaryBreakdown) {
        const lbl = d.label || d.restriction_label || "";
        if (!lbl || seen.has(lbl)) continue;
        seen.add(lbl);
        merged.push({
          label: lbl,
          value: d.friend_count,
          color: d.restriction_category === "halal" ? "#5E8B77" : "#9C8458",
          sublabel: "ข้อจำกัด",
          href: `/friends?dietary=${encodeURIComponent(lbl)}`,
        });
      }
      for (const dis of charts.topDislikes) {
        if (seen.has(dis.normalized_value)) continue;
        seen.add(dis.normalized_value);
        merged.push({
          label: dis.normalized_value,
          value: dis.friend_count,
          color: "#B85C58",
          sublabel: "ไม่ชอบ/แพ้",
          href: `/friends?q=${encodeURIComponent(dis.normalized_value)}`,
        });
      }
      return merged.slice(0, 6);
    }
    if (activityFilter === "rsvp") {
      return rsvpDonutItems.map((r) => ({
        label: r.name_th,
        value: r.count,
        color: r.color,
        href: `/invitations?status=${encodeURIComponent(r.slug)}`,
        unit: "คำเชิญ",
      }));
    }
    return [];
  })();

  return (
    <div className="space-y-6">
      {/* A. Welcome Section */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F4E6EB] shadow-soft space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <MascotAvatar pose="happy" size="md" float />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF0F5] text-[11px] font-medium text-[#8F2849] border border-[#F5C2D3]">
                <span>สวัสดีคุณ {user?.name}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#261B20] tracking-tight inline-flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                <span>วันนี้อยากชวนใครไปทำอะไรดี?</span>
                <Heart className="w-5 h-5 text-[#993858] shrink-0" strokeWidth={2} />
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 shrink-0">
            <Link
              href="/friends?add=1"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFF9FA] text-[#261B20] border border-[#F0DCE3] text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <UserPlus className="w-4 h-4 text-[#F47FA5]" />
              แอดเพื่อนในแอป
            </Link>
            <Link
              href="/activities/new"
              className="px-4 py-2 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <CalendarHeart className="w-4 h-4" />
              สร้างกิจกรรมใหม่
            </Link>
          </div>
        </div>

        {/* 4-Step Visual Guide Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3 border-t border-[#F4E6EB]">
          <Link
            href="/my-profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F4E6EB] transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#F47FA5] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#261B20] truncate">โปรไฟล์ฉัน</div>
              <div className="text-[10px] text-[#6E5E65] truncate">กรอกความชอบ &amp; อาหาร</div>
            </div>
          </Link>
          <Link
            href="/friends?add=1"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F4E6EB] transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#B3486B] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#261B20] truncate">แอดเพื่อนในแอป</div>
              <div className="text-[10px] text-[#6E5E65] truncate">ซิงก์ข้อมูลเพื่อนอัตโนมัติ</div>
            </div>
          </Link>
          <Link
            href="/calendar"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F4E6EB] transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#3A6EA5] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#261B20] truncate">หาวันว่างตรงกัน</div>
              <div className="text-[10px] text-[#6E5E65] truncate">เทียบปฏิทินกลุ่ม</div>
            </div>
          </Link>
          <Link
            href="/activities/new"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F4E6EB] transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#2A6049] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#261B20] truncate">สร้างคำชวน</div>
              <div className="text-[10px] text-[#6E5E65] truncate">ส่งลิงก์เช็กคนไป</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Summary KPI Cards (Compact) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/friends"
          className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#F4E6EB] shadow-card hover:border-[#F47FA5] transition-colors cursor-pointer flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
        >
          <div>
            <span className="text-xs font-semibold text-[#6E5E65] block">เพื่อนทั้งหมด</span>
            <span className="text-2xl font-bold text-[#261B20] tabular-nums">{summary.totalFriends}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FFF3F6] text-[#A34263] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/friends"
          className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#F4E6EB] shadow-card hover:border-[#F47FA5] transition-colors cursor-pointer flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
        >
          <div>
            <span className="text-xs font-semibold text-[#6E5E65] block">ความชอบ</span>
            <span className="text-2xl font-bold text-[#261B20] tabular-nums">{summary.totalRecordedInterests}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FFF3F6] text-[#A34263] flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/activities"
          className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#F4E6EB] shadow-card hover:border-[#F47FA5] transition-colors cursor-pointer flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
        >
          <div>
            <span className="text-xs font-semibold text-[#6E5E65] block">กิจกรรม</span>
            <span className="text-2xl font-bold text-[#261B20] tabular-nums">{summary.totalActivities}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FFF3F6] text-[#A34263] flex items-center justify-center shrink-0">
            <CalendarHeart className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/invitations?status=pending"
          className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#F4E6EB] shadow-card hover:border-[#F47FA5] transition-colors cursor-pointer flex items-center justify-between gap-2 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
        >
          <div>
            <span className="text-xs font-semibold text-[#6E5E65] block">รอตอบคำชวน</span>
            <span className="text-2xl font-bold text-[#261B20] tabular-nums">{summary.pendingInvitations}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FDF3F2] text-[#9A332E] flex items-center justify-center shrink-0">
            <MailWarning className="w-4 h-4" />
          </div>
        </Link>
      </section>

      {/* P1. Smart Recommended Plans — Minimal Header */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#EAE6E8] shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F5] text-[#D85680] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1F1A1C]">
                แพลนแนะนำสำหรับกลุ่มเพื่อน
              </h2>
              <p className="text-xs text-[#6E666A]">
                {selectedFriendIds.length === 0
                  ? "กลุ่มเล็ก 4–10 คน · เช็กความชอบและข้อจำกัดอาหารแล้ว"
                  : `คัดตามเพื่อนที่เลือก ${selectedFriendIds.length} คน`}
              </p>
            </div>
          </div>

          {/* Custom Friend Picker Dropdown Trigger */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFriendPickerOpen((v) => !v)}
              aria-expanded={friendPickerOpen}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                friendPickerOpen || selectedFriendIds.length > 0
                  ? "bg-[#FFF0F5] border-[#F47FA5] text-[#8F2849]"
                  : "bg-white border-[#E4DFE2] text-[#3D363A] hover:border-[#C2597C]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {selectedFriendIds.length > 0
                ? `เลือกเพื่อนเอง (${selectedFriendIds.length})`
                : "เลือกเพื่อนเอง"}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${friendPickerOpen ? "rotate-180" : ""}`}
              />
            </button>

            {selectedFriendIds.length > 0 && (
              <button
                type="button"
                onClick={resetPlanSelection}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#E4DFE2] text-xs font-semibold text-[#544D51] hover:border-[#C2597C] hover:text-[#993858] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalcLoading ? "animate-spin" : ""}`} />
                กลับเป็นแนะนำอัตโนมัติ
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Friend Picker Dropdown */}
        {friendPickerOpen && friendsOverview.length > 0 && (
          <div className="bg-[#FAF9F8] rounded-xl p-4 border border-[#EAE6E8] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[#261B20]">
                  เลือกเพื่อนที่จะนัดร่วมกิจกรรม
                </span>
                <p className="text-[11px] text-[#6E666A]">
                  ติ๊กเลือกเพื่อนในกลุ่มที่ต้องการ เพื่อให้น้องชวนคำนวณความเหมาะสมของร้านและข้อควรระวังด้านอาหาร
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {recalcLoading && (
                  <span className="text-[11px] font-medium text-[#993858] inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    กำลังคำนวณ...
                  </span>
                )}
                {selectedFriendIds.length > 0 && (
                  <button
                    type="button"
                    onClick={resetPlanSelection}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E4DFE2] text-[11px] font-semibold text-[#993858] cursor-pointer"
                  >
                    ล้างที่เลือก
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              {friendsOverview.map((f) => {
                const isSelected = selectedFriendIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFriendForPlan(f.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#B3486B] border-[#993858] text-white"
                        : "bg-white border-[#E4DFE2] text-[#1F1A1C] hover:border-[#C2597C]"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? "#FFFFFF" : f.avatar_color }}
                    />
                    <span>{f.nickname}</span>
                    {f.religion && f.religion !== "ไม่ระบุ" && f.religion !== "พุทธ" && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected ? "bg-white/20 text-white" : "bg-[#F4F2F3] text-[#544D51]"
                        }`}
                      >
                        {f.religion}
                      </span>
                    )}
                    {f.allergies.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected ? "bg-white/20 text-white" : "bg-[#FDF3F2] text-[#A3322E]"
                        }`}
                      >
                        แพ้ {f.allergies[0]}
                      </span>
                    )}
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Dietary Summary Dropdown Bar */}
        {effectiveSnapshot && (
          <div className="rounded-xl bg-[#FFF9FA] border border-[#F0DCE3]">
            <button
              type="button"
              onClick={() => setDietaryDetailsOpen((v) => !v)}
              aria-expanded={dietaryDetailsOpen}
              className="w-full px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#3D363A]">
                <span className="font-semibold text-[#8F2849]">สรุปข้อจำกัดอาหารในกลุ่ม:</span>
                {effectiveSnapshot.noPorkFriends.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF7F0] text-[#75571A] border border-[#EAE0C8] text-[11px] font-medium">
                    ไม่กินหมู/ฮาลาล {effectiveSnapshot.noPorkFriends.length} คน
                  </span>
                )}
                {effectiveSnapshot.allergyAlerts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FDF3F2] text-[#9A332E] border border-[#EED2D0] text-[11px] font-medium">
                    แพ้อาหาร {effectiveSnapshot.allergyAlerts.length} คน
                  </span>
                )}
                {effectiveSnapshot.noMeatFriends.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F2F6F4] text-[#325947] border border-[#D6E3DC] text-[11px] font-medium">
                    มังสวิรัติ {effectiveSnapshot.noMeatFriends.length} คน
                  </span>
                )}
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#993858]">
                {dietaryDetailsOpen ? "ซ่อนรายละเอียด" : "ดูรายชื่อและตัวกรอง"}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    dietaryDetailsOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {dietaryDetailsOpen && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-[#F4E6EB] space-y-2.5 text-xs">
                {dietaryBreakdown.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#544D51] mr-1">
                      กดเพื่อกรองเพื่อนตามข้อจำกัด:
                    </span>
                    {dietaryBreakdown.map((d) => {
                      const label = d.restriction_label || d.label || "";
                      const cat = inferDietaryCategory(label);
                      return (
                        <Link
                          key={label}
                          href={`/friends?dietary=${encodeURIComponent(label)}`}
                          className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition-colors hover:opacity-85 ${getDietaryBadgeClass(
                            cat
                          )}`}
                        >
                          {label} · {d.friend_count} คน
                        </Link>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {effectiveSnapshot.religions.map((r) => (
                    <span
                      key={r.religion}
                      title={r.nicknames.join(", ")}
                      className="px-2.5 py-0.5 rounded-full bg-white text-[#3D363A] border border-[#F0DCE3]"
                    >
                      {r.religion} · {r.count} คน
                    </span>
                  ))}
                  {effectiveSnapshot.noPorkFriends.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F0] text-[#75571A] border border-[#EAE0C8]">
                      ไม่กินหมู: {effectiveSnapshot.noPorkFriends.map((x) => x.nickname).join(", ")}
                    </span>
                  )}
                  {effectiveSnapshot.noBeefFriends.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F0] text-[#75571A] border border-[#EAE0C8]">
                      งดเนื้อวัว: {effectiveSnapshot.noBeefFriends.map((x) => x.nickname).join(", ")}
                    </span>
                  )}
                  {effectiveSnapshot.allergyAlerts.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FDF3F2] text-[#9A332E] border border-[#EED2D0]">
                      แพ้อาหาร:{" "}
                      {effectiveSnapshot.allergyAlerts
                        .map((a) => `${a.nickname} (${a.items.join(", ")})`)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommended Plan Cards (Compact & Readable, Per-card Dropdown Details) */}
        {visiblePlans.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visiblePlans.map((plan) => {
                const isCardExpanded = Boolean(expandedPlans[plan.id]);
                const badgeStyle =
                  plan.suitabilityLevel === "all_safe"
                    ? "bg-[#F2F7F4] text-[#276348] border-[#D4E6DC]"
                    : plan.suitabilityLevel === "needs_care"
                    ? "bg-[#FAF7F0] text-[#75571A] border-[#EAE0C8]"
                    : "bg-[#FDF3F2] text-[#A3322E] border-[#EED2D0]";
                const BadgeIcon =
                  plan.suitabilityLevel === "all_safe"
                    ? CheckCircle2
                    : plan.suitabilityLevel === "needs_care"
                    ? AlertTriangle
                    : ShieldAlert;
                const invitedNames = plan.safeFriends.map((f) => f.nickname);
                const previewNames =
                  invitedNames.slice(0, 4).join(", ") +
                  (invitedNames.length > 4 ? ` +${invitedNames.length - 4}` : "");
                const hasDetailsToExpand =
                  plan.safeFriends.length > 0 ||
                  plan.allergyWarnings.length > 0 ||
                  plan.excludedFriends.length > 0 ||
                  Boolean(plan.tips);

                return (
                  <div
                    key={plan.id}
                    className="bg-[#FAF9F8] rounded-2xl p-4 sm:p-5 border border-[#EAE6E8] flex flex-col justify-between gap-3 hover:border-[#C2597C] transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <MascotAvatar pose={plan.pose} size="xs" float className="shrink-0" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#E4DFE2] text-[#544D51]">
                                {plan.category}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}
                              >
                                <BadgeIcon className="w-3 h-3" />
                                {plan.suitabilityLabel}
                              </span>
                            </div>
                            <h3 className="font-bold text-base text-[#1F1A1C] mt-1 leading-snug">
                              {plan.title}
                            </h3>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-[#276348] tabular-nums leading-none">
                            {plan.safeCount}/{plan.totalTargetCount}
                          </div>
                          <div className="text-[10px] text-[#6E666A] font-medium mt-0.5">
                            คนในวงนี้
                          </div>
                        </div>
                      </div>

                      {/* Compact 1-line invited squad + minimal icon alert badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#EAE6E8] text-[#261B20] font-medium">
                          <Users className="w-3 h-3 text-[#7A7276]" />
                          {previewNames || "ยังไม่มีรายชื่อ"}
                        </span>
                        {plan.allergyWarnings.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FDF3F2] border border-[#EED2D0] text-[#A3322E] font-semibold">
                            <ShieldAlert className="w-3 h-3" />
                            แพ้ {plan.allergyWarnings.length}
                          </span>
                        )}
                        {plan.religionWarnings.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E6F4EC] border border-[#BBE0C8] text-[#1F5E3B] font-semibold">
                            <Utensils className="w-3 h-3" />
                            ฮาลาล/ข้อจำกัด
                          </span>
                        )}
                        {plan.excludedFriends.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#EAE0C8] text-[#75571A] font-semibold">
                            <XCircle className="w-3 h-3" />
                            งด {plan.excludedFriends.length}
                          </span>
                        )}
                      </div>

                      {/* Expandable Dropdown for Reason, Allergies, Friends List & Restaurant Tips */}
                      {isCardExpanded && hasDetailsToExpand && (
                        <div className="pt-2.5 border-t border-[#EAE6E8] space-y-2.5 text-[11px]">
                          {plan.summaryReason && (
                            <p className="text-xs text-[#3D363A] leading-relaxed">{plan.summaryReason}</p>
                          )}
                          {plan.safeFriends.length > 0 && (
                            <div>
                              <div className="font-semibold text-[#261B20] mb-1">
                                รายชื่อเพื่อนที่ชวนได้ ({plan.safeFriends.length} คน):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {plan.safeFriends.map((sf) => (
                                  <span
                                    key={sf.id}
                                    title={sf.caution || sf.reason}
                                    className="px-2.5 py-0.5 rounded-full bg-white border border-[#E4DFE2] text-[#261B20] font-medium"
                                  >
                                    {sf.nickname}
                                    {sf.caution ? " *" : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {plan.allergyWarnings.length > 0 && (
                            <div className="rounded-xl bg-[#FDF3F2] border border-[#EED2D0] p-2.5 space-y-1">
                              <div className="font-semibold text-[#A3322E]">
                                ประวัติแพ้อาหาร — โปรดแจ้งร้านและแยกอุปกรณ์:
                              </div>
                              <ul className="space-y-0.5 text-[#7D1D17] list-disc list-inside">
                                {plan.allergyWarnings.map((w, idx) => (
                                  <li key={idx}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {plan.excludedFriends.length > 0 && (
                            <div className="rounded-xl bg-[#FAF7F0] border border-[#EAE0C8] p-2.5 space-y-1">
                              <div className="font-semibold text-[#75571A]">
                                เพื่อนที่มีข้อจำกัดกับเมนูหลัก ({plan.excludedFriends.length} คน):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {plan.excludedFriends.map((ef) => (
                                  <span
                                    key={ef.id}
                                    className="px-2 py-0.5 rounded-full bg-white border border-[#E6DEC9] text-[#63512E]"
                                  >
                                    <strong>{ef.nickname}</strong>: {ef.reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="rounded-xl bg-white border border-[#EAE6E8] px-3 py-2 text-[#544D51]">
                            <span className="font-semibold text-[#1F1A1C]">คำแนะนำร้าน: </span>
                            {plan.tips}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#EAE6E8] flex flex-wrap items-center justify-between gap-2">
                      {hasDetailsToExpand ? (
                        <button
                          type="button"
                          onClick={() => togglePlanDetail(plan.id)}
                          aria-expanded={isCardExpanded}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E5E65] hover:text-[#993858] cursor-pointer"
                        >
                          {isCardExpanded ? "ซ่อนรายละเอียด" : "รายชื่อ & ข้อควรระวัง"}
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${
                              isCardExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6E666A]">
                          ชอบแนวนี้ {plan.loverCount} คน
                        </span>
                      )}

                      <Link
                        href={plan.createActivityHref}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#E4DFE2] hover:border-[#B3486B] hover:bg-[#B3486B] text-[#1F1A1C] hover:text-white text-xs font-semibold transition-colors"
                      >
                        สร้างกิจกรรม ({plan.safeCount} คน)
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {effectivePlans.length > 2 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllPlans((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#FAF9F8] hover:bg-[#FFF0F5] border border-[#EAE6E8] text-xs font-semibold text-[#544D51] hover:text-[#993858] transition-colors cursor-pointer"
                >
                  {showAllPlans
                    ? "แสดงแพลนแนะนำน้อยลง"
                    : `ดูแพลนแนะนำเพิ่มเติม (${effectivePlans.length - 2} แพลน)`}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showAllPlans ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* B. Nong Chuan — Collapsible Compact Suggestions */}
      {suggestions.length > 0 && (
        <details className="group bg-white rounded-2xl border border-[#EAE6E8] shadow-xs overflow-hidden">
          <summary className="px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer list-none hover:bg-[#FAF9F8] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#FFF0F5] text-[#D85680] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#1F1A1C] inline-flex items-center gap-1.5">
                  <span>คำแนะนำจากน้องชวน</span>
                  <Heart className="w-3.5 h-3.5 text-[#993858] shrink-0" strokeWidth={2} />
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-0.5 rounded-full bg-[#F9F1F4] text-[#993858] text-[11px] font-semibold">
                {suggestions.length} ข้อแนะนำ
              </span>
              <ChevronDown className="w-4 h-4 text-[#6E666A] transition-transform group-open:rotate-180" />
            </div>
          </summary>

          <div className="px-5 pb-5 pt-2 border-t border-[#F0ECEE] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleSuggestions.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#FAF9F8] rounded-xl p-4 border border-[#EAE6E8] flex flex-col justify-between gap-2.5 hover:border-[#C2597C] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <MascotAvatar pose={s.pose} size="xs" />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-[#1F1A1C]">{s.title}</h3>
                      <p className="text-xs text-[#993858] font-medium leading-snug">
                        {s.message}
                      </p>
                      <p className="text-[11px] text-[#544D51]">{s.reason}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      href={s.actionHref}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E4DFE2] hover:bg-[#B3486B] hover:border-[#B3486B] text-[#1F1A1C] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>{s.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {suggestions.length > 2 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowAllSuggestions((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#993858] hover:underline cursor-pointer"
                >
                  {showAllSuggestions ? "ย่อคำแนะนำ" : `ดูทั้งหมด (${suggestions.length} ข้อ)`}
                </button>
              </div>
            )}
          </div>
        </details>
      )}

      {/* C. Actionable Activity Essentials: Upcoming & Pending RSVPs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Activities */}
        <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm sm:text-base text-[#1F1A1C] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#B3486B]" />
              <span>กิจกรรมที่กำลังจะมาถึง</span>
            </h2>
            <Link
              href="/activities"
              className="text-xs font-semibold text-[#993858] hover:underline cursor-pointer"
            >
              ดูทั้งหมด
            </Link>
          </div>
          {activities.upcoming.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#6E666A] bg-[#FAF9F8] rounded-xl space-y-2">
              <MascotAvatar pose="sleepy" size="sm" className="mx-auto" />
              <p>ยังไม่มีกิจกรรมที่กำลังจะมาถึง</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activities.upcoming.slice(0, 3).map((act) => (
                <Link
                  key={act.id}
                  href={`/activities/${act.id}`}
                  className="block p-3.5 rounded-xl bg-[#FAF9F8] hover:bg-white border border-[#EAE6E8] hover:border-[#C2597C] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[#1F1A1C] truncate">{act.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E666A] mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#857B80]" />
                          {act.activity_date} · {act.start_time} น.
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#857B80]" />
                          {act.location}
                        </span>
                      </div>
                    </div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F2F7F4] text-[#276348] border border-[#D4E6DC] tabular-nums shrink-0">
                      ไปด้วย {act.going_count}/{act.total_invited}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations Queue */}
        <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm sm:text-base text-[#261B20] flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-[#9C8458]" />
              <span>คำชวนที่ยังไม่ตอบ</span>
            </h2>
            <Link
              href="/invitations?status=pending"
              className="text-xs font-semibold text-[#A34263] hover:underline cursor-pointer"
            >
              จัดการคำชวน
            </Link>
          </div>
          {!activities.pendingList || activities.pendingList.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#6E5E65] bg-[#FFF9FA] rounded-xl space-y-2">
              <MascotAvatar pose="cheering" size="sm" className="mx-auto" />
              <p className="font-semibold text-[#276348]">เพื่อนตอบรับคำชวนครบทุกคนแล้ว</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.pendingList.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB]"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[#261B20] truncate">
                      {item.friend_nickname} · {item.activity_title}
                    </div>
                    <div className="text-[11px] text-[#6E5E65]">
                      {item.activity_date} เวลา {item.start_time} น.
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/rsvp/${item.invite_token}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#F0DCE3] hover:border-[#F47FA5] text-[11px] font-medium text-[#544D51]"
                    >
                      ตอบรับ
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                      href={`/activities/${item.activity_id}`}
                      className="px-2.5 py-1 rounded-lg bg-[#FFF0F5] text-[#8F2849] text-[11px] font-medium"
                    >
                      ดูสถานะ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* D. Unified Interactive Analytics (2 multi-mode charts with filters) */}

      <CollapsiblePanel
        title="กราฟและสถิติ"
        subtitle=""
        icon={<PieChart className="w-4 h-4" />}
        summaryBadge={topInterestSummary ? `ยอดนิยม: ${topInterestSummary}` : undefined}
        open={analyticsSectionOpen}
        onToggle={() => setAnalyticsSectionOpen((v) => !v)}
        rightLink={
          <Link
            href="/friends"
            className="text-xs font-semibold text-[#993858] hover:underline whitespace-nowrap"
          >
            เพื่อนทั้งหมด ({summary.totalFriends}) →
          </Link>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Interests & Categories (5 datasets x 3 view modes) */}
          <div className="bg-[#FAF9F8] rounded-2xl p-4 sm:p-5 border border-[#EAE6E8] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#1F1A1C] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#B3486B]" />
                <span>ความนิยมและหมวดหมู่</span>
              </h3>

              {/* Chart Display Style Toggle (Bar / Donut / Ranked List) */}
              <div className="inline-flex bg-white p-0.5 rounded-xl border border-[#EAE6E8]">
                {(
                  [
                    { key: "bar", label: "แท่ง", icon: BarChart3 },
                    { key: "donut", label: "โดนัท", icon: PieChart },
                    { key: "list", label: "อันดับ", icon: ListOrdered },
                  ] as const
                ).map((mode) => {
                  const ModeIcon = mode.icon;
                  const active = interestMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setInterestMode(mode.key)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        active ? "bg-[#F47FA5] text-white" : "text-[#544D51] hover:text-[#1F1A1C]"
                      }`}
                    >
                      <ModeIcon className="w-3 h-3" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: "all", label: "รวมยอดนิยม" },
                  { key: "category", label: "ตามหมวด" },
                  { key: "food", label: "อาหาร" },
                  { key: "hobbies", label: "งานอดิเรก" },
                  { key: "travel", label: "ท่องเที่ยว" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setInterestFilter(f.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    interestFilter === f.key
                      ? "bg-[#993858] text-white border-[#993858]"
                      : "bg-white text-[#544D51] border-[#E4DFE2] hover:border-[#C2597C]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Render Selected Chart Mode */}
            {interestMode === "bar" ? (
              <PastelBarChart
                items={chart1Entries.map((e) => ({
                  label: e.label,
                  value: e.value,
                  color: e.color,
                  sublabel: e.sublabel,
                }))}
                unit={interestFilter === "category" ? "รายการ" : "คน"}
                onBarClick={(_label, item) => {
                  const found = chart1Entries.find((e) => e.label === item.label);
                  if (found) router.push(found.href);
                }}
              />
            ) : interestMode === "donut" ? (
              <CategoryDonutChart
                items={chart1Entries.map((e) => ({
                  slug: e.label,
                  name_th: e.label,
                  color: e.color,
                  count: e.value,
                }))}
                centerLabel={interestFilter === "category" ? "รายการ" : "คน"}
                onSliceClick={(item) => {
                  const found = chart1Entries.find((e) => e.label === item.name_th);
                  if (found) router.push(found.href);
                }}
              />
            ) : chart1Entries.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6E666A] bg-white rounded-xl border border-[#EAE6E8]">
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div className="space-y-1.5">
                {chart1Entries.map((e, idx) => (
                  <button
                    key={e.label}
                    type="button"
                    onClick={() => router.push(e.href)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#EAE6E8] hover:border-[#C2597C] text-xs transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: e.color }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-[#1F1A1C] truncate">{e.label}</span>
                      {e.sublabel && (
                        <span className="text-[11px] text-[#6E666A] truncate">· {e.sublabel}</span>
                      )}
                    </span>
                    <span className="font-bold text-[#993858] tabular-nums shrink-0">
                      {e.value} {interestFilter === "category" ? "รายการ" : "คน"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chart 2: Activities, RSVPs, Dietary & Pairs (4 datasets x 3 view modes) */}
          <div className="bg-[#FAF9F8] rounded-2xl p-4 sm:p-5 border border-[#EAE6E8] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#1F1A1C] flex items-center gap-1.5">
                <CalendarHeart className="w-4 h-4 text-[#B3486B]" />
                <span>กิจกรรม คำชวน &amp; ข้อจำกัด</span>
              </h3>

              {activityFilter !== "pairs" && (
                <div className="inline-flex bg-white p-0.5 rounded-xl border border-[#EAE6E8]">
                  {(
                    [
                      { key: "bar", label: "แท่ง", icon: BarChart3 },
                      { key: "donut", label: "โดนัท", icon: PieChart },
                      { key: "list", label: "สรุป", icon: ListOrdered },
                    ] as const
                  ).map((mode) => {
                    const ModeIcon = mode.icon;
                    const active = activityMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setActivityMode(mode.key)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? "bg-[#F47FA5] text-white"
                            : "text-[#544D51] hover:text-[#1F1A1C]"
                        }`}
                      >
                        <ModeIcon className="w-3 h-3" />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Data Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: "rsvp", label: "ตอบรับคำชวน" },
                  { key: "popular", label: "กิจกรรมฮิต" },
                  { key: "dietary", label: "แพ้ & ข้อจำกัด" },
                  { key: "pairs", label: `คู่เพื่อนใจตรงกัน (${similarPairs.length})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActivityFilter(f.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    activityFilter === f.key
                      ? "bg-[#993858] text-white border-[#993858]"
                      : "bg-white text-[#544D51] border-[#E4DFE2] hover:border-[#C2597C]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Render Selected Dataset & View Mode */}
            {activityFilter === "pairs" ? (
              similarPairs.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6E666A] bg-white rounded-xl border border-[#EAE6E8]">
                  เพิ่มความชอบของเพื่อนอย่างน้อย 2 คนเพื่อให้ระบบจับคู่ความชอบร่วมกัน
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {similarPairs.map((pair) => (
                    <div
                      key={`${pair.friendA.id}-${pair.friendB.id}`}
                      className="p-3 rounded-xl bg-white border border-[#EAE6E8] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="font-bold text-[#1F1A1C] truncate">
                          <Link
                            href={`/friends/${pair.friendA.id}`}
                            className="hover:text-[#993858] hover:underline"
                          >
                            {pair.friendA.nickname}
                          </Link>{" "}
                          &amp;{" "}
                          <Link
                            href={`/friends/${pair.friendB.id}`}
                            className="hover:text-[#993858] hover:underline"
                          >
                            {pair.friendB.nickname}
                          </Link>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF0F5] text-[#8F2849] text-[10px] font-semibold shrink-0">
                          ตรงกัน {pair.score} อย่าง
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pair.sharedInterests.slice(0, 4).map((tag) => (
                          <Link
                            key={tag}
                            href={`/friends?interest=${encodeURIComponent(tag)}`}
                            className="px-2 py-0.5 rounded-full bg-[#FAF9F8] border border-[#E4DFE2] hover:border-[#C2597C] text-[10px] font-medium text-[#544D51]"
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {activityMode === "bar" ? (
                  <PastelBarChart
                    items={chart2Entries.map((e) => ({
                      label: e.label,
                      value: e.value,
                      color: e.color,
                      sublabel: e.sublabel,
                    }))}
                    unit={
                      activityFilter === "popular"
                        ? "คนไปด้วย"
                        : activityFilter === "rsvp"
                        ? "คำเชิญ"
                        : "คน"
                    }
                    onBarClick={(_label, item) => {
                      const found = chart2Entries.find((e) => e.label === item.label);
                      if (found) router.push(found.href);
                    }}
                  />
                ) : activityMode === "donut" ? (
                  <CategoryDonutChart
                    items={chart2Entries.map((e) => ({
                      slug: e.label,
                      name_th: e.label,
                      color: e.color,
                      count: e.value,
                    }))}
                    centerLabel={activityFilter === "rsvp" ? "คำเชิญ" : "คน"}
                    onSliceClick={(item) => {
                      const found = chart2Entries.find((e) => e.label === item.name_th);
                      if (found) router.push(found.href);
                    }}
                  />
                ) : chart2Entries.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#6E666A] bg-white rounded-xl border border-[#EAE6E8]">
                    ยังไม่มีข้อมูล
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {chart2Entries.map((e, idx) => (
                      <button
                        key={e.label}
                        type="button"
                        onClick={() => router.push(e.href)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#EAE6E8] hover:border-[#C2597C] text-xs transition-colors cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: e.color }}
                          />
                          <span className="font-semibold text-[#1F1A1C] truncate">
                            {idx + 1}. {e.label}
                          </span>
                          {e.sublabel && (
                            <span className="text-[11px] text-[#6E666A] truncate">· {e.sublabel}</span>
                          )}
                        </span>
                        <span className="font-bold text-[#993858] tabular-nums shrink-0">
                          {e.value} {e.unit || "คน"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {activityFilter === "rsvp" &&
                  charts.declineReasons &&
                  charts.declineReasons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#EAE6E8]">
                      <span className="text-[11px] text-[#6E666A] mr-1">เหตุผลที่ไม่สะดวก:</span>
                      {charts.declineReasons.map((r) => (
                        <span
                          key={r.reason}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-[#EAE6E8] text-[#3D363A]"
                        >
                          {r.reason} · {r.count}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
