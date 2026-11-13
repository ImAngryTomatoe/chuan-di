"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Cake,
  CalendarHeart,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Heart,
  Link2,
  Lock,
  MessageSquareText,
  Phone,
  ShieldAlert,
  Trash2,
  Utensils,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { ConfirmModal } from "@/components/ConfirmModal";
import { MascotAvatar } from "@/components/MascotAvatar";
import { DetailSkeleton } from "@/components/Skeletons";
import { CATEGORY_META, CategorySlug, FriendRecord } from "@/lib/types";

interface InvitationHistItem {
  id: number;
  activity_id: number;
  activity_title: string;
  activity_category: string;
  activity_date: string;
  start_time: string;
  location: string;
  rsvp_status: string;
  decline_reason: string | null;
  response_note: string | null;
}

interface TraceItem {
  id: number;
  raw_value: string;
  normalized_value: string;
  category_slug: CategorySlug;
  confirmation_status: string;
  source_label: string;
  raw_text: string;
  created_at: string;
}

function FriendProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useApp();

  const [friend, setFriend] = useState<FriendRecord | null>(null);
  const [invitations, setInvitations] = useState<InvitationHistItem[]>([]);
  const [traceability, setTraceability] = useState<TraceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selfLink, setSelfLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/friends/${params.id}`, { cache: "no-store" });
      if (!res.ok) {
        setFriend(null);
        return;
      }
      const data = await res.json();
      setFriend(data.friend);
      setInvitations(data.invitationHistory || []);
      setTraceability(data.traceability || []);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/friends/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("ลบข้อมูลเพื่อนเรียบร้อยแล้ว");
        router.replace("/friends");
      } else {
        notify("ไม่สามารถลบข้อมูลได้", "error");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateUpdateLink() {
    if (!friend) return;
    const res = await fetch("/api/invitations/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `ลิงก์ให้ ${friend.nickname} อัปเดตข้อมูลความชอบด้วยตนเอง`,
        target_friend_name: friend.nickname,
        prefill_friend_id: friend.id,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const url = `${window.location.origin}/invite/${data.invitation.invite_token}`;
      setSelfLink(url);
      notify(`สร้างลิงก์สำหรับ ${friend.nickname} เรียบร้อยแล้ว`);
    }
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!friend) {
    return (
      <div className="py-16 text-center space-y-4">
        <MascotAvatar pose="curious" size="lg" className="mx-auto" />
        <p className="font-bold text-[#1F1A1C]">ไม่พบข้อมูลรายชื่อเพื่อนคนนี้</p>
        <Link href="/friends" className="text-sm font-semibold text-[#8F3553] underline">
          กลับสู่หน้ารายชื่อเพื่อน
        </Link>
      </div>
    );
  }

  const groupedByCat = Object.values(CATEGORY_META).map((meta) => ({
    meta,
    items: friend.interests.filter((i) => i.category_slug === meta.slug),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/friends"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#EAE6E8] text-sm font-semibold text-[#1F1A1C] hover:border-[#B3486B]"
        >
          <ArrowLeft className="w-4 h-4 text-[#6E666A]" />
          รายชื่อเพื่อน
        </Link>

        <div className="flex flex-wrap gap-2">
          {friend.linked_user_id ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E6F4EC] border border-[#BBE0C8] text-[#1F5E3B] text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              ซิงก์จากโปรไฟล์ที่เพื่อนกรอกเอง (อ่านอย่างเดียว)
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCreateUpdateLink}
                className="px-4 py-2 rounded-xl bg-white border border-[#EAE6E8] hover:border-[#B3486B] text-[#1F1A1C] text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-[#8F3553]" />
                ส่งลิงก์ให้เพื่อนเชื่อมบัญชีและกรอกเอง
              </button>
              <Link
                href={`/friends/${friend.id}/edit`}
                className="px-4 py-2 rounded-xl bg-white border border-[#EAE6E8] hover:border-[#B3486B] text-[#6E666A] text-sm font-semibold transition flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                แก้ไขข้อมูลตัวอย่าง
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#FDF3F2] hover:bg-[#A3322E] text-[#A3322E] hover:text-white border border-[#EED2D0] text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            ลบเพื่อน
          </button>
        </div>
      </div>

      {friend.linked_user_id && (
        <div className="bg-[#F6FBF8] rounded-2xl p-4 border border-[#CFE5D8] flex items-center gap-3 text-xs text-[#1F5E3B]">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            ข้อมูลความชอบและข้อจำกัดด้านอาหารของ <strong>{friend.nickname}</strong> ซิงก์อัตโนมัติจากบัญชี CHUAN-DI ของเพื่อน (
            {friend.linked_user_email || "เชื่อมต่อแล้ว"}) คุณไม่สามารถแก้ไขข้อมูลแทนเพื่อนได้ เพื่อรักษาข้อมูลที่ถูกต้องตรงจากเจ้าตัว
          </span>
        </div>
      )}

      {selfLink && (
        <div className="bg-white rounded-2xl p-4 border border-[#B3486B] shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#8F3553]">
              ลิงก์สำหรับให้ {friend.nickname} อัปเดตความชอบและข้อจำกัดด้านอาหารด้วยตนเอง
            </p>
            <p className="text-xs text-[#1F1A1C] truncate font-mono mt-0.5">{selfLink}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(selfLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </button>
            <a
              href={selfLink}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] text-xs font-semibold text-[#1F1A1C]"
            >
              เปิดหน้าแบบฟอร์ม
            </a>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl text-[#1F1A1C] shadow-xs"
            style={{ backgroundColor: friend.avatar_color }}
          >
            {friend.nickname.slice(0, 2)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1F1A1C]">{friend.nickname}</h1>
              {friend.religion && friend.religion !== "ไม่ระบุ" && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F2F3] text-[#4A4346] border border-[#EAE6E8]">
                  ศาสนา{friend.religion}
                </span>
              )}
            </div>
            <p className="text-sm text-[#6E666A]">{friend.full_name}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-[#6E666A]">
              {friend.birthday && (
                <span className="inline-flex items-center gap-1 bg-[#FAF9F8] border border-[#EAE6E8] px-2.5 py-1 rounded-full">
                  <Cake className="w-3.5 h-3.5 text-[#8F3553]" />
                  วันเกิด: {friend.birthday}
                </span>
              )}
              {friend.contact_info && (
                <span className="inline-flex items-center gap-1 bg-[#FAF9F8] border border-[#EAE6E8] px-2.5 py-1 rounded-full">
                  <Phone className="w-3.5 h-3.5 text-[#8F3553]" />
                  {friend.contact_info}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-[#6E666A] bg-[#FAF9F8] px-4 py-3 rounded-xl border border-[#EAE6E8]">
          <div>บันทึกเมื่อ: {friend.created_at.slice(0, 10)}</div>
          <div className="mt-0.5 font-semibold text-[#8F3553]">
            ข้อมูลความสนใจ: {friend.interests.length} รายการ
          </div>
        </div>
      </div>

      {/* Clear 4-Group Food & Dietary Summary */}
      {(() => {
        const allergies = friend.interests.filter(
          (i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy"
        );
        const dislikes = friend.interests.filter(
          (i) => i.category_slug === "disliked_food" && i.restriction_type !== "allergy"
        );
        const favFoods = friend.interests.filter((i) => i.category_slug === "food_preferences");
        const dietaryList = friend.dietary_restrictions || [];

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Favorite Foods */}
            <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#8F2849] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[#F47FA5]" />
                  <span>อาหารที่ชอบ</span>
                </h2>
                <span className="text-[11px] text-[#6E5E65]">{favFoods.length} รายการ</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {favFoods.length === 0 ? (
                  <span className="text-xs text-[#6E5E65]">ยังไม่มีข้อมูลอาหารที่ชอบ</span>
                ) : (
                  favFoods.map((item) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF0F5] text-[#8F2849] border border-[#F5C2D3]"
                    >
                      {item.normalized_value}
                    </span>
                  ))
                )}
              </div>
              {friend.can_eat && (
                <p className="text-xs text-[#2A6049] bg-[#F4F7F5] border border-[#D4E6DC] px-3 py-2 rounded-xl">
                  <span className="font-semibold">ทานได้:</span> {friend.can_eat}
                </p>
              )}
            </div>

            {/* 4. Dietary Restrictions */}
            <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#276348] flex items-center gap-1.5">
                  <Utensils className="w-4 h-4" />
                  <span>ข้อจำกัดด้านอาหาร</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF3F6] text-[#6E5E65] border border-[#F0DCE3]">
                  ศาสนา: {friend.religion || "ไม่ระบุ"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dietaryList.length === 0 ? (
                  <span className="text-xs text-[#6E5E65]">ไม่มีข้อจำกัดด้านอาหารที่ระบุ</span>
                ) : (
                  dietaryList.map((d) => (
                    <span
                      key={d.id}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        d.restriction_category === "halal" || d.restriction_category === "religious_or_cultural"
                          ? "bg-[#E6F4EC] text-[#1F5E3B] border-[#BBE0C8]"
                          : d.restriction_category === "allergy"
                          ? "bg-[#FCE8E6] text-[#9A332E] border-[#EED2D0]"
                          : "bg-[#FFE4EC] text-[#8F2849] border-[#F5C2D3]"
                      }`}
                    >
                      {d.restriction_label}
                    </span>
                  ))
                )}
              </div>
              {friend.cannot_eat && (
                <p className="text-xs text-[#9A332E] bg-[#FDF3F2] border border-[#EED2D0] px-3 py-2 rounded-xl">
                  <span className="font-semibold">เลี่ยง:</span> {friend.cannot_eat}
                </p>
              )}
            </div>

            {/* 2. Disliked Foods */}
            <div className="bg-white rounded-2xl p-5 border border-[#F4E6EB] shadow-card space-y-2.5">
              <h2 className="text-xs font-bold text-[#75571A] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#9D8866]" />
                <span>อาหารที่ไม่ชอบ</span>
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {dislikes.length === 0 ? (
                  <span className="text-xs text-[#6E5E65]">ยังไม่มีอาหารที่ไม่ชอบ</span>
                ) : (
                  dislikes.map((item) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]"
                    >
                      ไม่ชอบ {item.normalized_value}
                    </span>
                  ))
                )}
              </div>
              {friend.personal_notes && (
                <p className="text-xs text-[#4A3B41] bg-[#FFF9FA] border border-[#F4E6EB] px-3 py-2 rounded-xl mt-2">
                  {friend.personal_notes}
                </p>
              )}
            </div>

            {/* 3. Allergies */}
            <div className="bg-white rounded-2xl p-5 border border-[#EED2D0] shadow-card space-y-2.5">
              <h2 className="text-xs font-bold text-[#9A332E] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>อาหารที่แพ้</span>
              </h2>
              <div className="bg-[#FDF3F2] border border-[#EED2D0] px-3 py-2.5 rounded-xl flex flex-wrap items-center gap-1.5">
                {allergies.length === 0 ? (
                  <span className="text-xs text-[#6E5E65]">ไม่มีข้อมูลอาหารที่แพ้</span>
                ) : (
                  allergies.map((item) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#B53D37] text-white"
                    >
                      แพ้ {item.normalized_value}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="bg-white rounded-2xl p-6 border border-[#F4E6EB] shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#261B20]">ความชอบของเพื่อนแยกตามหมวดหมู่ความสนใจ</h2>
          <Link
            href={`/friends/${friend.id}/edit`}
            className="text-xs font-semibold text-[#A34263] hover:underline"
          >
            + เพิ่มหรือแก้ไขความชอบ
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedByCat.map(({ meta, items }) => (
            <div
              key={meta.slug}
              className="p-4 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#261B20]">
                  {meta.slug === "disliked_food" ? "อาหารที่ไม่ชอบและอาหารที่แพ้" : meta.name_th}
                </span>
                <span className="text-[11px] text-[#6E5E65]">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-[#9E9599]">ยังไม่มีข้อมูลในหมวดหมู่ดังกล่าว</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <span
                      key={item.id}
                      title={`คำเดิม: ${item.raw_value} | ที่มา: ${item.source}`}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                    >
                      {item.category_slug === "disliked_food" && item.restriction_type === "allergy" && (
                        <span className="mr-1 px-1.5 py-0.5 rounded-full bg-[#B53D37] text-white text-[10px]">
                          แพ้
                        </span>
                      )}
                      {item.normalized_value}
                      {item.raw_value !== item.normalized_value && (
                        <span className="opacity-70 text-[10px] ml-1.5">· {item.raw_value}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-[#F4E6EB] shadow-card space-y-4">
          <h2 className="font-bold text-[#261B20] flex items-center gap-2">
            <CalendarHeart className="w-5 h-5 text-[#F47FA5]" />
            คำชวนไปทำกิจกรรมและสถานะ · {invitations.length} รายการ
          </h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-[#6E5E65] bg-[#FFF9FA] border border-[#F4E6EB] p-4 rounded-xl">
              ยังไม่มีประวัติคำชวนไปทำกิจกรรม
            </p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/activities/${inv.activity_id}`}
                  className="block p-3.5 rounded-xl bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F4E6EB] transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#261B20]">{inv.activity_title}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        inv.rsvp_status === "going"
                          ? "bg-[#F1F6F3] text-[#2A6049]"
                          : inv.rsvp_status === "not_going"
                          ? "bg-[#FDF3F2] text-[#9A332E]"
                          : "bg-[#FAF7F0] text-[#75571A]"
                      }`}
                    >
                      {inv.rsvp_status === "going"
                        ? "ไปด้วย"
                        : inv.rsvp_status === "not_going"
                        ? `ไปไม่ได้ · ${inv.decline_reason || "ไม่ระบุ"}`
                        : "ยังไม่ตอบ"}
                    </span>
                  </div>
                  <div className="text-xs text-[#6E5E65] mt-1">
                    {inv.activity_date} • {inv.start_time} น. • {inv.location}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#F4E6EB] shadow-card space-y-4">
          <h2 className="font-bold text-[#261B20] flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-[#6E5E65]" />
            ประวัติการเล่าเรื่องเพื่อนและแหล่งที่มา
          </h2>
          {traceability.length === 0 ? (
            <p className="text-sm text-[#6E666A] bg-[#FAF9F8] border border-[#EAE6E8] p-4 rounded-xl">
              ข้อมูลความชอบของเพื่อนรายนี้บันทึกด้วยตนเองหรือมาจากชุดข้อมูลตั้งต้น
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {traceability.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3.5 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1F1A1C]">
                      &ldquo;{tr.raw_value}&rdquo; → {tr.normalized_value}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F6F3] text-[#2A6049] font-medium">
                      {tr.confirmation_status}
                    </span>
                  </div>
                  <p className="text-[#6E666A] line-clamp-2">จากข้อความ: {tr.raw_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title={`ลบข้อมูลของ ${friend.nickname}?`}
        message="การลบจะนำรายชื่อและประวัติความชอบของเพื่อนคนนี้ออกจากฐานข้อมูลอย่างถาวร"
        confirmLabel="ยืนยันการลบ"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function FriendProfilePage() {
  return (
    <AppShell>
      <FriendProfileContent />
    </AppShell>
  );
}
