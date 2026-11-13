"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Heart,
  Info,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";

const ACTIVITY_CATEGORIES = [
  "อาหารและสังสรรค์",
  "คาเฟ่และไลฟ์สไตล์",
  "ท่องเที่ยว",
  "งานอดิเรกและเกม",
  "ภาพยนตร์และบันเทิง",
  "ออกกำลังกาย",
  "อื่น ๆ",
];

const POPULAR_TARGET_TAGS = [
  "หมูกระทะ",
  "ชาบู",
  "คาเฟ่",
  "ทะเล",
  "บอร์ดเกม",
  "ดูหนัง",
  "ถ่ายรูป",
  "กาแฟ",
  "ส้มตำ",
  "พิซซ่า",
  "ภูเขา",
  "ปิกนิก",
];

const EXAMPLE_ACTIVITIES = [
  {
    title: "หมูกระทะวันศุกร์",
    category: "อาหารและสังสรรค์",
    location: "ร้านเจ้าเนื้อทอง หมูกระทะ ย่านอารีย์",
    description: "นัดรับประทานปิ้งย่างหลังเลิกงานวันศุกร์ สำหรับเพื่อนที่ชื่นชอบหมูกระทะ",
    tags: ["หมูกระทะ"],
  },
  {
    title: "คาเฟ่ฮอปปิง",
    category: "คาเฟ่และไลฟ์สไตล์",
    location: "ย่านทรงวาด - เจริญกรุง",
    description: "นัดพบปะจิบกาแฟและถ่ายภาพช่วงบ่ายวันเสาร์",
    tags: ["คาเฟ่", "กาแฟ", "ถ่ายรูป"],
  },
  {
    title: "เที่ยวทะเลวันหยุด",
    category: "ท่องเที่ยว",
    location: "บางแสน - ชลบุรี",
    description: "เดินทางท่องเที่ยววันหยุดพักผ่อนริมชายหาดและรับประทานอาหารร่วมกัน",
    tags: ["ทะเล"],
  },
  {
    title: "Movie Night",
    category: "ภาพยนตร์และบันเทิง",
    location: "House Samyan",
    description: "นัดชมภาพยนตร์รอบค่ำและรับประทานอาหารร่วมกันภายหลัง",
    tags: ["ดูหนัง"],
  },
  {
    title: "Board Game Day",
    category: "งานอดิเรกและเกม",
    location: "Board Game Cafe ย่านพญาไท",
    description: "นัดพบปะเล่นบอร์ดเกมร่วมกันในช่วงบ่าย",
    tags: ["บอร์ดเกม"],
  },
];

interface RecommendedFriend {
  id: number;
  full_name: string;
  nickname: string;
  religion?: string;
  cannot_eat?: string;
  dietary_restrictions?: Array<{
    id?: number;
    restriction_label: string;
    restriction_category: string;
  }>;
  dietaryWarnings?: string[];
  hasTargetConflict?: boolean;
  avatar_color: string;
  contact_info: string | null;
  matchedLikes: string[];
  categoryRelated: string[];
  dislikes: Array<{ normalized_value: string; restriction_type: "allergy" | "dislike" | null }>;
  matchScore: number;
  recommendationReason: string;
  availability_status?: "available" | "unavailable" | "unknown";
  availability_slot?: string | null;
  availability_reason?: string;
  availability_source?: "google" | "manual" | "none";
}

function NewActivityInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, notify } = useApp();

  const initialTags = (searchParams.get("tag") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const initialDietary = (searchParams.get("dietary") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const initialFriendIds = (searchParams.get("friends") || searchParams.get("friendIds") || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const initialTitle = searchParams.get("title") || "";
  const initialCategory = searchParams.get("category") || "อาหารและสังสรรค์";
  const rawDate = (searchParams.get("date") || "").trim();
  const rawStartTime = (searchParams.get("start_time") || "").trim();
  const rawEndTime = (searchParams.get("end_time") || "").trim();

  const [title, setTitle] = useState(
    initialTitle ||
      (initialTags.length > 0
        ? `กิจกรรม${initialTags[0]}`
        : initialDietary.length > 0
        ? `นัดทานข้าว · ${initialDietary[0]}`
        : "")
  );
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(
    ACTIVITY_CATEGORIES.includes(initialCategory) ? initialCategory : "อาหารและสังสรรค์"
  );
  const [activityDate, setActivityDate] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : "2026-11-21"
  );
  const [startTime, setStartTime] = useState(
    /^\d{2}:\d{2}$/.test(rawStartTime) ? rawStartTime : "18:30"
  );
  const [endTime, setEndTime] = useState(
    /^\d{2}:\d{2}$/.test(rawEndTime) ? rawEndTime : "21:00"
  );
  const [location, setLocation] = useState("");
  const [targetTags, setTargetTags] = useState<string[]>(initialTags);
  const [customTag, setCustomTag] = useState("");

  const [recommendations, setRecommendations] = useState<RecommendedFriend[]>([]);
  const [matchingCount, setMatchingCount] = useState(0);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialFriendIds);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(
    initialFriendIds.length > 0
  );
  const [showOtherFriends, setShowOtherFriends] = useState(false);
  const [showDietaryDetails, setShowDietaryDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const IDEAL_GROUP_CAP = 8;

  const fetchRecommendations = useCallback(
    async (tagsOverride?: string[], applyDetectedFromTitle?: boolean) => {
      setLoadingRecs(true);
      try {
        const res = await fetch("/api/activities/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            category,
            target_interests: tagsOverride ?? (applyDetectedFromTitle ? [] : targetTags),
            activity_date: activityDate,
            start_time: startTime,
            end_time: endTime,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const recs: RecommendedFriend[] = data.recommendations || [];
        setRecommendations(recs);
        setMatchingCount(data.matchingCount || 0);

        if (applyDetectedFromTitle && Array.isArray(data.detectedTags) && data.detectedTags.length > 0) {
          setTargetTags(data.detectedTags);
          const nonConflictMatched = recs.filter(
            (r) => r.matchedLikes.length > 0 && !r.hasTargetConflict
          );
          const pool =
            nonConflictMatched.length > 0
              ? nonConflictMatched
              : recs.filter((r) => r.matchedLikes.length > 0);
          const autoChosen = pool.slice(0, IDEAL_GROUP_CAP).map((r) => r.id);
          setSelectedIds(autoChosen);
          notify(
            `พบหัวข้อ "${data.detectedTags.join(", ")}" — คัดเพื่อนที่เข้ากัน ${autoChosen.length} คนไว้ให้แล้ว (แนะนำ 4–10 คน)`
          );
        } else if (!hasInitializedSelection && (tagsOverride ?? targetTags).length > 0) {
          const nonConflictMatched = recs.filter(
            (r) => r.matchedLikes.length > 0 && !r.hasTargetConflict
          );
          const pool =
            nonConflictMatched.length > 0
              ? nonConflictMatched
              : recs.filter((r) => r.matchedLikes.length > 0);
          setSelectedIds(pool.slice(0, IDEAL_GROUP_CAP).map((r) => r.id));
          setHasInitializedSelection(true);
        }
      } finally {
        setLoadingRecs(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, category, targetTags, activityDate, startTime, endTime]
  );

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  function applyExample(ex: (typeof EXAMPLE_ACTIVITIES)[number]) {
    setTitle(ex.title);
    setCategory(ex.category);
    setLocation(ex.location);
    setDescription(ex.description);
    setTargetTags(ex.tags);
    setHasInitializedSelection(false);
    fetchRecommendations(ex.tags);
  }

  function toggleTag(tag: string) {
    setTargetTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  }

  function selectRecommendedGroup(limit = 6) {
    const matched = recommendations.filter((r) => r.matchedLikes.length > 0 && !r.hasTargetConflict);
    const pool = matched.length >= 4 ? matched : recommendations.filter((r) => !r.hasTargetConflict);
    const chosen = (pool.length > 0 ? pool : recommendations).slice(0, limit).map((r) => r.id);
    setSelectedIds(chosen);
    notify(`เลือกกลุ่มแนะนำ ${chosen.length} คน (ขนาดวงที่กำลังดี 4–10 คน) เรียบร้อยแล้ว`);
  }

  function toggleFriend(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedFriendsList = recommendations.filter((r) => selectedIds.includes(r.id));
  const selectedWarnings = selectedFriendsList.flatMap((f) =>
    f.dislikes.map((d) => ({ nickname: f.nickname, ...d }))
  );

  // Nong Chuan Dietary & Halal warnings for organizer (NEVER excludes friends automatically)
  const dietaryAlertMessages = React.useMemo(() => {
    const msgs: string[] = [];
    for (const f of selectedFriendsList) {
      if (Array.isArray(f.dietaryWarnings)) {
        for (const w of f.dietaryWarnings) {
          if (!msgs.includes(w)) msgs.push(w);
        }
      }
    }
    const wantsHalalSelected = selectedFriendsList.some((f) =>
      f.dietary_restrictions?.some((d) => d.restriction_label === "ต้องการอาหารฮาลาล")
    );
    const combinedVenueText = `${title} ${location} ${description}`.toLowerCase();
    const mentionsHalalVenue =
      combinedVenueText.includes("ฮาลาล") || combinedVenueText.includes("halal");
    if (wantsHalalSelected && !mentionsHalalVenue) {
      msgs.push(
        "คำแนะนำเรื่องร้านอาหาร: มีเพื่อนที่ต้องการอาหารฮาลาลอยู่ในรายการที่เลือก แต่ชื่อกิจกรรมหรือสถานที่ยังไม่ได้ระบุว่าร้านมีเมนูฮาลาล ลองตรวจสอบร้านก่อนนัดนะ จะได้ไปสนุกด้วยกันทุกคน!"
      );
    }
    return msgs;
  }, [selectedFriendsList, title, location, description]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !activityDate || !startTime || !location.trim()) {
      notify("กรุณากรอกชื่อกิจกรรม วันที่ เวลาเริ่มต้น และสถานที่ให้ครบถ้วน", "error");
      return;
    }
    if (endTime && endTime <= startTime) {
      notify("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          activity_date: activityDate,
          start_time: startTime,
          end_time: endTime || null,
          location,
          target_interests: targetTags,
          friendIds: selectedIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "ไม่สามารถสร้างกิจกรรมได้", "error");
        return;
      }
      notify(
        `สร้างกิจกรรม "${title}" และสร้างคำชวน ${data.generatedLinksCount ?? selectedIds.length} รายการเรียบร้อยแล้ว`
      );
      router.push(`/activities/${data.activity.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/activities"
            className="p-2 rounded-xl bg-white border border-[#F0DCE3] text-[#6E5E65] hover:border-[#F47FA5]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#261B20]">สร้างกิจกรรมและชวนเพื่อน</h1>
            <p className="text-xs text-[#6E5E65]">
              เลือกเพื่อนที่ความชอบตรงกับกิจกรรม พร้อมดูคำแนะนำเรื่องข้อจำกัดด้านอาหารจากน้องชวนก่อนส่งคำชวน
            </p>
          </div>
        </div>
        {user && (
          <div className="text-xs font-medium text-[#6E5E65] bg-white px-3.5 py-2 rounded-xl border border-[#F4E6EB]">
            ผู้จัดกิจกรรม: <span className="font-semibold text-[#261B20]">{user.name}</span>
          </div>
        )}
      </div>

      {/* Smart Calendar Prefill Banner */}
      {rawDate && (
        <div className="bg-[#EDF7F1] border border-[#CDE6D7] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1E5E42]">
          <div className="flex items-center gap-2 font-medium">
            <Calendar className="w-4 h-4 text-[#2E7D5B] shrink-0" />
            <span>
              เลือกวัน-เวลาและเพื่อนจากหน้า &quot;วันไหนว่างตรงกัน?&quot; ({activityDate} เวลา {startTime}
              {endTime ? `–${endTime}` : ""}) ไว้ให้แล้ว
            </span>
          </div>
          <Link
            href="/calendar"
            className="text-xs font-semibold underline hover:text-[#144430]"
          >
            กลับไปปรับในปฏิทิน
          </Link>
        </div>
      )}

      {/* Quick Activity Examples */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-[#F4E6EB] shadow-card flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#6E5E65] inline-flex items-center gap-1 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-[#F47FA5]" />
          ไอเดียลัด:
        </span>
        {EXAMPLE_ACTIVITIES.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => applyExample(ex)}
            className="px-3 py-1 rounded-full text-xs font-medium bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F0DCE3] text-[#261B20] hover:border-[#F47FA5] transition-colors cursor-pointer"
          >
            {ex.title}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Activity Details */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#F4E6EB] shadow-card space-y-4 h-fit">
          <h2 className="font-bold text-lg text-[#261B20]">1. รายละเอียดกิจกรรม</h2>

          <div>
            <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
              ชื่อกิจกรรม *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น หมูกระทะวันศุกร์ หรือ คาเฟ่ฮอปปิง"
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
              />
              <button
                type="button"
                onClick={() => fetchRecommendations(undefined, true)}
                className="px-3 py-2 rounded-xl bg-[#FFF6F9] hover:bg-[#FFE4EC] text-[#8F2849] border border-[#F5C2D3] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                title="ค้นหาเพื่อนที่ชอบตรงกับชื่อกิจกรรมนี้"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#A34263]" />
                หาเพื่อนที่น่าชวน
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">หมวดหมู่</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20]"
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
                วันที่นัดหมาย *
              </label>
              <input
                type="date"
                required
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
                เวลาเริ่มต้น *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
                เวลาสิ้นสุด
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">สถานที่ *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="เช่น ร้านเจ้าเนื้อทอง หมูกระทะ ย่านอารีย์"
              className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
              รายละเอียดเพิ่มเติม
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="บอกรายละเอียดเล็กน้อยให้เพื่อนที่ถูกชวนทราบก่อนตัดสินใจ"
              className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
            />
          </div>

          {/* Target Interests */}
          <div className="pt-2 border-t border-[#F4E6EB] space-y-2.5">
            <label className="block text-xs font-bold text-[#261B20]">
              ความชอบของเพื่อนที่ตรงกับกิจกรรมนี้
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_TARGET_TAGS.map((t) => {
                const active = targetTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#F47FA5] text-white border-[#F47FA5]"
                        : "bg-[#FFF9FA] text-[#4A3B41] border-[#F0DCE3]"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (customTag.trim()) {
                      toggleTag(customTag.trim());
                      setCustomTag("");
                    }
                  }
                }}
                placeholder="เพิ่มความชอบอื่น ๆ ที่เกี่ยวข้อง"
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#F0DCE3] text-xs bg-white text-[#261B20]"
              />
              <button
                type="button"
                onClick={() => {
                  if (customTag.trim()) {
                    toggleTag(customTag.trim());
                    setCustomTag("");
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-[#FFF6F9] hover:bg-[#FFE4EC] text-[#8F2849] text-xs font-semibold cursor-pointer border border-[#F5C2D3]"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>

        {/* Right: Smart Friend Recommendations + Recipient Review */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MascotAvatar pose={matchingCount > 0 ? "happy" : "curious"} size="sm" />
              <div>
                <p className="font-bold text-sm text-[#261B20]">
                  {loadingRecs
                    ? "น้องชวนกำลังหาเพื่อนที่น่าชวนอยู่นะ..."
                    : targetTags.length > 0
                    ? `เจอเพื่อนที่ชอบตรงกัน ${matchingCount} คน`
                    : "เลือกความชอบหรือให้ระบบคัดกลุ่มแนะนำได้เลย"}
                </p>
                <p className="text-xs text-[#6E5E65]">
                  เลือกชวนแล้ว <strong className="text-[#261B20]">{selectedIds.length} คน</strong> · แนะนำ 4–10 คนกำลังดี
                  {initialDietary.length > 0 ? ` · กลุ่ม: ${initialDietary.join(", ")}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectRecommendedGroup(6)}
              className="px-3.5 py-2 rounded-xl bg-[#FFF9FA] text-[#8F2849] border border-[#F0DCE3] text-xs font-semibold hover:bg-[#F47FA5] hover:text-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              คัดกลุ่มแนะนำ 6 คน
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-sm text-[#261B20] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#F47FA5]" />
                2. เลือกเพื่อนที่จะชวน · {selectedIds.length} คน
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => selectRecommendedGroup(8)}
                  className="text-xs font-semibold text-[#A34263] hover:underline cursor-pointer"
                >
                  เลือกกลุ่มพอดี 8 คน
                </button>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs font-semibold text-[#6E5E65] hover:underline cursor-pointer"
                  >
                    ล้างที่เลือก
                  </button>
                )}
              </div>
            </div>

            {selectedIds.length > 10 && (
              <div className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EAE0C8] text-xs text-[#75571A] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  เลือกไว้ {selectedIds.length} คนแล้ว — ปกติไปเที่ยวกับเพื่อนจริง 4–10 คนจะคุยง่ายและหาร้านได้สะดวกกว่านะ
                </span>
              </div>
            )}

            {(() => {
              const matchedOrSelected = recommendations.filter(
                (r) => r.matchedLikes.length > 0 || selectedIds.includes(r.id)
              );
              const primaryRecs =
                matchedOrSelected.length > 0 ? matchedOrSelected : recommendations.slice(0, 8);
              const primaryIds = new Set(primaryRecs.map((r) => r.id));
              const otherRecs = recommendations.filter((r) => !primaryIds.has(r.id));

              const renderRecButton = (rec: RecommendedFriend) => {
                const checked = selectedIds.includes(rec.id);
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => toggleFriend(rec.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                      checked
                        ? "bg-[#FFF6F9] border-[#F47FA5]"
                        : "bg-[#FFF9FA] border-[#F4E6EB] hover:border-[#E5C5D0]"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked
                            ? "bg-[#F47FA5] border-[#F47FA5] text-white"
                            : "bg-white border-[#DFC5CE]"
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="font-bold text-sm text-[#261B20] flex items-center gap-1.5 flex-wrap">
                          <span>{rec.nickname}</span>
                          {rec.availability_status === "available" && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF7F1] text-[#1E5E42] border border-[#CDE6D7]"
                              title={rec.availability_reason || "ว่างในช่วงเวลาที่เลือก"}
                            >
                              {rec.availability_source === "google" ? "ว่าง (Google)" : "ว่างช่วงนี้"}
                            </span>
                          )}
                          {rec.availability_status === "unavailable" && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FCE8E6] text-[#9A332E] border border-[#EED2D0]"
                              title={rec.availability_reason || "ไม่ว่างช่วงเวลาที่เลือก"}
                            >
                              ไม่ว่างช่วงนี้
                            </span>
                          )}
                          {rec.availability_status === "unknown" && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2F3] text-[#6E666A] border border-[#E2DDE0]"
                              title={rec.availability_reason || "ยังไม่มีข้อมูลปฏิทิน"}
                            >
                              ยังไม่มีข้อมูล
                            </span>
                          )}
                          {rec.religion && rec.religion !== "ไม่ระบุ" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF3F6] text-[#6E5E65] border border-[#F0DCE3]">
                              {rec.religion}
                            </span>
                          )}
                          {rec.dietary_restrictions?.slice(0, 2).map((d) => (
                            <span
                              key={`${rec.id}-${d.restriction_label}`}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                d.restriction_category === "halal" || d.restriction_category === "religious_or_cultural"
                                  ? "bg-[#E6F4EC] text-[#1F5E3B] border-[#BBE0C8]"
                                  : d.restriction_category === "allergy"
                                  ? "bg-[#FCE8E6] text-[#9A332E] border-[#EED2D0]"
                                  : "bg-[#FFE4EC] text-[#8F2849] border-[#F5C2D3]"
                              }`}
                            >
                              {d.restriction_label}
                            </span>
                          ))}
                          {rec.hasTargetConflict && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDF3F2] text-[#9A332E] border border-[#EED2D0]">
                              มีข้อจำกัดอาหาร
                            </span>
                          )}
                          {rec.matchedLikes.slice(0, 2).map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]"
                            >
                              ชอบ: {m}
                            </span>
                          ))}
                        </div>
                        {rec.dislikes.length > 0 ? (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-[#9A332E]">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>
                              {rec.dislikes
                                .slice(0, 2)
                                .map((d) =>
                                  d.restriction_type === "allergy"
                                    ? `แพ้ ${d.normalized_value}`
                                    : `ไม่ชอบ ${d.normalized_value}`
                                )
                                .join(" · ")}
                            </span>
                          </div>
                        ) : rec.matchedLikes.length === 0 && !(rec.dietary_restrictions?.length) ? (
                          <p className="text-[11px] text-[#6E5E65] line-clamp-1">{rec.recommendationReason}</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              };

              return (
                <div className="space-y-2.5">
                  <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                    {primaryRecs.map(renderRecButton)}
                  </div>

                  {otherRecs.length > 0 && (
                    <div className="border-t border-[#F4E6EB] pt-2">
                      <button
                        type="button"
                        onClick={() => setShowOtherFriends((v) => !v)}
                        className="w-full py-1.5 px-3 rounded-xl bg-[#FAF9F8] hover:bg-[#FFF0F5] border border-[#EAE6E8] text-xs font-semibold text-[#544D51] flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          {showOtherFriends
                            ? `ซ่อนรายชื่อเพื่อนเพิ่มเติม`
                            : `ดูเพื่อนคนอื่นในรายชื่ออีก ${otherRecs.length} คน`}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            showOtherFriends ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {showOtherFriends && (
                        <div className="mt-2 max-h-[260px] overflow-y-auto space-y-2 pr-1">
                          {otherRecs.map(renderRecButton)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Step 3: Mandatory Recipient Review + Nong Chuan Dietary/Halal Warnings */}
          <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-3">
            <h3 className="font-bold text-sm text-[#261B20] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#F47FA5]" />
              3. ตรวจสอบเพื่อนและคำแนะนำก่อนส่งคำชวน
            </h3>
            {selectedFriendsList.length === 0 ? (
              <p className="text-xs text-[#6E5E65]">
                ยังไม่ได้เลือกเพื่อน สามารถสร้างกิจกรรมก่อนแล้วชวนเพิ่มทีหลังได้
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {selectedFriendsList.map((f) => (
                    <span
                      key={f.id}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFF9FA] border border-[#F0DCE3] text-[#261B20]"
                    >
                      {f.nickname}
                    </span>
                  ))}
                </div>

                {(dietaryAlertMessages.length > 0 || selectedWarnings.length > 0) && (
                  <div className="rounded-xl bg-[#FFF4E8] border border-[#F2CFA8] p-3 text-xs text-[#7D4B16] space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowDietaryDetails((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 font-bold text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        ข้อควรระวังเรื่องอาหาร/ฮาลาลในวงนี้ ({
                          selectedFriendsList.filter(
                            (f) => (f.dietaryWarnings?.length || 0) > 0 || f.dislikes.length > 0
                          ).length
                        } คน)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                        {showDietaryDetails ? "ซ่อน" : "เปิดดู"}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            showDietaryDetails ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </button>

                    {showDietaryDetails && (
                      <div className="space-y-2 pt-1.5 border-t border-[#F2CFA8]/70">
                        {dietaryAlertMessages.length > 0 && (
                          <ul className="space-y-1.5">
                            {dietaryAlertMessages.map((msg) => {
                              const isAllergy = msg.includes("แพ้อาหาร");
                              return (
                                <li key={msg} className="leading-relaxed flex items-start gap-1.5">
                                  {isAllergy ? (
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#9A332E]" />
                                  ) : (
                                    <Heart className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#993858]" />
                                  )}
                                  <span>{msg}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {selectedWarnings.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-[#FDF3F2] border border-[#EED2D0] text-[#9A332E]">
                            <span className="font-bold">ของแพ้/ไม่ชอบ:</span>{" "}
                            {selectedWarnings
                              .map(
                                (w) =>
                                  `${w.nickname} (${w.restriction_type === "allergy" ? "แพ้" : "ไม่ชอบ"} ${w.normalized_value})`
                              )
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#E8DFCB] text-[11px] text-[#75571A] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                ระบบจะสร้างการ์ดคำชวนเฉพาะบุคคลสำหรับเพื่อนแต่ละคน เพื่อส่งลิงก์ต่อในแชทได้เลย
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white font-semibold text-sm shadow-soft transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Link2 className="w-4 h-4" />
            {submitting
              ? "กำลังสร้างกิจกรรมและคำชวน..."
              : `ยืนยันสร้างกิจกรรมและคำชวน · ${selectedIds.length} คน`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewActivityPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-16 text-center text-sm text-[#6E666A]">กำลังโหลด</div>}>
        <NewActivityInner />
      </Suspense>
    </AppShell>
  );
}
