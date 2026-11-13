"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CalendarHeart,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Link2,
  Loader2,
  MailCheck,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  CATEGORY_META,
  CategorySlug,
  DECLINE_REASONS,
  DIETARY_RESTRICTION_OPTIONS,
  FriendDietaryRestrictionItem,
  RELIGION_OPTIONS,
} from "@/lib/types";

const ALL_CATEGORIES: CategorySlug[] = [
  "food_preferences",
  "disliked_food",
  "hobbies",
  "travel_interests",
  "lifestyle",
  "other_interests",
];

interface ProfileInterest {
  id: number;
  interest_id: number;
  category_slug: CategorySlug;
  category_name_th: string;
  normalized_value: string;
  raw_value: string;
  source: string;
  restriction_type: "allergy" | "dislike" | null;
}

interface LinkedFriendProfile {
  id: number;
  owner_id: number;
  organizer_name: string;
  full_name: string;
  nickname: string;
  birthday: string | null;
  contact_info: string | null;
  religion?: string;
  can_eat?: string;
  cannot_eat?: string;
  dietary_restrictions?: FriendDietaryRestrictionItem[];
  avatar_color: string;
  consent_given: number;
  joined_via_invite: number;
  updated_at: string;
  interests: ProfileInterest[];
}

interface MyInvitation {
  id: number;
  activity_id: number;
  friend_id: number;
  rsvp_status: "pending" | "going" | "not_going";
  decline_reason: string | null;
  response_note: string | null;
  invite_token: string;
  responded_at: string | null;
  activity_title: string;
  activity_description: string;
  activity_category: string;
  activity_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  organizer_name: string;
  friend_nickname: string;
}

interface TagEntry {
  category_slug: CategorySlug;
  value: string;
  restriction_type?: "allergy" | "dislike" | null;
}

interface DraftRsvpState {
  rsvp_status: "going" | "not_going" | "pending";
  decline_reason: string;
  response_note: string;
}

function MyProfileInner() {
  const { notify } = useApp();
  const [loading, setLoading] = useState(true);
  const [ownProfile, setOwnProfile] = useState<{
    user_id: number;
    email: string;
    full_name: string;
    nickname: string;
    birthday: string | null;
    contact_info: string | null;
    religion?: string;
    can_eat?: string;
    cannot_eat?: string;
    avatar_color: string;
    updated_at: string;
    interests: ProfileInterest[];
    dietary_restrictions?: FriendDietaryRestrictionItem[];
  } | null>(null);
  const [profiles, setProfiles] = useState<LinkedFriendProfile[]>([]);
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"profile" | "invitations">("profile");

  // Profile form state
  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [religion, setReligion] = useState("ไม่ระบุ");
  const [canEat, setCanEat] = useState("");
  const [cannotEat, setCannotEat] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [showCustomDietary, setShowCustomDietary] = useState(false);
  const [customDietaryInput, setCustomDietaryInput] = useState("");
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [dislikeType, setDislikeType] = useState<"dislike" | "allergy">("dislike");
  const [savingProfile, setSavingProfile] = useState(false);

  // Optional quick self-fill helper
  const [showSelfNlp, setShowSelfNlp] = useState(false);
  const [selfNlpText, setSelfNlpText] = useState("");
  const [extractingSelfNlp, setExtractingSelfNlp] = useState(false);

  // Per-invitation draft state
  const [rsvpDrafts, setRsvpDrafts] = useState<Record<number, DraftRsvpState>>({});
  const [savingInviteId, setSavingInviteId] = useState<number | null>(null);

  const hydrateProfileForm = useCallback(
    (profile: {
      nickname?: string;
      full_name?: string;
      birthday?: string | null;
      contact_info?: string | null;
      religion?: string;
      can_eat?: string;
      cannot_eat?: string;
      dietary_restrictions?: FriendDietaryRestrictionItem[];
      interests: ProfileInterest[];
    }) => {
      setNickname(profile.nickname || "");
      setFullName(profile.full_name || "");
      setBirthday(profile.birthday || "");
      setContactInfo(profile.contact_info || "");
      setReligion(profile.religion || "ไม่ระบุ");
      setCanEat(profile.can_eat || "");
      setCannotEat(profile.cannot_eat || "");
      setDietaryRestrictions(
        profile.dietary_restrictions?.map((d) => d.restriction_label) || []
      );
      setTags(
        (profile.interests || []).map((item) => ({
          category_slug: item.category_slug,
          value: item.normalized_value,
          restriction_type:
            item.category_slug === "disliked_food" ? item.restriction_type || "dislike" : null,
        }))
      );
    },
    []
  );

  function toggleDietary(label: string) {
    setDietaryRestrictions((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  }

  function addCustomDietary() {
    const clean = customDietaryInput.trim();
    if (!clean) return;
    setDietaryRestrictions((prev) =>
      prev.some((item) => item.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, clean]
    );
    setCustomDietaryInput("");
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/my/profile", { cache: "no-store" });
      if (!res.ok) {
        notify("ไม่สามารถโหลดข้อมูลโปรไฟล์ส่วนตัวได้", "error");
        return;
      }
      const data: {
        ownProfile?: typeof ownProfile;
        profiles: LinkedFriendProfile[];
        invitations: MyInvitation[];
        pendingRequestsCount?: number;
      } = await res.json();

      setOwnProfile(data.ownProfile || null);
      setProfiles(data.profiles || []);
      setInvitations(data.invitations || []);
      setPendingRequestsCount(data.pendingRequestsCount || 0);

      const drafts: Record<number, DraftRsvpState> = {};
      for (const inv of data.invitations || []) {
        drafts[inv.id] = {
          rsvp_status: inv.rsvp_status,
          decline_reason: inv.decline_reason || DECLINE_REASONS[0],
          response_note: inv.response_note || "",
        };
      }
      setRsvpDrafts(drafts);

      if (data.ownProfile) {
        hydrateProfileForm(data.ownProfile);
      } else if (data.profiles && data.profiles.length > 0) {
        hydrateProfileForm(data.profiles[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [hydrateProfileForm, notify]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQuickExtractOwnTags() {
    const text = selfNlpText.trim();
    if (!text) return;
    setExtractingSelfNlp(true);
    try {
      const prefix = nickname.trim() || ownProfile?.nickname || "ฉัน";
      const res = await fetch("/api/nlp/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: `${prefix} ${text}`,
          sourceLabel: "my-profile-self-fill",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.items)) {
        notify(data.error || "ไม่สามารถดึงแท็กจากข้อความได้", "error");
        return;
      }
      let addedCount = 0;
      const nextTags = [...tags];
      const nextDietary = [...dietaryRestrictions];
      for (const item of data.items as Array<{
        category_slug: string;
        normalized_value: string;
        restriction_type?: "allergy" | "dislike" | null;
      }>) {
        const val = String(item.normalized_value || "").trim();
        if (!val) continue;
        if (item.category_slug === "dietary_restriction") {
          if (!nextDietary.some((d) => d.toLowerCase() === val.toLowerCase())) {
            nextDietary.push(val);
            addedCount += 1;
          }
        } else {
          const cat = item.category_slug as CategorySlug;
          if (!nextTags.some((t) => t.category_slug === cat && t.value.toLowerCase() === val.toLowerCase())) {
            nextTags.push({
              category_slug: cat,
              value: val,
              restriction_type: cat === "disliked_food" ? item.restriction_type || "dislike" : null,
            });
            addedCount += 1;
          }
        }
      }
      setTags(nextTags);
      setDietaryRestrictions(nextDietary);
      setSelfNlpText("");
      setShowSelfNlp(false);
      notify(
        addedCount > 0
          ? `เติมแท็กให้โปรไฟล์ของคุณแล้ว ${addedCount} รายการ (อย่าลืมกดบันทึกด้านล่าง/ด้านบนนะ)`
          : "ไม่พบแท็กเพิ่มเติมจากข้อความ ลองพิมพ์ระบุชื่ออาหารหรือกิจกรรมอีกนิดนะ",
        addedCount > 0 ? "success" : "info"
      );
    } finally {
      setExtractingSelfNlp(false);
    }
  }

  function addTag(category: CategorySlug) {
    const val = (inputs[category] || "").trim();
    if (!val) return;
    const exists = tags.some(
      (t) => t.category_slug === category && t.value.toLowerCase() === val.toLowerCase()
    );
    if (exists) {
      setInputs((prev) => ({ ...prev, [category]: "" }));
      return;
    }
    setTags((prev) => [
      ...prev,
      {
        category_slug: category,
        value: val,
        restriction_type: category === "disliked_food" ? dislikeType : null,
      },
    ]);
    setInputs((prev) => ({ ...prev, [category]: "" }));
  }

  function removeTag(category: CategorySlug, value: string) {
    setTags((prev) =>
      prev.filter((t) => !(t.category_slug === category && t.value === value))
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) {
      notify("กรุณากรอกชื่อเล่นของคุณ", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/my/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "own",
          full_name: fullName.trim() || nickname.trim(),
          nickname: nickname.trim(),
          birthday: birthday || null,
          contact_info: contactInfo.trim() || null,
          religion: religion.trim() || "ไม่ระบุ",
          can_eat: canEat.trim(),
          cannot_eat: cannotEat.trim(),
          dietary_restrictions: dietaryRestrictions,
          interests: tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "บันทึกโปรไฟล์ไม่สำเร็จ", "error");
        return;
      }
      notify("บันทึกโปรไฟล์ของคุณและซิงก์ให้เพื่อนเรียบร้อยแล้ว", "success");
      await loadData();
    } finally {
      setSavingProfile(false);
    }
  }

  function updateDraft(id: number, patch: Partial<DraftRsvpState>) {
    setRsvpDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          rsvp_status: "pending",
          decline_reason: DECLINE_REASONS[0],
          response_note: "",
        }),
        ...patch,
      },
    }));
  }

  async function handleSaveInvitation(inv: MyInvitation) {
    const draft = rsvpDrafts[inv.id];
    if (!draft) return;
    if (
      draft.rsvp_status === "not_going" &&
      draft.decline_reason === "อื่น ๆ" &&
      !draft.response_note.trim()
    ) {
      notify("กรุณาระบุรายละเอียดเพิ่มเติมเมื่อเลือกเหตุผล 'อื่น ๆ'", "error");
      return;
    }

    setSavingInviteId(inv.id);
    try {
      const res = await fetch(`/api/my/invitations/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rsvp_status: draft.rsvp_status,
          decline_reason:
            draft.rsvp_status === "not_going" ? draft.decline_reason : null,
          response_note: draft.response_note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "อัปเดตสถานะคำเชิญไม่สำเร็จ", "error");
        return;
      }
      notify(`อัปเดตคำเชิญ "${inv.activity_title}" เรียบร้อยแล้ว`, "success");
      await loadData();
    } finally {
      setSavingInviteId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center gap-3">
        <MascotAvatar pose="curious" size="md" float />
        <p className="text-sm font-medium text-[#6E666A] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#B3486B]" />
          กำลังโหลดโปรไฟล์และคำเชิญของคุณ...
        </p>
      </div>
    );
  }

  if (!ownProfile && profiles.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-3">
        <MascotAvatar pose="curious" size="md" className="mx-auto" />
        <h1 className="text-xl font-bold text-[#1F1A1C]">โปรไฟล์ของฉัน</h1>
        <p className="text-xs text-[#6E666A]">กรุณาเข้าสู่ระบบเพื่อจัดการโปรไฟล์และความชอบของคุณ</p>
      </div>
    );
  }

  const pendingCount = invitations.filter((i) => i.rsvp_status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <MascotAvatar pose="happy" size="md" float />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F4F2F3] border border-[#EAE6E8] text-[#4A4346] text-[11px] font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B3486B]" />
              โปรไฟล์ส่วนบุคคล · ซิงก์อัตโนมัติ
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F1A1C]">
              โปรไฟล์ของฉัน · {nickname || ownProfile?.nickname || ""}
            </h1>
            <p className="text-xs text-[#6E666A]">
              ข้อมูลความชอบและข้อจำกัดด้านอาหารที่คุณกรอกไว้จะซิงก์ให้เพื่อนที่เชื่อมต่อบัญชีกับคุณเห็นโดยตรง
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#B3486B] text-white shadow-soft"
                : "bg-[#FAF9F8] border border-[#EAE6E8] text-[#4A4346] hover:bg-[#F4F2F3]"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            โปรไฟล์และความชอบ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "invitations"
                ? "bg-[#B3486B] text-white shadow-soft"
                : "bg-[#FAF9F8] border border-[#EAE6E8] text-[#4A4346] hover:bg-[#F4F2F3]"
            }`}
          >
            <CalendarHeart className="w-4 h-4" />
            คำเชิญกิจกรรมของฉัน · {invitations.length}
            {pendingCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === "invitations"
                    ? "bg-white text-[#9D3B5B]"
                    : "bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]"
                }`}
              >
                รอตอบ {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Google Calendar Self-Connect Privacy Banner */}
      <div className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] text-[#2F59B6] flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-0.5">
            <div className="text-sm font-bold text-[#1F1A1C]">
              ซิงก์เวลาว่างจาก Google Calendar ของคุณเอง
            </div>
            <p className="text-[#6E666A]">
              เชื่อมต่อบัญชี Google ส่วนตัว เลือกปฏิทินที่ต้องการแชร์ และเปิด/ปิดสิทธิ์การมองเห็นให้เพื่อนแต่ละคนได้อย่างอิสระ (ไม่เปิดเผยชื่อนัดหมาย)
            </p>
          </div>
        </div>
        <Link
          href="/settings#google-calendar"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F1A1C] hover:bg-[#3A3236] text-white text-xs font-semibold shrink-0 transition-colors"
        >
          <span>ตั้งค่า Google Calendar</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {pendingRequestsCount > 0 && (
        <div className="bg-[#FFF5F8] rounded-2xl border border-[#F5C2D3] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#8F2849]">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>
              คุณมีคำขอเป็นเพื่อนใหม่ <strong>{pendingRequestsCount} รายการ</strong> กดยอมรับเพื่อเชื่อมโปรไฟล์และดูข้อมูลกัน
            </span>
          </div>
          <Link
            href="/friends?add=1"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold shrink-0"
          >
            ดูคำขอเป็นเพื่อน
          </Link>
        </div>
      )}

      {/* Connected friends groups summary (when synced to external organizer groups) */}
      {profiles.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EAE6E8] p-3.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#6E666A] px-1">
            ซิงก์ไปยังกลุ่มเพื่อนที่เชื่อมต่อแล้ว {profiles.length} กลุ่ม:
          </span>
          {profiles.map((p) => (
            <span
              key={p.id}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F6F3] text-[#1F5E3B] border border-[#BBE0C8]"
            >
              กลุ่มของ {p.organizer_name}
            </span>
          ))}
        </div>
      )}

      {activeTab === "profile" ? (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6E8] pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-xs"
                style={{ backgroundColor: ownProfile?.avatar_color || "#B3486B" }}
              >
                {(nickname || ownProfile?.nickname || "ฉ").slice(0, 1)}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1F1A1C]">
                  แก้ไขข้อมูลและแท็กความชอบของฉัน · {nickname || ownProfile?.nickname || ""}
                </h2>
                <p className="text-xs text-[#6E666A]">
                  {ownProfile?.email ? `บัญชี: ${ownProfile.email} · ` : ""}
                  เพื่อนที่เชื่อมต่อจะเห็นข้อมูลล่าสุดของคุณอัตโนมัติ (แก้แทนไม่ได้)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSelfNlp((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#FFF6F9] hover:bg-[#FFEBF2] border border-[#F5C2D3] text-[#8F2849] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                เติมแท็กจากข้อความสั้น ๆ
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold shadow-soft transition-colors cursor-pointer disabled:opacity-60"
              >
                {savingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingProfile ? "กำลังบันทึก..." : "บันทึกโปรไฟล์และความชอบ"}
              </button>
            </div>
          </div>

          {showSelfNlp && (
            <div className="p-4 rounded-2xl bg-[#FFF9FA] border border-[#F5C2D3] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8F2849] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F47FA5]" />
                  พิมพ์เล่าความชอบหรือข้อจำกัดของคุณ ให้น้องชวนแปลงเป็นแท็กให้อัตโนมัติ
                </span>
                <button
                  type="button"
                  onClick={() => setShowSelfNlp(false)}
                  className="text-xs text-[#6E666A] hover:text-[#1F1A1C] cursor-pointer"
                >
                  ปิด
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={selfNlpText}
                  onChange={(e) => setSelfNlpText(e.target.value)}
                  placeholder="ตัวอย่าง: ชอบกินหมูกระทะกับคาเฟ่ ไม่ชอบอาหารเผ็ด แพ้กุ้ง"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-[#F0DCE3] bg-white text-xs text-[#1F1A1C]"
                />
                <button
                  type="button"
                  disabled={extractingSelfNlp || !selfNlpText.trim()}
                  onClick={handleQuickExtractOwnTags}
                  className="px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {extractingSelfNlp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  แปลงเป็นแท็ก
                </button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                ชื่อเล่น *
              </label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E8] bg-white text-sm text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25 focus:border-[#B3486B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E8] bg-white text-sm text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25 focus:border-[#B3486B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                วันเกิด
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E8] bg-white text-sm text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25 focus:border-[#B3486B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                LINE / IG สำหรับนัดหมาย
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="เช่น @alice.line"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE6E8] bg-white text-sm text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25 focus:border-[#B3486B]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#4A4346]">
                  ศาสนา (ไม่จำเป็นต้องระบุ)
                </label>
                {religion !== "ไม่ระบุ" && (
                  <button
                    type="button"
                    onClick={() => setReligion("ไม่ระบุ")}
                    className="text-[11px] font-semibold text-[#A34263] hover:underline cursor-pointer"
                  >
                    ล้างค่า
                  </button>
                )}
              </div>
              <select
                aria-label="ศาสนา (ไม่จำเป็นต้องระบุ)"
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm font-medium text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]/25 focus:border-[#F47FA5]"
              >
                {RELIGION_OPTIONS.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2A6049] mb-1">
                สิ่งที่รับประทานได้
              </label>
              <input
                type="text"
                value={canEat}
                onChange={(e) => setCanEat(e.target.value)}
                placeholder="เช่น ไก่, ทะเล, อาหารฮาลาล, มังสวิรัติ"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4E3DA] bg-[#F1F6F3] text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#2A6049]/25 focus:border-[#2A6049]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#9A332E] mb-1">
                สิ่งที่รับประทานไม่ได้หรือข้อควรระวังเพิ่มเติม
              </label>
              <input
                type="text"
                value={cannotEat}
                onChange={(e) => setCannotEat(e.target.value)}
                placeholder="เช่น ไม่กินหมู, ไม่กินเนื้อวัว, ไม่ดื่มแอลกอฮอล์"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EED2D0] bg-[#FDF3F2] text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#9A332E]/25 focus:border-[#9A332E]"
              />
            </div>
          </div>

          {/* Dietary Restrictions Multi-Select */}
          <div className="p-4 rounded-2xl bg-[#FFF6F9] border border-[#F8CFD9] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#8F2849] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#F47FA5]" />
                ข้อจำกัดด้านอาหาร
              </span>
              <span className="text-xs font-semibold text-[#A34263]">
                เลือกแล้ว {dietaryRestrictions.length} ข้อ
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DIETARY_RESTRICTION_OPTIONS.map((option) => {
                const selected = dietaryRestrictions.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleDietary(option)}
                    aria-pressed={selected}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                      selected
                        ? "bg-[#F47FA5] text-white border-[#F47FA5]"
                        : "bg-white text-[#261B20] border-[#F0DCE3] hover:border-[#F47FA5]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{option}</span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowCustomDietary((v) => !v)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-[#DFC5CE] bg-white text-[#6E5E65] hover:border-[#F47FA5] hover:text-[#8F2849] cursor-pointer"
              >
                + อื่น ๆ (ระบุเพิ่มเติม)
              </button>
            </div>
            {showCustomDietary && (
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={customDietaryInput}
                  onChange={(e) => setCustomDietaryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomDietary();
                    }
                  }}
                  placeholder="พิมพ์ข้อจำกัดเพิ่มเติม เช่น งดหวาน, งดกลูเตน..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-[#F0DCE3] bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomDietary}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F47FA5] text-white text-xs font-semibold cursor-pointer"
                >
                  เพิ่มข้อจำกัด
                </button>
              </div>
            )}
            {dietaryRestrictions.some(
              (item) => !(DIETARY_RESTRICTION_OPTIONS as readonly string[]).includes(item)
            ) && (
              <div className="flex flex-wrap gap-1.5">
                {dietaryRestrictions
                  .filter(
                    (item) => !(DIETARY_RESTRICTION_OPTIONS as readonly string[]).includes(item)
                  )
                  .map((custom) => (
                    <span
                      key={custom}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFE4EC] text-[#8F2849] border border-[#F5C2D3]"
                    >
                      {custom}
                      <button
                        type="button"
                        onClick={() => toggleDietary(custom)}
                        className="cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* All 6 Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#1F1A1C]">
              ความชอบและข้อจำกัดทั้ง 6 หมวดหมู่
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const list = tags.filter((t) => t.category_slug === cat);
                return (
                  <div
                    key={cat}
                    className="p-4 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1F1A1C]">
                        {meta.name_th}
                      </span>
                      {cat === "disliked_food" && (
                        <select
                          aria-label="ประเภทข้อจำกัดอาหาร"
                          value={dislikeType}
                          onChange={(e) =>
                            setDislikeType(
                              e.target.value === "allergy" ? "allergy" : "dislike"
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-[#EED2D0] bg-[#FDF3F2] text-[11px] font-semibold text-[#A3322E]"
                        >
                          <option value="dislike">ไม่ชอบ</option>
                          <option value="allergy">แพ้อาหาร</option>
                        </select>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                      {list.length === 0 ? (
                        <span className="text-[11px] text-[#6E666A]">
                          ยังไม่มีรายการในหมวดนี้
                        </span>
                      ) : (
                        list.map((t) => (
                          <span
                            key={`${t.category_slug}-${t.value}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                          >
                            {t.restriction_type === "allergy" ? "แพ้: " : ""}
                            {t.value}
                            <button
                              type="button"
                              aria-label={`ลบ ${t.value}`}
                              onClick={() => removeTag(cat, t.value)}
                              className="cursor-pointer hover:opacity-75"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputs[cat] || ""}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [cat]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(cat);
                          }
                        }}
                        placeholder={`เพิ่ม${meta.name_th}`}
                        className="flex-1 px-3 py-2 rounded-xl border border-[#EAE6E8] bg-white text-xs text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25 focus:border-[#B3486B]"
                      />
                      <button
                        type="button"
                        onClick={() => addTag(cat)}
                        className="px-3 py-2 rounded-xl bg-[#F4F2F3] hover:bg-[#EAE6E8] border border-[#EAE6E8] text-[#1F1A1C] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่ม
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {invitations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-10 text-center space-y-3">
              <CalendarHeart className="w-10 h-10 text-[#B3486B] mx-auto" />
              <h2 className="text-base font-bold text-[#1F1A1C]">
                ยังไม่มีคำเชิญกิจกรรมที่ส่งถึงคุณ
              </h2>
              <p className="text-sm text-[#6E666A]">
                เมื่อผู้จัดสร้างกิจกรรมและเชิญคุณผ่านโปรไฟล์ที่เชื่อมต่อไว้ คำเชิญทั้งหมดจะมาแสดงที่นี่
              </p>
            </div>
          ) : (
            invitations.map((inv) => {
              const draft = rsvpDrafts[inv.id] || {
                rsvp_status: inv.rsvp_status,
                decline_reason: inv.decline_reason || DECLINE_REASONS[0],
                response_note: inv.response_note || "",
              };
              const isSaving = savingInviteId === inv.id;

              return (
                <div
                  key={inv.id}
                  className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#EAE6E8] pb-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F4F2F3] border border-[#EAE6E8] text-[#4A4346] text-[11px] font-semibold">
                          {inv.activity_category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#6E666A]">
                          <UserCheck className="w-3.5 h-3.5 text-[#6E666A]" />
                          ผู้จัด: <strong className="text-[#1F1A1C]">{inv.organizer_name}</strong>
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#1F1A1C]">
                        {inv.activity_title}
                      </h3>
                      {inv.activity_description && (
                        <p className="text-sm text-[#6E666A]">
                          {inv.activity_description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          inv.rsvp_status === "going"
                            ? "bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]"
                            : inv.rsvp_status === "not_going"
                            ? "bg-[#FDF3F2] text-[#A3322E] border border-[#EED2D0]"
                            : "bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]"
                        }`}
                      >
                        {inv.rsvp_status === "going" ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : inv.rsvp_status === "not_going" ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5" />
                        )}
                        {inv.rsvp_status === "going"
                          ? "ไปด้วย"
                          : inv.rsvp_status === "not_going"
                          ? "ไปไม่ได้"
                          : "ยังไม่ตอบ"}
                      </span>
                      <Link
                        href={`/rsvp/${inv.invite_token}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFF9FA] hover:bg-[#FFF0F5] border border-[#F0DCE3] text-xs font-semibold text-[#4A3B41]"
                      >
                        เปิดการ์ดเชิญ
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#261B20]">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB]">
                      <Calendar className="w-4 h-4 text-[#6E5E65] shrink-0" />
                      <span>{inv.activity_date}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB]">
                      <Clock className="w-4 h-4 text-[#6E5E65] shrink-0" />
                      <span>
                        {inv.start_time}
                        {inv.end_time ? ` - ${inv.end_time}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB]">
                      <MapPin className="w-4 h-4 text-[#6E5E65] shrink-0" />
                      <span className="truncate">{inv.location}</span>
                    </div>
                  </div>

                  {/* Interactive Self-Service RSVP Controls */}
                  <div className="pt-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft(inv.id, { rsvp_status: "going" })}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          draft.rsvp_status === "going"
                            ? "bg-[#F1F6F3] border-[#2A6049] text-[#2A6049]"
                            : "bg-white border-[#F0DCE3] text-[#4A3B41] hover:bg-[#FFF9FA]"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        ไปด้วย
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft(inv.id, { rsvp_status: "not_going" })}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          draft.rsvp_status === "not_going"
                            ? "bg-[#FDF3F2] border-[#9A332E] text-[#9A332E]"
                            : "bg-white border-[#F0DCE3] text-[#4A3B41] hover:bg-[#FFF9FA]"
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        ไปไม่ได้
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft(inv.id, { rsvp_status: "pending" })}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          draft.rsvp_status === "pending"
                            ? "bg-[#FAF7F0] border-[#75571A] text-[#75571A]"
                            : "bg-white border-[#F0DCE3] text-[#4A3B41] hover:bg-[#FFF9FA]"
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                        ยังไม่ตอบ
                      </button>
                    </div>

                    {draft.rsvp_status === "not_going" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8]">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4A4346] mb-1">
                            เหตุผลที่ไม่สะดวก
                          </label>
                          <select
                            value={draft.decline_reason}
                            onChange={(e) =>
                              updateDraft(inv.id, { decline_reason: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-[#EAE6E8] bg-white text-xs text-[#1F1A1C]"
                          >
                            {DECLINE_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#4A4346] mb-1">
                            {draft.decline_reason === "อื่น ๆ"
                              ? "ระบุเหตุผลเพิ่มเติม *"
                              : "หมายเหตุถึงผู้จัด ไม่บังคับ"}
                          </label>
                          <input
                            type="text"
                            value={draft.response_note}
                            onChange={(e) =>
                              updateDraft(inv.id, { response_note: e.target.value })
                            }
                            placeholder={
                              draft.decline_reason === "อื่น ๆ"
                                ? "โปรดระบุเหตุผลสั้น ๆ"
                                : "เช่น โอกาสหน้ายินดีเข้าร่วม"
                            }
                            className="w-full px-3 py-2 rounded-xl border border-[#EAE6E8] bg-white text-xs text-[#1F1A1C]"
                          />
                        </div>
                      </div>
                    )}

                    {draft.rsvp_status === "going" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={draft.response_note}
                          onChange={(e) =>
                            updateDraft(inv.id, { response_note: e.target.value })
                          }
                          placeholder="ข้อความถึงผู้จัด เช่น เวลาเดินทางถึงโดยประมาณ หรือข้อมูลการแพ้อาหาร"
                          className="flex-1 px-3 py-2 rounded-xl border border-[#EAE6E8] bg-white text-xs text-[#1F1A1C] focus:outline-none focus:ring-2 focus:ring-[#B3486B]/25"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#6E666A] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-[#6E666A]" />
                        สถานะนี้จะอัปเดตให้ผู้จัดทราบโดยตรง
                      </span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveInvitation(inv)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {isSaving ? "กำลังอัปเดต..." : "อัปเดตสถานะ"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function MyProfilePage() {
  return (
    <AppShell>
      <MyProfileInner />
    </AppShell>
  );
}
