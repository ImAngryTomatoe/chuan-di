"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Info,
  MapPin,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { ConfirmModal } from "@/components/ConfirmModal";
import { MascotAvatar } from "@/components/MascotAvatar";
import { DetailSkeleton } from "@/components/Skeletons";
import { DECLINE_REASONS } from "@/lib/types";

interface InvitationRow {
  id: number;
  friend_id: number;
  full_name: string;
  nickname: string;
  avatar_color: string;
  rsvp_status: "going" | "not_going" | "pending";
  decline_reason: string | null;
  response_note: string | null;
  invite_token: string;
  last_opened_at: string | null;
  responded_at: string | null;
  matchedLikes: string[];
  dislikes: string[];
  dislikeDetails?: Array<{ normalized_value: string; restriction_type: "allergy" | "dislike" | null }>;
  recommendationReason?: string;
}

interface UninvitedFriend {
  id: number;
  nickname: string;
  full_name: string;
  matchedLikes: string[];
  dislikes: string[];
  recommendationReason: string;
}

interface ActivityDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  activity_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  organizer_name: string;
  target_interests: string[];
  status: string;
}

interface ActivityStats {
  totalInvited: number;
  going: number;
  notGoing: number;
  pending: number;
  responseRate: number;
  goingNames: string[];
  notGoingNames: Array<{ nickname: string; reason: string; note: string | null }>;
  pendingNames: string[];
}

function ActivityDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useApp();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [uninvited, setUninvited] = useState<UninvitedFriend[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedAddIds, setSelectedAddIds] = useState<number[]>([]);
  const [showUninvited, setShowUninvited] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities/${params.id}`, { cache: "no-store" });
      if (!res.ok) {
        setActivity(null);
        return;
      }
      const data = await res.json();
      setActivity(data.activity);
      setStats(data.stats);
      setInvitations(data.invitations || []);
      setUninvited(data.recommendedUninvited || []);
      setEditTitle(data.activity.title);
      setEditCategory(data.activity.category);
      setEditDate(data.activity.activity_date);
      setEditStart(data.activity.start_time);
      setEditEnd(data.activity.end_time || "");
      setEditLocation(data.activity.location);
      setEditDesc(data.activity.description || "");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editEnd && editEnd <= editStart) {
      notify("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น", "error");
      return;
    }
    const res = await fetch(`/api/activities/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        category: editCategory,
        activity_date: editDate,
        start_time: editStart,
        end_time: editEnd || null,
        location: editLocation,
        description: editDesc,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      notify("อัปเดตรายละเอียดกิจกรรมแล้ว");
      setEditing(false);
      loadDetail();
    } else {
      notify(data.error || "ไม่สามารถแก้ไขกิจกรรมได้", "error");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/activities/${params.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      notify("ลบกิจกรรมเรียบร้อยแล้ว");
      router.replace("/activities");
    }
  }

  async function handleQuickRsvp(
    invId: number,
    status: "going" | "not_going" | "pending",
    reason?: string
  ) {
    const res = await fetch(`/api/invitations/activity/${invId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsvp_status: status, decline_reason: reason }),
    });
    if (res.ok) {
      notify("อัปเดตสถานะตอบรับเรียบร้อยแล้ว");
      loadDetail();
    }
  }

  async function handleInviteMore() {
    if (selectedAddIds.length === 0) return;
    const res = await fetch(`/api/activities/${params.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendIds: selectedAddIds }),
    });
    if (res.ok) {
      notify(`สร้างลิงก์เชิญเพิ่มเติม ${selectedAddIds.length} รายการเรียบร้อยแล้ว`);
      setSelectedAddIds([]);
      loadDetail();
    }
  }


  if (loading) {
    return <DetailSkeleton />;
  }

  if (!activity || !stats) {
    return (
      <div className="py-16 text-center space-y-3">
        <MascotAvatar pose="curious" size="lg" className="mx-auto" />
        <p className="font-bold text-[#1F1A1C]">ไม่พบข้อมูลกิจกรรมดังกล่าว</p>
        <Link href="/activities" className="text-sm font-semibold text-[#8F3553] underline">
          กลับสู่หน้ารวมกิจกรรม
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/activities"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#EAE6E8] text-sm font-semibold text-[#1F1A1C] hover:border-[#B3486B]"
        >
          <ArrowLeft className="w-4 h-4 text-[#6E666A]" />
          กิจกรรมทั้งหมด
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const shareText = `ขอเชิญเข้าร่วมกิจกรรม: ${activity.title}\nผู้จัด: ${activity.organizer_name}\nวันที่: ${activity.activity_date}\nเวลา: ${activity.start_time}${
                activity.end_time ? ` - ${activity.end_time}` : ""
              } น.\nสถานที่: ${activity.location}${
                activity.description ? `\nรายละเอียด: ${activity.description}` : ""
              }`;
              navigator.clipboard.writeText(shareText);
              notify("คัดลอกรายละเอียดการนัดหมายเรียบร้อยแล้ว");
            }}
            className="px-4 py-2 rounded-xl bg-white border border-[#EAE6E8] hover:border-[#B3486B] text-[#1F1A1C] text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Copy className="w-4 h-4 text-[#6E666A]" />
            คัดลอกรายละเอียดนัดหมาย
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {editing ? "ยกเลิกการแก้ไข" : "แก้ไขกิจกรรม"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] text-[#A3322E] hover:bg-[#A3322E] hover:text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            ลบกิจกรรม
          </button>
        </div>
      </div>

      {/* Activity Hero */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm font-semibold text-[#1F1A1C]"
                placeholder="ชื่อกิจกรรม"
              />
              <input
                type="text"
                required
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
                placeholder="สถานที่"
              />
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  required
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
                />
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
                />
              </div>
            </div>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold cursor-pointer"
            >
              บันทึกการเปลี่ยนแปลง
            </button>
          </form>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F9F2F5] text-[#8F3553] border border-[#E8D5DD]">
                  {activity.category}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F8] border border-[#EAE6E8] text-[#4A4346]">
                  <UserCheck className="w-3.5 h-3.5 text-[#8F3553]" />
                  ผู้จัด: {activity.organizer_name}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#1F1A1C]">{activity.title}</h1>
              {activity.description && (
                <p className="text-sm text-[#6E666A]">{activity.description}</p>
              )}
              <div className="flex flex-wrap gap-4 pt-1 text-sm text-[#1F1A1C] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#8F3553]" />
                  {activity.activity_date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#8F3553]" />
                  {activity.start_time}
                  {activity.end_time ? ` - ${activity.end_time}` : ""} น.
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#8F3553]" />
                  {activity.location}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[#FFF9FA] p-4 rounded-2xl border border-[#F4E6EB] shrink-0">
              <MascotAvatar pose="love" size="sm" />
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-[#261B20] tabular-nums">
                    {stats.totalInvited}
                  </div>
                  <div className="text-[10px] text-[#6E5E65]">ชวนทั้งหมด</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#2A6049] tabular-nums">
                    {stats.going}
                  </div>
                  <div className="text-[10px] text-[#2A6049]">ไปด้วย</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#9A332E] tabular-nums">
                    {stats.notGoing}
                  </div>
                  <div className="text-[10px] text-[#9A332E]">ไปไม่ได้</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#75571A] tabular-nums">
                    {stats.pending}
                  </div>
                  <div className="text-[10px] text-[#75571A]">ยังไม่ตอบ</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#A34263] tabular-nums">
                    {stats.responseRate}%
                  </div>
                  <div className="text-[10px] text-[#A34263]">ตอบรับแล้ว</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invitation Dashboard Breakdown: Names Under Each Status */}
      {invitations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#D4E3DA] space-y-2">
            <div className="text-xs font-bold text-[#2A6049]">
              ไปด้วย · {stats.going} คน
            </div>
            {stats.goingNames.length === 0 ? (
              <p className="text-xs text-[#6E5E65]">ยังไม่มีเพื่อนตอบรับไปด้วย</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.goingNames.map((name) => (
                  <span
                    key={name}
                    className="px-2.5 py-0.5 rounded-full bg-[#F1F6F3] text-[#2A6049] text-xs font-semibold border border-[#D4E3DA]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#EED2D0] space-y-2">
            <div className="text-xs font-bold text-[#9A332E]">
              ไปไม่ได้ · {stats.notGoing} คน
            </div>
            {stats.notGoingNames.length === 0 ? (
              <p className="text-xs text-[#6E5E65]">ยังไม่มีเพื่อนแจ้งว่าไปไม่ได้</p>
            ) : (
              <div className="space-y-1">
                {stats.notGoingNames.map((entry) => (
                  <div key={entry.nickname} className="text-xs text-[#9A332E]">
                    <span className="font-semibold">{entry.nickname}</span>: {entry.reason}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E8DFCB] space-y-2">
            <div className="text-xs font-bold text-[#75571A]">
              ยังไม่ตอบ · {stats.pending} คน
            </div>
            {stats.pendingNames.length === 0 ? (
              <p className="text-xs text-[#2A6049]">ตอบรับครบถ้วนทุกคนแล้ว</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.pendingNames.map((name) => (
                  <span
                    key={name}
                    className="px-2.5 py-0.5 rounded-full bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB] text-xs font-medium"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invited Friends & Individual Generated Links */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg text-[#1F1A1C]">
              ลิงก์เชิญเฉพาะบุคคลและรายชื่อผู้ได้รับเชิญ · {invitations.length} คน
            </h2>
            <p className="text-xs text-[#6E666A]">
              แต่ละลิงก์ผูกกับเพื่อน 1 รายชื่อ สามารถคัดลอกส่งเพื่อตอบรับเข้าร่วมได้ทันที
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#E8DFCB] text-xs text-[#75571A] flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            สถานะลิงก์: ระบบจัดทำลิงก์คำเชิญเฉพาะบุคคลไว้เรียบร้อยแล้ว กรุณาคัดลอกลิงก์ของแต่ละรายชื่อเพื่อส่งให้เพื่อนด้วยตนเอง
          </span>
        </div>

        {invitations.length === 0 ? (
          <p className="text-sm text-[#6E666A] bg-[#FAF9F8] border border-[#EAE6E8] p-6 rounded-xl text-center">
            ยังไม่มีรายชื่อเพื่อนที่สร้างลิงก์เชิญในกิจกรรมนี้ สามารถเลือกรายชื่อแนะนำด้านล่างได้
          </p>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => {
              const rsvpUrl =
                typeof window !== "undefined"
                  ? `${window.location.origin}/rsvp/${inv.invite_token}`
                  : `/rsvp/${inv.invite_token}`;

              const linkDeliveryBadge =
                inv.responded_at
                  ? { label: "ตอบรับผ่านลิงก์แล้ว", cls: "bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]" }
                  : inv.last_opened_at
                  ? { label: "เปิดดูลิงก์แล้ว", cls: "bg-[#F4F2F3] text-[#4A4346] border border-[#EAE6E8]" }
                  : { label: "สร้างลิงก์แล้ว · รอจัดส่ง", cls: "bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]" };

              return (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/friends/${inv.friend_id}`}
                        className="font-bold text-sm text-[#1F1A1C] hover:text-[#8F3553]"
                      >
                        {inv.nickname} · {inv.full_name}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${linkDeliveryBadge.cls}`}>
                        {linkDeliveryBadge.label}
                      </span>
                      {inv.matchedLikes.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]"
                        >
                          ชอบ {tag}
                        </span>
                      ))}
                      {inv.dislikes.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDF3F2] text-[#A3322E] border border-[#EED2D0]">
                          <AlertCircle className="w-3 h-3" />
                          ไม่ชอบหรือแพ้: {inv.dislikes.join(", ")}
                        </span>
                      )}
                    </div>

                    {inv.rsvp_status === "not_going" && (
                      <p className="text-xs text-[#A3322E] font-medium">
                        เหตุผลที่ไม่สะดวก: {inv.decline_reason || "ไม่ระบุ"}
                        {inv.response_note ? ` — "${inv.response_note}"` : ""}
                      </p>
                    )}
                    {inv.rsvp_status === "going" && inv.response_note && (
                      <p className="text-xs text-[#2A6049]">ข้อความเพิ่มเติม: &ldquo;{inv.response_note}&rdquo;</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQuickRsvp(inv.id, "going")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        inv.rsvp_status === "going"
                          ? "bg-[#2A6049] text-white border-[#2A6049]"
                          : "bg-white text-[#2A6049] border-[#D4E3DA]"
                      }`}
                    >
                      เข้าร่วม
                    </button>

                    <select
                      aria-label={`เหตุผลไม่สะดวกของ ${inv.nickname}`}
                      value={inv.rsvp_status === "not_going" ? inv.decline_reason || "ไม่ว่าง" : ""}
                      onChange={(e) => {
                        if (e.target.value) handleQuickRsvp(inv.id, "not_going", e.target.value);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        inv.rsvp_status === "not_going"
                          ? "bg-[#A3322E] text-white border-[#A3322E]"
                          : "bg-white text-[#A3322E] border-[#EED2D0]"
                      }`}
                    >
                      <option value="">ไม่สะดวก · เลือกเหตุผล</option>
                      {DECLINE_REASONS.map((r) => (
                        <option key={r} value={r} className="text-[#1F1A1C] bg-white">
                          ไม่สะดวก: {r}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                        onClick={() => {
                        navigator.clipboard.writeText(rsvpUrl);
                        setCopiedId(inv.id);
                        notify(`คัดลอกลิงก์เชิญสำหรับ ${inv.nickname} เรียบร้อยแล้ว`);
                        setTimeout(() => setCopiedId(null), 1800);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E8] text-xs font-semibold text-[#1F1A1C] hover:border-[#B3486B] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === inv.id ? (
                        <Check className="w-3.5 h-3.5 text-[#2A6049]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#6E666A]" />
                      )}
                      {copiedId === inv.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์ RSVP"}
                    </button>

                    <a
                      href={`/rsvp/${inv.invite_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-xl bg-[#F4F2F3] text-[#1F1A1C] hover:bg-[#B3486B] hover:text-white transition"
                      title="เปิดหน้าตอบรับของเพื่อนรายนี้"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Additional Friends (Collapsible Dropdown so detail page stays clean) */}
      {uninvited.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowUninvited((v) => !v)}
              aria-expanded={showUninvited || invitations.length === 0}
              className="flex items-center gap-2 font-bold text-sm sm:text-base text-[#1F1A1C] hover:text-[#993858] cursor-pointer"
            >
              <UserPlus className="w-5 h-5 text-[#B3486B]" />
              <span>ชวนเพื่อนเพิ่มเติมที่ยังไม่ได้เชิญ ({uninvited.length} คน)</span>
              <ChevronDown
                className={`w-4 h-4 text-[#6E5E65] transition-transform ${
                  showUninvited || invitations.length === 0 ? "rotate-180" : ""
                }`}
              />
            </button>
            {selectedAddIds.length > 0 && (
              <button
                type="button"
                onClick={handleInviteMore}
                className="px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                สร้างลิงก์เชิญเพิ่มเติม · {selectedAddIds.length} คน
              </button>
            )}
          </div>

          {(showUninvited || invitations.length === 0) && (
            <div className="space-y-3 pt-1">
              {invitations.length + selectedAddIds.length > 10 && (
                <div className="px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#EAE0C8] text-xs text-[#75571A]">
                  รวมผู้ได้รับเชิญจะเป็น{" "}
                  <strong>{invitations.length + selectedAddIds.length} คน</strong> — ปกติวงเพื่อน 4–10 คนกำลังลงตัวและจองโต๊ะง่ายที่สุดนะ
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {uninvited.slice(0, 9).map((u) => {
                  const checked = selectedAddIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setSelectedAddIds((prev) =>
                          prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                        )
                      }
                      className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                        checked
                          ? "bg-[#F9F2F5] border-[#B3486B]"
                          : "bg-[#FAF9F8] border-[#EAE6E8] hover:border-[#D5C9CE]"
                      }`}
                    >
                      <div className="font-bold text-[#1F1A1C] flex items-center justify-between">
                        <span>{u.nickname}</span>
                        {u.matchedLikes.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]">
                            ตรง {u.matchedLikes.join(", ")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6E666A] mt-1 line-clamp-1">
                        {u.recommendationReason}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        title={`ลบกิจกรรม "${activity.title}"?`}
        message="คำเชิญและการตอบรับทั้งหมดในกิจกรรมนี้จะถูกลบออกจากระบบ"
        confirmLabel="ยืนยันลบกิจกรรม"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function ActivityDetailPage() {
  return (
    <AppShell>
      <ActivityDetailContent />
    </AppShell>
  );
}
