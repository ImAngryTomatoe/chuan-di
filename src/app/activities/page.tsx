"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarHeart, Clock, MapPin, Plus, Search, UserCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CardGridSkeleton } from "@/components/Skeletons";

interface ActivityRow {
  id: number;
  title: string;
  description: string;
  category: string;
  activity_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  organizer_name: string;
  target_interests_json: string;
  status: string;
  total_invited: number;
  going_count: number;
  not_going_count: number;
  pending_count: number;
}

const CATEGORIES = [
  "อาหารและสังสรรค์",
  "คาเฟ่และไลฟ์สไตล์",
  "ท่องเที่ยว",
  "งานอดิเรกและเกม",
  "ภาพยนตร์และบันเทิง",
  "ออกกำลังกาย",
  "อื่น ๆ",
];

function ActivitiesListContent() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQ.trim()) params.set("q", searchQ.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setActivities(d.activities || []);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQ, categoryFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(loadActivities, 180);
    return () => clearTimeout(t);
  }, [loadActivities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#261B20]">กิจกรรมและคำชวน</h1>
          <p className="text-sm text-[#6E5E65] mt-0.5">
            สร้างกิจกรรม เลือกเพื่อนที่น่าชวนตามความชอบและข้อจำกัดด้านอาหาร พร้อมดูสถานะตอบรับคำชวน
          </p>
        </div>
        <Link
          href="/activities/new"
          className="px-5 py-2.5 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white text-sm font-semibold shadow-soft transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          สร้างกิจกรรมใหม่
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#EAE6E8] shadow-card grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-6">
          <Search className="w-4 h-4 text-[#6E666A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="ค้นหากิจกรรม"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="ค้นหาชื่อกิจกรรม สถานที่ หรือหัวข้อ เช่น หมูกระทะ อารีย์"
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-sm text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]"
          />
        </div>
        <select
          aria-label="กรองตามหมวดหมู่กิจกรรม"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sm:col-span-3 px-3.5 py-2 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-sm font-medium text-[#1F1A1C]"
        >
          <option value="">ทุกหมวดหมู่</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="กรองตามสถานะกิจกรรม"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:col-span-3 px-3.5 py-2 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-sm font-medium text-[#1F1A1C]"
        >
          <option value="all">ทุกสถานะ</option>
          <option value="upcoming">กำลังจะมาถึง</option>
          <option value="completed">เสร็จสิ้นแล้ว</option>
          <option value="cancelled">ยกเลิกแล้ว</option>
        </select>
      </div>

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#EAE6E8] text-center space-y-4">
          <MascotAvatar
            pose={searchQ || categoryFilter || statusFilter !== "all" ? "curious" : "sleepy"}
            size="lg"
            className="mx-auto"
          />
          <h3 className="font-bold text-lg text-[#1F1A1C]">
            {searchQ || categoryFilter || statusFilter !== "all"
              ? "ไม่พบกิจกรรมตามเงื่อนไขที่เลือก"
              : "ยังไม่มีรายการกิจกรรมในระบบ"}
          </h3>
          <p className="text-sm text-[#6E666A]">
            ท่านสามารถสร้างกิจกรรมใหม่เพื่อคัดเลือกเพื่อนที่เหมาะสมและส่งคำเชิญได้ทันที
          </p>
          <Link
            href="/activities/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            สร้างกิจกรรมใหม่
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activities.map((act) => {
            let tags: string[] = [];
            try {
              tags = JSON.parse(act.target_interests_json || "[]");
            } catch {
              tags = [];
            }
            const total = act.total_invited || 0;
            const goingPct = total > 0 ? Math.round((act.going_count / total) * 100) : 0;
            const responseRate =
              total > 0 ? Math.round(((act.going_count + act.not_going_count) / total) * 100) : 0;

            return (
              <Link
                key={act.id}
                href={`/activities/${act.id}`}
                className="bg-white rounded-2xl p-5 border border-[#EAE6E8] hover:border-[#B3486B] shadow-card hover:shadow-soft transition flex flex-col justify-between gap-3.5 cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F9F2F5] text-[#8F3553] border border-[#E8D5DD]">
                          {act.category}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF9F8] border border-[#EAE6E8] text-[#4A4346]">
                          <UserCheck className="w-2.5 h-2.5" />
                          {act.organizer_name}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-[#1F1A1C] truncate">{act.title}</h2>
                    </div>
                    <CalendarHeart className="w-5 h-5 text-[#B3486B] shrink-0" />
                  </div>

                  <div className="space-y-1 text-xs text-[#6E666A] bg-[#FAF9F8] p-3 rounded-xl border border-[#EAE6E8]">
                    <div className="flex items-center gap-2 font-semibold text-[#1F1A1C]">
                      <Clock className="w-3.5 h-3.5 text-[#8F3553] shrink-0" />
                      <span className="truncate">
                        {act.activity_date} • {act.start_time}
                        {act.end_time ? `-${act.end_time}` : ""} น.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#8F3553] shrink-0" />
                      <span className="truncate">{act.location}</span>
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F4F2F3] text-[#4A4346] border border-[#EAE6E8]"
                        >
                          {t}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-[#6E666A] font-medium px-1">
                          +{tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* RSVP Progress */}
                <div className="space-y-1.5 pt-2 border-t border-[#F0ECEE]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-[#1F1A1C]">
                      <Users className="w-3.5 h-3.5 text-[#8F3553]" />
                      {total} คน ({responseRate}%)
                    </span>
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      <span className="text-[#2A6049]">ไป {act.going_count}</span>
                      <span className="text-[#9A332E]">ไม่ไป {act.not_going_count}</span>
                      <span className="text-[#75571A]">รอ {act.pending_count}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#EFECEF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2A6049] rounded-full"
                      style={{ width: `${goingPct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActivitiesPage() {
  return (
    <AppShell>
      <ActivitiesListContent />
    </AppShell>
  );
}
