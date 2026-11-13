"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  Link2,
  MailCheck,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CardGridSkeleton } from "@/components/Skeletons";
import { DECLINE_REASONS } from "@/lib/types";

interface InvitationsPayload {
  stats: {
    total: number;
    going: number;
    notGoing: number;
    pending: number;
    responseRate: number;
  };
  activityInvitations: Array<{
    id: number;
    activity_id: number;
    friend_id: number;
    rsvp_status: "going" | "not_going" | "pending";
    decline_reason: string | null;
    response_note: string | null;
    invite_token: string;
    last_opened_at: string | null;
    responded_at: string | null;
    activity_title: string;
    activity_date: string;
    start_time: string;
    end_time: string | null;
    location: string;
    full_name: string;
    nickname: string;
  }>;
  registrationInvitations: Array<{
    id: number;
    invite_token: string;
    label: string;
    target_friend_name: string | null;
    status: string;
    accepted_nickname: string | null;
    created_at: string;
  }>;
  friendsList: Array<{
    id: number;
    nickname: string;
    full_name: string;
  }>;
}

function InvitationsInner() {
  const searchParams = useSearchParams();
  const { notify } = useApp();

  const initialTab = searchParams.get("tab") === "onboarding" ? "onboarding" : "activity";
  const initialStatus = searchParams.get("status") || "all";

  const [tab, setTab] = useState<"activity" | "onboarding">(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [data, setData] = useState<InvitationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string>("");

  // Create onboarding link form
  const [newLabel, setNewLabel] = useState("ลิงก์ชวนเพื่อนเข้าร่วม CHUAN-DI");
  const [targetName, setTargetName] = useState("");
  const [prefillFriendId, setPrefillFriendId] = useState<string>("");
  const [creatingLink, setCreatingLink] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpdateRsvp(
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
      notify("อัปเดตสถานะ RSVP เรียบร้อย");
      loadData();
    }
  }

  async function handleCreateOnboardingLink(e: React.FormEvent) {
    e.preventDefault();
    setCreatingLink(true);
    try {
      const res = await fetch("/api/invitations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim() || "ลิงก์ชวนเพื่อนเข้า CHUAN-DI",
          target_friend_name: targetName.trim() || null,
          prefill_friend_id: prefillFriendId ? Number(prefillFriendId) : null,
        }),
      });
      if (res.ok) {
        notify("สร้างลิงก์เชิญเพื่อนเรียบร้อยแล้ว กรุณาคัดลอกลิงก์เพื่อจัดส่งด้วยตนเอง");
        setTargetName("");
        setPrefillFriendId("");
        loadData();
      }
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleDeleteOnboarding(id: number) {
    const res = await fetch(`/api/invitations/register?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      notify("ลบลิงก์เชิญเรียบร้อยแล้ว");
      loadData();
    }
  }

  function copyPath(path: string, key: string) {
    const full = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(full);
    setCopiedToken(key);
    notify("คัดลอกลิงก์เรียบร้อยแล้ว");
    setTimeout(() => setCopiedToken(""), 2000);
  }

  if (loading || !data) {
    return <CardGridSkeleton count={4} />;
  }

  const declineReasonsMap = new Map<string, number>();
  for (const inv of data.activityInvitations) {
    if (inv.rsvp_status === "not_going") {
      const r = inv.decline_reason || "ไม่ระบุ";
      declineReasonsMap.set(r, (declineReasonsMap.get(r) || 0) + 1);
    }
  }
  const declineBreakdown = Array.from(declineReasonsMap.entries()).sort((a, b) => b[1] - a[1]);

  const filteredInvites = data.activityInvitations.filter((inv) =>
    statusFilter === "all" ? true : inv.rsvp_status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#261B20]">คำชวนและการตอบรับ</h1>
          <p className="text-xs text-[#6E5E65] mt-0.5">
            เช็กสถานะตอบรับและลิงก์เชิญเพื่อน
          </p>
        </div>

        <div className="inline-flex bg-white p-1.5 rounded-2xl border border-[#F4E6EB]">
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              tab === "activity" ? "bg-[#F47FA5] text-white" : "text-[#4A3B41] hover:bg-[#FFF9FA]"
            }`}
          >
            <MailCheck className="w-3.5 h-3.5" />
            คำชวนไปทำกิจกรรม · {data.stats.total}
          </button>
          <button
            type="button"
            onClick={() => setTab("onboarding")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              tab === "onboarding" ? "bg-[#F47FA5] text-white" : "text-[#4A3B41] hover:bg-[#FFF9FA]"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            ลิงก์ชวนเพื่อนกรอกข้อมูล · {data.registrationInvitations.length}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-[#F4E6EB] shadow-xs">
          <div className="text-xs text-[#6E5E65]">คำชวนทั้งหมด</div>
          <div className="text-2xl font-bold text-[#261B20] mt-1 tabular-nums">
            {data.stats.total}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#D4E3DA] shadow-xs">
          <div className="text-xs text-[#2A6049]">ไปด้วย</div>
          <div className="text-2xl font-bold text-[#2A6049] mt-1 tabular-nums">
            {data.stats.going}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#EED2D0] shadow-xs">
          <div className="text-xs text-[#9A332E]">ไปไม่ได้</div>
          <div className="text-2xl font-bold text-[#9A332E] mt-1 tabular-nums">
            {data.stats.notGoing}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E8DFCB] shadow-xs">
          <div className="text-xs text-[#75571A]">ยังไม่ตอบ</div>
          <div className="text-2xl font-bold text-[#75571A] mt-1 tabular-nums">
            {data.stats.pending}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#F4E6EB] shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-[#6E5E65]">อัตราตอบรับคำชวน</div>
          <div className="text-2xl font-bold text-[#A34263] mt-1 tabular-nums">
            {data.stats.responseRate}%
          </div>
        </div>
      </div>

      {tab === "activity" ? (
        <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
          <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#E8DFCB] text-xs text-[#75571A] flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              คำเชิญทุกรายการเป็นลิงก์เฉพาะบุคคลที่จัดทำไว้ให้แล้ว กรุณาคัดลอกลิงก์เพื่อจัดส่งให้เพื่อนด้วยตนเอง
            </span>
          </div>

          {declineBreakdown.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#A3322E]">สรุปเหตุผลที่ไม่สะดวกเข้าร่วม:</span>
              {declineBreakdown.map(([reason, count]) => (
                <span
                  key={reason}
                  className="px-2.5 py-1 rounded-full bg-white border border-[#EED2D0] font-medium text-[#A3322E]"
                >
                  {reason} · {count} คน
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-[#261B20]">ติดตามคำชวนไปทำกิจกรรมและการตอบรับคำชวน</h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: "all", label: "ทั้งหมด" },
                { k: "going", label: "ไปด้วย" },
                { k: "not_going", label: "ไปไม่ได้" },
                { k: "pending", label: "ยังไม่ตอบ" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setStatusFilter(opt.k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    statusFilter === opt.k
                      ? "bg-[#F47FA5] text-white border-[#F47FA5]"
                      : "bg-[#FFF9FA] text-[#4A3B41] border-[#F0DCE3]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredInvites.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MascotAvatar pose="love" size="md" className="mx-auto" />
              <p className="text-sm text-[#6E5E65]">ไม่มีรายการคำชวนในตัวกรองที่เลือก</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB] flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/friends/${inv.friend_id}`}
                        className="font-bold text-sm text-[#261B20] hover:text-[#A34263]"
                      >
                        {inv.nickname}
                      </Link>
                      <span className="text-xs text-[#6E5E65]">→</span>
                      <Link
                        href={`/activities/${inv.activity_id}`}
                        className="font-semibold text-sm text-[#A34263] hover:underline"
                      >
                        {inv.activity_title}
                      </Link>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-[#F0DCE3] text-[#4A3B41]">
                        {inv.responded_at
                          ? "ตอบรับแล้ว"
                          : inv.last_opened_at
                          ? "เปิดดูลิงก์แล้ว"
                          : "รอส่งลิงก์"}
                      </span>
                    </div>
                    <div className="text-xs text-[#6E5E65]">
                      วันที่ {inv.activity_date} • {inv.start_time}
                      {inv.end_time ? ` - ${inv.end_time}` : ""} น. • {inv.location}
                    </div>
                    {inv.rsvp_status === "not_going" && (
                      <div className="text-xs font-medium text-[#9A332E]">
                        เหตุผล: {inv.decline_reason || "ไม่ระบุ"}
                        {inv.response_note ? ` · ${inv.response_note}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateRsvp(inv.id, "going")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        inv.rsvp_status === "going"
                          ? "bg-[#2A6049] text-white border-[#2A6049]"
                          : "bg-white text-[#2A6049] border-[#D4E3DA]"
                      }`}
                    >
                      ไปด้วย
                    </button>
                    <select
                      aria-label={`เหตุผลไปไม่ได้ของ ${inv.nickname}`}
                      value={inv.rsvp_status === "not_going" ? inv.decline_reason || "ไม่ว่าง" : ""}
                      onChange={(e) => {
                        if (e.target.value) handleUpdateRsvp(inv.id, "not_going", e.target.value);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        inv.rsvp_status === "not_going"
                          ? "bg-[#B53D37] text-white border-[#B53D37]"
                          : "bg-white text-[#9A332E] border-[#EED2D0]"
                      }`}
                    >
                      <option value="">ไปไม่ได้ · เลือกเหตุผล</option>
                      {DECLINE_REASONS.map((r) => (
                        <option key={r} value={r} className="text-[#1F1A1C] bg-white">
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => copyPath(`/rsvp/${inv.invite_token}`, inv.invite_token)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E8] text-xs font-semibold text-[#1F1A1C] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedToken === inv.invite_token ? (
                        <Check className="w-3.5 h-3.5 text-[#2A6049]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#6E666A]" />
                      )}
                      คัดลอกลิงก์ RSVP
                    </button>
                    <a
                      href={`/rsvp/${inv.invite_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-xl bg-[#F4F2F3] text-[#1F1A1C] hover:bg-[#B3486B] hover:text-white transition"
                      title="เปิดลิงก์ RSVP"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Create Friend Onboarding / Self-Preference Link */}
          <form
            onSubmit={handleCreateOnboardingLink}
            className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4"
          >
            <div className="flex items-center gap-3">
              <MascotAvatar pose="cool" size="sm" />
              <div>
                <h2 className="font-bold text-[#1F1A1C]">
                  สร้างลิงก์เชิญเพื่อนลงทะเบียนเข้าร่วม CHUAN-DI
                </h2>
                <p className="text-xs text-[#6E666A]">
                  เพื่อนสามารถเปิดลิงก์ เข้าสู่ระบบ ยินยอมจัดเก็บข้อมูล และอัปเดตข้อมูลความชอบด้วยตนเองโดยเชื่อมโยงเข้ากับข้อมูลเดิมได้อย่างถูกต้อง
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ชื่อเรียกลิงก์ เช่น ลิงก์สำหรับกลุ่มเพื่อนมหาวิทยาลัย"
                className="sm:col-span-4 px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
              <select
                aria-label="เชื่อมกับโปรไฟล์เพื่อนที่มีอยู่"
                value={prefillFriendId}
                onChange={(e) => setPrefillFriendId(e.target.value)}
                className="sm:col-span-3 px-3 py-2.5 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-xs font-medium text-[#1F1A1C]"
              >
                <option value="">เพื่อนใหม่ · ยังไม่ผูกข้อมูลเดิม</option>
                {data.friendsList.map((f) => (
                  <option key={f.id} value={f.id}>
                    เชื่อมโยง: {f.nickname} · {f.full_name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="ระบุชื่อเล่นเป้าหมาย"
                className="sm:col-span-2 px-3 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
              <button
                type="submit"
                disabled={creatingLink}
                className="sm:col-span-3 px-4 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                สร้างลิงก์เชิญ
              </button>
            </div>
          </form>

          {/* Existing Registration Links */}
          <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-3">
            <h3 className="font-bold text-[#1F1A1C] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#B3486B]" />
              รายการลิงก์เชิญลงทะเบียน · {data.registrationInvitations.length} รายการ
            </h3>
            <div className="space-y-3">
              {data.registrationInvitations.map((ri) => (
                <div
                  key={ri.id}
                  className="p-4 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#1F1A1C]">{ri.label}</span>
                      {ri.target_friend_name && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white border border-[#EAE6E8] text-[#4A4346]">
                          ถึง: {ri.target_friend_name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          ri.status === "accepted"
                            ? "bg-[#F1F6F3] text-[#2A6049]"
                            : "bg-[#FAF7F0] text-[#75571A]"
                        }`}
                      >
                        {ri.status === "accepted"
                          ? `เข้าร่วมแล้ว · ${ri.accepted_nickname || "เพื่อน"}`
                          : "พร้อมใช้งาน · รอจัดส่งด้วยตนเอง"}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#6E666A] mt-1">
                      /invite/{ri.invite_token}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyPath(`/invite/${ri.invite_token}`, ri.invite_token)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E8] text-xs font-semibold text-[#1F1A1C] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedToken === ri.invite_token ? (
                        <Check className="w-3.5 h-3.5 text-[#2A6049]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#6E666A]" />
                      )}
                      คัดลอกลิงก์
                    </button>
                    <a
                      href={`/invite/${ri.invite_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#F4F2F3] hover:bg-[#B3486B] text-[#1F1A1C] hover:text-white text-xs font-semibold flex items-center gap-1 transition"
                    >
                      เปิดทดสอบ <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      aria-label={`ลบลิงก์ ${ri.label}`}
                      onClick={() => handleDeleteOnboarding(ri.id)}
                      className="p-1.5 rounded-xl text-[#A3322E] hover:bg-[#FDF3F2] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvitationsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-16 text-center text-sm text-[#6E666A]">กำลังโหลด...</div>}>
        <InvitationsInner />
      </Suspense>
    </AppShell>
  );
}
