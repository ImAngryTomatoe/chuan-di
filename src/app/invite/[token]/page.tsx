"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Heart,
  LogIn,
  Plus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  CATEGORY_META,
  CategorySlug,
  DIETARY_RESTRICTION_OPTIONS,
  FriendDietaryRestrictionItem,
  RELIGION_OPTIONS,
} from "@/lib/types";

interface InviteInfo {
  invitation: {
    label: string;
    target_friend_name: string | null;
    status: string;
    organizer_name: string;
    hasPrefillFriend: boolean;
  };
  currentUser: { id: number; name: string; email: string } | null;
  prefillFriend: {
    id: number;
    full_name: string;
    nickname: string;
    birthday: string | null;
    contact_info: string | null;
    religion?: string;
    can_eat?: string;
    cannot_eat?: string;
    dietary_restrictions?: FriendDietaryRestrictionItem[];
    interests: Array<{
      category_slug: CategorySlug;
      normalized_value: string;
      restriction_type?: "allergy" | "dislike" | null;
    }>;
  } | null;
}

const ALL_CATEGORIES: CategorySlug[] = [
  "food_preferences",
  "disliked_food",
  "hobbies",
  "travel_interests",
  "lifestyle",
  "other_interests",
];

interface TagEntry {
  category_slug: CategorySlug;
  value: string;
  restriction_type?: "allergy" | "dislike" | null;
}

export default function PublicInvitePage() {
  const params = useParams<{ token: string }>();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
  const [consent, setConsent] = useState(false);

  const [authMode, setAuthMode] = useState<"register" | "login" | "guest">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dislikeType, setDislikeType] = useState<"dislike" | "allergy">("dislike");

  const [tags, setTags] = useState<TagEntry[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [authenticatedDone, setAuthenticatedDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/invite/${params.token}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: InviteInfo | null) => {
        setInfo(d);
        if (d?.currentUser) {
          setAuthMode("guest");
          setNickname(d.currentUser.name);
        }
        if (d?.prefillFriend) {
          setNickname(d.prefillFriend.nickname);
          setFullName(d.prefillFriend.full_name);
          setBirthday(d.prefillFriend.birthday || "");
          setContactInfo(d.prefillFriend.contact_info || "");
          setReligion(d.prefillFriend.religion || "ไม่ระบุ");
          setCanEat(d.prefillFriend.can_eat || "");
          setCannotEat(d.prefillFriend.cannot_eat || "");
          setDietaryRestrictions(
            d.prefillFriend.dietary_restrictions?.map((item) => item.restriction_label) || []
          );
          setTags(
            d.prefillFriend.interests.map((i) => ({
              category_slug: i.category_slug,
              value: i.normalized_value,
              restriction_type: i.restriction_type ?? null,
            }))
          );
        } else if (d?.invitation.target_friend_name && !d?.currentUser) {
          setNickname(d.invitation.target_friend_name);
        }
      })
      .finally(() => setLoading(false));
  }, [params.token]);

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

  function addTag(cat: CategorySlug) {
    const val = (inputs[cat] || "").trim();
    if (!val) return;
    if (!tags.some((t) => t.category_slug === cat && t.value === val)) {
      setTags((prev) => [
        ...prev,
        {
          category_slug: cat,
          value: val,
          restriction_type: cat === "disliked_food" ? dislikeType : null,
        },
      ]);
    }
    setInputs((prev) => ({ ...prev, [cat]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!consent) {
      setError("กรุณาติ๊กยินยอมก่อนบันทึกข้อมูลความชอบของคุณ");
      return;
    }

    const effectiveMode = info?.currentUser ? "current_session" : authMode;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/invite/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          full_name: fullName,
          birthday,
          contact_info: contactInfo,
          religion: religion.trim() || "ไม่ระบุ",
          can_eat: canEat.trim(),
          cannot_eat: cannotEat.trim(),
          dietary_restrictions: dietaryRestrictions,
          consent_given: consent,
          interests: tags,
          authMode: effectiveMode,
          ...(effectiveMode === "register" || effectiveMode === "login"
            ? { email, password }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ไม่สามารถบันทึกข้อมูลได้");
        return;
      }
      setAuthenticatedDone(Boolean(data.authenticated));
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F6] flex items-center justify-center">
        <p className="text-sm text-[#6E666A]">กำลังโหลดแบบฟอร์มลงทะเบียน</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#F8F7F6] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <MascotAvatar pose="curious" size="lg" />
        <h1 className="text-xl font-bold text-[#1F1A1C]">ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว</h1>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F8F7F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-[#EAE6E8] shadow-soft text-center space-y-4">
          <MascotAvatar pose="happy" size="lg" className="mx-auto" float />
          <CheckCircle2 className="w-10 h-10 text-[#2A6049] mx-auto" />
          <h1 className="text-2xl font-bold text-[#1F1A1C]">บันทึกการเข้าร่วมเรียบร้อยแล้ว</h1>
          <p className="text-sm text-[#6E666A]">
            ขอขอบคุณ คุณ{nickname} ขณะนี้ {info.invitation.organizer_name} สามารถใช้ข้อมูลความชอบของท่านในการวางแผนกิจกรรมได้อย่างเหมาะสม
          </p>
          {authenticatedDone && (
            <Link
              href="/my-profile"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold shadow-soft transition-colors"
            >
              ไปยังโปรไฟล์และคำเชิญของฉัน
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F6] py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE6E8] shadow-soft space-y-6">
        <div className="flex items-center gap-4">
          <MascotAvatar pose="welcome" size="md" float />
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8F3553]">
              <Heart className="w-3.5 h-3.5 fill-[#B3486B] text-[#B3486B]" />
              <span>CHUAN-DI • คำเชิญจาก {info.invitation.organizer_name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F1A1C] mt-0.5">
              ลงทะเบียนข้อมูลความชอบและข้อจำกัดด้านอาหาร
            </h1>
            <p className="text-xs text-[#6E666A]">{info.invitation.label}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] text-xs font-medium text-[#A3322E]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Section: Register, Login, or Logged-in Session */}
          {info.currentUser ? (
            <div className="p-4 rounded-xl bg-[#F1F6F3] border border-[#D4E3DA] flex items-center gap-2.5 text-xs font-semibold text-[#2A6049]">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>
                เข้าสู่ระบบด้วยบัญชี: {info.currentUser.name} · {info.currentUser.email} — เมื่อยืนยันแล้วระบบจะเชื่อมโยงเข้ากับโปรไฟล์ของท่านโดยอัตโนมัติ
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                    authMode === "register"
                      ? "bg-[#B3486B] text-white border-[#B3486B]"
                      : "bg-white text-[#4A4346] border-[#EAE6E8]"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  สมัครบัญชีใหม่ · แนะนำ
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border cursor-pointer ${
                    authMode === "login"
                      ? "bg-[#B3486B] text-white border-[#B3486B]"
                      : "bg-white text-[#4A4346] border-[#EAE6E8]"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  เข้าสู่ระบบที่มีอยู่
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("guest")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    authMode === "guest"
                      ? "bg-[#1F1A1C] text-white border-[#1F1A1C]"
                      : "bg-white text-[#4A4346] border-[#EAE6E8]"
                  }`}
                >
                  บันทึกเฉพาะโปรไฟล์ · ไม่สร้างบัญชี
                </button>
              </div>

              {(authMode === "register" || authMode === "login") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="อีเมลของท่าน *"
                    className="px-3.5 py-2 rounded-xl border border-[#DED8DA] bg-white text-xs text-[#1F1A1C]"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      authMode === "register"
                        ? "กำหนดรหัสผ่าน · อย่างน้อย 6 ตัวอักษร *"
                        : "รหัสผ่านบัญชีของท่าน *"
                    }
                    className="px-3.5 py-2 rounded-xl border border-[#DED8DA] bg-white text-xs text-[#1F1A1C]"
                  />
                </div>
              )}
              <p className="text-[11px] text-[#6E666A]">
                การสร้างบัญชีช่วยให้ท่านสามารถแก้ไขข้อมูลความชอบและตอบรับคำเชิญกิจกรรมด้วยตนเองได้ทุกเมื่อ
              </p>
            </div>
          )}

          {/* Profile Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                ชื่อเล่น *
              </label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="เช่น อลิส หรือ ต้น"
                className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                ชื่อและนามสกุล
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">วันเกิด</label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A4346] mb-1">
                ช่องทางติดต่อสำหรับการนัดหมาย
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
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
                className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm font-medium text-[#261B20]"
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
                placeholder="เช่น ไก่ อาหารทะเล อาหารฮาลาล มังสวิรัติ"
                className="w-full px-4 py-2.5 rounded-xl border border-[#D4E3DA] bg-[#FFF9FA] text-sm text-[#261B20]"
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
                placeholder="เช่น ไม่กินหมู ไม่กินเนื้อวัว ไม่ดื่มแอลกอฮอล์"
                className="w-full px-4 py-2.5 rounded-xl border border-[#EED2D0] bg-[#FDF3F2] text-sm text-[#261B20]"
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

          {/* All 6 Categorized Interest Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ALL_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const list = tags.filter((t) => t.category_slug === cat);
              return (
                <div
                  key={cat}
                  className="p-3.5 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1F1A1C]">{meta.name_th}</span>
                    {cat === "disliked_food" && (
                      <select
                        aria-label="ประเภทข้อจำกัด"
                        value={dislikeType}
                        onChange={(e) =>
                          setDislikeType(e.target.value === "allergy" ? "allergy" : "dislike")
                        }
                        className="px-2 py-0.5 rounded-lg border border-[#EED2D0] bg-white text-[10px] font-semibold text-[#A3322E]"
                      >
                        <option value="dislike">ไม่ชอบ</option>
                        <option value="allergy">แพ้อาหาร</option>
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((t) => (
                      <span
                        key={t.value}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                      >
                        {t.restriction_type === "allergy" ? "แพ้: " : ""}
                        {t.value}
                        <button
                          type="button"
                          onClick={() =>
                            setTags((prev) =>
                              prev.filter(
                                (x) => !(x.category_slug === cat && x.value === t.value)
                              )
                            )
                          }
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={inputs[cat] || ""}
                      onChange={(e) => setInputs((p) => ({ ...p, [cat]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(cat);
                        }
                      }}
                      placeholder={`เพิ่ม${meta.name_th}`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#DED8DA] bg-white text-xs text-[#1F1A1C]"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(cat)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#F4F2F3] hover:bg-[#EAE6E8] text-[#1F1A1C] text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Consent */}
          <label className="flex items-start gap-2.5 p-4 rounded-xl bg-[#F1F6F3] border border-[#D4E3DA] cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-[#2A6049]"
            />
            <span className="text-xs text-[#2A6049] leading-relaxed flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                ข้าพเจ้ายินยอมให้ {info.invitation.organizer_name} บันทึกข้อมูลความชอบและข้อจำกัดด้านอาหารในระบบ CHUAN-DI เพื่อใช้แนะนำกิจกรรมที่เหมาะสมเท่านั้น
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white font-semibold text-sm shadow-soft transition cursor-pointer disabled:opacity-60"
          >
            {submitting ? "กำลังบันทึกข้อมูล" : "ยืนยันความยินยอมและบันทึกข้อมูล"}
          </button>
        </form>
      </div>
    </div>
  );
}
