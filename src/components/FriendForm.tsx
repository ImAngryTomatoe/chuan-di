"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, Plus, Save, ShieldCheck, Utensils, X } from "lucide-react";
import {
  CATEGORY_META,
  CategorySlug,
  DIETARY_RESTRICTION_OPTIONS,
  FriendRecord,
  RELIGION_OPTIONS,
} from "@/lib/types";

interface DraftTag {
  category_slug: CategorySlug;
  value: string;
  restriction_type?: "allergy" | "dislike" | null;
}

const CATEGORIES_ORDER: CategorySlug[] = [
  "food_preferences",
  "disliked_food",
  "hobbies",
  "travel_interests",
  "lifestyle",
  "other_interests",
];

const QUICK_SUGGESTIONS: Record<CategorySlug, string[]> = {
  food_preferences: ["หมูกระทะ", "ชาบู", "ส้มตำ", "อาหารญี่ปุ่น", "กาแฟ", "ของหวาน"],
  disliked_food: ["อาหารเผ็ด", "ผักชี", "ทุเรียน", "ต้นหอม", "เครื่องใน"],
  hobbies: ["บอร์ดเกม", "ดูหนัง", "ถ่ายรูป", "อ่านหนังสือ", "ทำขนม", "วิ่งออกกำลังกาย"],
  travel_interests: ["ทะเล", "คาเฟ่", "ภูเขา", "แคมป์ปิ้ง", "ปิกนิก", "เที่ยวต่างประเทศ"],
  lifestyle: ["สายคาเฟ่", "สายชิล", "สายปาร์ตี้", "รักสัตว์"],
  other_interests: ["ดนตรี", "เกม", "K-Pop", "ศิลปะ"],
};

const QUICK_ALLERGY_SUGGESTIONS = ["อาหารทะเล", "กุ้ง", "ถั่วลิสง", "นมวัว", "ไข่", "กลูเตน"];

const QUICK_CANNOT_EAT = [
  "ไม่กินหมู",
  "ไม่กินเนื้อวัว",
  "ไม่ดื่มแอลกอฮอล์",
  "มังสวิรัติ",
  "งดกุ้งและอาหารทะเล",
];

const QUICK_CAN_EAT = [
  "อาหารฮาลาล",
  "หมู, ไก่, เนื้อ",
  "ไก่, ปลา, ผัก",
  "อาหารทะเล",
  "มังสวิรัติ",
];

export function FriendForm({
  initialFriend,
  onSubmit,
  submitLabel = "บันทึกข้อมูลเพื่อน",
  submitting = false,
}: {
  initialFriend?: FriendRecord;
  onSubmit: (payload: {
    full_name: string;
    nickname: string;
    birthday: string;
    contact_info: string;
    personal_notes: string;
    religion: string;
    can_eat: string;
    cannot_eat: string;
    dietary_restrictions: string[];
    interests: DraftTag[];
  }) => Promise<void>;
  submitLabel?: string;
  submitting?: boolean;
}) {
  const [fullName, setFullName] = useState(initialFriend?.full_name || "");
  const [nickname, setNickname] = useState(initialFriend?.nickname || "");
  const [birthday, setBirthday] = useState(initialFriend?.birthday || "");
  const [contactInfo, setContactInfo] = useState(initialFriend?.contact_info || "");
  const [personalNotes, setPersonalNotes] = useState(initialFriend?.personal_notes || "");
  const [religion, setReligion] = useState(initialFriend?.religion || "ไม่ระบุ");
  const [canEat, setCanEat] = useState(initialFriend?.can_eat || "");
  const [cannotEat, setCannotEat] = useState(initialFriend?.cannot_eat || "");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    initialFriend?.dietary_restrictions?.map((d) => d.restriction_label) || []
  );
  const [showCustomDietary, setShowCustomDietary] = useState(false);
  const [customDietaryInput, setCustomDietaryInput] = useState("");
  const [allergyInput, setAllergyInput] = useState("");

  const [tags, setTags] = useState<DraftTag[]>(
    initialFriend?.interests.map((i) => ({
      category_slug: i.category_slug,
      value: i.normalized_value,
      restriction_type: i.category_slug === "disliked_food" ? i.restriction_type || "dislike" : null,
    })) || []
  );

  const [inputs, setInputs] = useState<Record<CategorySlug, string>>({
    food_preferences: "",
    disliked_food: "",
    hobbies: "",
    travel_interests: "",
    lifestyle: "",
    other_interests: "",
  });

  const [error, setError] = useState("");

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

  function addTag(cat: CategorySlug, rawVal: string, explicitRestriction?: "allergy" | "dislike") {
    const val = rawVal.trim();
    if (!val) return;
    const targetRestriction =
      cat === "disliked_food" ? explicitRestriction || "dislike" : null;
    const exists = tags.some(
      (t) =>
        t.category_slug === cat &&
        t.value.toLowerCase() === val.toLowerCase() &&
        (cat !== "disliked_food" || (t.restriction_type || "dislike") === targetRestriction)
    );
    if (!exists) {
      setTags((prev) => [
        ...prev,
        { category_slug: cat, value: val, restriction_type: targetRestriction },
      ]);
    }
    if (cat === "disliked_food" && targetRestriction === "allergy") {
      setAllergyInput("");
    } else {
      setInputs((prev) => ({ ...prev, [cat]: "" }));
    }
  }

  function removeTag(cat: CategorySlug, val: string, restrictionType?: "allergy" | "dislike" | null) {
    setTags((prev) =>
      prev.filter(
        (t) =>
          !(
            t.category_slug === cat &&
            t.value === val &&
            (cat !== "disliked_food" ||
              !restrictionType ||
              (t.restriction_type || "dislike") === restrictionType)
          )
      )
    );
  }

  function appendCommaText(
    current: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    snippet: string
  ) {
    const trimmed = current.trim();
    if (!trimmed) {
      setter(snippet);
      return;
    }
    if (trimmed.toLowerCase().includes(snippet.toLowerCase())) return;
    setter(`${trimmed}, ${snippet}`);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim() && !nickname.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล หรือชื่อเล่นของเพื่อน");
      return;
    }
    await onSubmit({
      full_name: fullName.trim() || nickname.trim(),
      nickname: nickname.trim() || fullName.trim().split(/\s+/)[0],
      birthday: birthday.trim(),
      contact_info: contactInfo.trim(),
      personal_notes: personalNotes.trim(),
      religion: religion.trim() || "ไม่ระบุ",
      can_eat: canEat.trim(),
      cannot_eat: cannotEat.trim(),
      dietary_restrictions: dietaryRestrictions,
      interests: tags,
    });
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] text-sm font-medium text-[#9A332E]">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-[#EAE6E8] space-y-4">
        <h2 className="text-lg font-bold text-[#1F1A1C]">ข้อมูลพื้นฐานของเพื่อน</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
              ชื่อเล่น *
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="เช่น อลิส, มิ้นท์, เจมส์"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-[#FAF9F8] focus:outline-none focus:ring-2 focus:ring-[#B3486B] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="เช่น อลิสา วงศ์สวัสดิ์"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-[#FAF9F8] focus:outline-none focus:ring-2 focus:ring-[#B3486B] text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#544D51]">
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
              className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] focus:outline-none focus:ring-2 focus:ring-[#F47FA5] text-sm font-medium text-[#261B20]"
            >
              {RELIGION_OPTIONS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#6E5E65] mt-1">
              ระบุเฉพาะเมื่อเพื่อนบอกเอง น้องชวนจะไม่เดาศาสนาจากชื่อหรืออาหาร
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
              วันเกิด
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-[#FAF9F8] focus:outline-none focus:ring-2 focus:ring-[#B3486B] text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
              ช่องทางติดต่อ · LINE, IG หรือหมายเลขโทรศัพท์
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="เช่น LINE: alice.ws"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-[#FAF9F8] focus:outline-none focus:ring-2 focus:ring-[#B3486B] text-sm"
            />
          </div>
        </div>

        {/* Structured Dietary Restrictions Multi-Select */}
        <div className="p-4 rounded-2xl bg-[#FFF6F9] border border-[#F8CFD9] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-[#8F2849]">
                <ShieldCheck className="w-4 h-4 text-[#F47FA5]" />
                ข้อจำกัดด้านอาหาร
              </label>
              <p className="text-xs text-[#6E5E65] mt-0.5">
                เลือกได้หลายข้อ เพื่อช่วยเตือนเวลาหาร้านอาหารหรือนัดทำกิจกรรมร่วมกัน
              </p>
            </div>
            <span className="text-xs font-semibold text-[#A34263] bg-white px-2.5 py-1 rounded-full border border-[#F5DCE4]">
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
                      ? "bg-[#F47FA5] text-white border-[#F47FA5] shadow-sm"
                      : "bg-white text-[#261B20] border-[#F0DCE3] hover:border-[#F47FA5] hover:bg-[#FFF9FA]"
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                showCustomDietary
                  ? "bg-[#FFE4EC] text-[#8F2849] border-[#F47FA5]"
                  : "bg-white text-[#6E5E65] border-dashed border-[#DFC5CE] hover:border-[#F47FA5] hover:text-[#8F2849]"
              }`}
            >
              + อื่น ๆ (ระบุเพิ่มเติม)
            </button>
          </div>

          {showCustomDietary && (
            <div className="flex flex-wrap gap-2 pt-1">
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
                className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl border border-[#F0DCE3] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
              />
              <button
                type="button"
                onClick={addCustomDietary}
                className="px-4 py-2 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white text-xs font-semibold transition cursor-pointer"
              >
                เพิ่มข้อจำกัด
              </button>
            </div>
          )}

          {dietaryRestrictions.some(
            (item) => !(DIETARY_RESTRICTION_OPTIONS as readonly string[]).includes(item)
          ) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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
                      className="hover:opacity-70 cursor-pointer"
                      aria-label={`ลบ ${custom}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Dedicated Dietary / Religious Guidelines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#F4E6EB]">
          <div className="p-4 rounded-xl bg-[#F4F7F5] border border-[#D4E6DC] space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#276348]">
              <Utensils className="w-3.5 h-3.5" />
              สิ่งที่รับประทานได้
            </label>
            <input
              type="text"
              value={canEat}
              onChange={(e) => setCanEat(e.target.value)}
              placeholder="เช่น อาหารฮาลาล, ไก่, อาหารทะเล, มังสวิรัติ"
              className="w-full px-3.5 py-2 rounded-xl border border-[#D4E6DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#5E8B77] text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {QUICK_CAN_EAT.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendCommaText(canEat, setCanEat, chip)}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-[#D4E6DC] text-[#276348] hover:bg-[#EAF3EE] transition cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#9A332E]">
              <AlertTriangle className="w-3.5 h-3.5" />
              สิ่งที่รับประทานไม่ได้หรือข้อควรระวังเพิ่มเติม
            </label>
            <input
              type="text"
              value={cannotEat}
              onChange={(e) => setCannotEat(e.target.value)}
              placeholder="เช่น ไม่กินหมู, ไม่กินเนื้อวัว, ไม่ดื่มแอลกอฮอล์"
              className="w-full px-3.5 py-2 rounded-xl border border-[#EED2D0] bg-white focus:outline-none focus:ring-2 focus:ring-[#F47FA5] text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {QUICK_CANNOT_EAT.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendCommaText(cannotEat, setCannotEat, chip)}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-[#EED2D0] text-[#9A332E] hover:bg-[#FCE8E6] transition cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
            บันทึกเพิ่มเติม
          </label>
          <textarea
            rows={2}
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
            placeholder="เช่น รายละเอียดเพิ่มเติมเกี่ยวกับความสะดวกในการนัดหมาย"
            className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] focus:outline-none focus:ring-2 focus:ring-[#F47FA5] text-sm"
          />
        </div>
      </div>

      {/* Multi-category Interests */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-[#F4E6EB] space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#261B20]">
            ความชอบของเพื่อน อาหารที่ไม่ชอบ และอาหารที่แพ้
          </h2>
          <p className="text-xs text-[#6E5E65] mt-0.5">
            แยกหมวดอาหารที่ชอบ อาหารที่ไม่ชอบ และอาหารที่แพ้ไว้อย่างชัดเจน เพื่อให้ชวนเพื่อนได้ตรงใจและปลอดภัย
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CATEGORIES_ORDER.map((catSlug) => {
            const meta = CATEGORY_META[catSlug];
            const catTags =
              catSlug === "disliked_food"
                ? tags.filter(
                    (t) =>
                      t.category_slug === "disliked_food" &&
                      (t.restriction_type || "dislike") !== "allergy"
                  )
                : tags.filter((t) => t.category_slug === catSlug);
            return (
              <div
                key={catSlug}
                className="p-4 rounded-xl bg-[#FFF9FA] border border-[#F4E6EB] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#261B20]">
                    {catSlug === "disliked_food" ? "อาหารที่ไม่ชอบ" : meta.name_th}
                  </span>
                  <span className="text-[11px] text-[#6E5E65]">{catTags.length} รายการ</span>
                </div>

                {/* Selected Tags */}
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {catTags.map((t) => (
                    <span
                      key={`${t.value}-${t.restriction_type || "tag"}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-white text-[#261B20] border-[#F0DCE3]"
                    >
                      {t.value}
                      <button
                        type="button"
                        onClick={() => removeTag(catSlug, t.value, t.restriction_type)}
                        className="hover:opacity-70 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {catTags.length === 0 && (
                    <span className="text-xs text-[#857B80]">ยังไม่มีรายการในหมวดนี้</span>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputs[catSlug]}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [catSlug]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(
                          catSlug,
                          inputs[catSlug],
                          catSlug === "disliked_food" ? "dislike" : undefined
                        );
                      }
                    }}
                    placeholder={
                      catSlug === "disliked_food"
                        ? "พิมพ์อาหารที่ไม่ชอบ เช่น ผักชี, ทุเรียน..."
                        : `เพิ่ม${meta.name_th}...`
                    }
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[#F0DCE3] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      addTag(
                        catSlug,
                        inputs[catSlug],
                        catSlug === "disliked_food" ? "dislike" : undefined
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#F0DCE3] text-[#261B20] text-xs font-semibold hover:border-[#F47FA5] hover:text-[#8F2849] transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่ม
                  </button>
                </div>

                {/* Quick Suggestions */}
                <div className="flex flex-wrap gap-1">
                  {QUICK_SUGGESTIONS[catSlug]
                    .filter((s) => !catTags.some((t) => t.value === s))
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          addTag(
                            catSlug,
                            s,
                            catSlug === "disliked_food" ? "dislike" : undefined
                          )
                        }
                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-[#F4E6EB] text-[#6E5E65] hover:border-[#F47FA5] hover:text-[#8F2849] transition cursor-pointer"
                      >
                        + {s}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}

          {/* Dedicated Allergies Box (stored cleanly under disliked_food + allergy) */}
          {(() => {
            const allergyTags = tags.filter(
              (t) => t.category_slug === "disliked_food" && t.restriction_type === "allergy"
            );
            return (
              <div className="p-4 rounded-xl bg-[#FFF5F5] border border-[#F2D5D3] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#9A332E]">อาหารที่แพ้</span>
                  <span className="text-[11px] text-[#9A332E] font-medium">
                    {allergyTags.length} รายการ
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {allergyTags.map((t) => (
                    <span
                      key={`allergy-${t.value}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-white text-[#9A332E] border-[#EED2D0]"
                    >
                      <span className="px-1.5 py-0.5 rounded-full bg-[#B53D37] text-white text-[10px] font-semibold">
                        แพ้
                      </span>
                      {t.value}
                      <button
                        type="button"
                        onClick={() => removeTag("disliked_food", t.value, "allergy")}
                        className="hover:opacity-70 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {allergyTags.length === 0 && (
                    <span className="text-xs text-[#9A6E6B]">ยังไม่มีประวัติแพ้อาหาร</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag("disliked_food", allergyInput, "allergy");
                      }
                    }}
                    placeholder="พิมพ์สิ่งที่แพ้ เช่น กุ้ง, ถั่วลิสง, นมวัว..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[#EED2D0] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
                  />
                  <button
                    type="button"
                    onClick={() => addTag("disliked_food", allergyInput, "allergy")}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#EED2D0] text-[#9A332E] text-xs font-semibold hover:bg-[#FDF3F2] transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่ม
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {QUICK_ALLERGY_SUGGESTIONS.filter(
                    (s) => !allergyTags.some((t) => t.value === s)
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag("disliked_food", s, "allergy")}
                      className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-[#EED2D0] text-[#9A332E] hover:bg-[#FDF3F2] transition cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white font-semibold text-sm transition flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
        >
          <Save className="w-4 h-4" />
          {submitting ? "กำลังบันทึก..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
