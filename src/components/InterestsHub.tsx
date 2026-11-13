"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Compass,
  Heart,
  HeartHandshake,
  History,
  Palette,
  Pencil,
  PieChart,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Utensils,
  Wand2,
  X,
} from "lucide-react";
import { useApp } from "@/components/AppShell";
import { CategoryDonutChart, PastelBarChart } from "@/components/Charts";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CardGridSkeleton } from "@/components/Skeletons";
import {
  CATEGORY_META,
  CategorySlug,
  EXTRACT_CATEGORY_META,
  ExtractCategorySlug,
} from "@/lib/types";

const REVIEW_CATEGORY_OPTIONS = [
  { key: "food_preferences", label: "อาหารที่ชอบ", badgeCls: "bg-[#FFE4EC]/70 text-[#8F2849] border-[#F4B6CA]" },
  { key: "disliked_food:dislike", label: "อาหารที่ไม่ชอบ", badgeCls: "bg-[#FAF4F0] text-[#7A4A2E] border-[#E8D6C8]" },
  { key: "disliked_food:allergy", label: "อาหารที่แพ้", badgeCls: "bg-[#FDF3F2] text-[#A3322E] border-[#EED2D0]" },
  { key: "dietary_restriction", label: "ข้อจำกัดด้านอาหาร", badgeCls: "bg-[#FFE4EC] text-[#9B294E] border-[#F47FA5]" },
  { key: "hobbies", label: "งานอดิเรก", badgeCls: "bg-[#F4F3F5] text-[#4D4554] border-[#E3DFE6]" },
  { key: "travel_interests", label: "ความสนใจท่องเที่ยว", badgeCls: "bg-[#F7F4EE] text-[#63512E] border-[#E6DEC9]" },
  { key: "lifestyle", label: "ไลฟ์สไตล์", badgeCls: "bg-[#F2F6F4] text-[#325947] border-[#D6E3DC]" },
  { key: "other_interests", label: "ความสนใจอื่น ๆ", badgeCls: "bg-[#F3F5F7] text-[#3E4C61] border-[#DFE3E8]" },
] as const;

function getReviewSelectKey(cat: ExtractCategorySlug, restrictionType?: string | null): string {
  if (cat === "disliked_food") {
    return restrictionType === "allergy" ? "disliked_food:allergy" : "disliked_food:dislike";
  }
  return cat;
}

interface DraftRow {
  extractedId: number;
  tempId: string;
  detected_friend_name: string;
  matched_friend_id: number | null;
  matched_friend_name: string | null;
  category_slug: ExtractCategorySlug;
  raw_value: string;
  normalized_value: string;
  confidence: number;
  is_ambiguous?: boolean;
  uncertainty_reason?: string | null;
  restriction_type?: "allergy" | "dislike" | null;
  already_exists?: boolean;
  overwrite_existing?: boolean;
  selected: boolean;
}

interface ExistingFriendOption {
  id: number;
  full_name: string;
  nickname: string;
}

interface InsightTermItem {
  normalized_value: string;
  category_slug: CategorySlug;
  category_name_th: string;
  friend_count: number;
  allergy_count: number;
  dislike_count: number;
  friends: string[];
}

interface InsightsApiResponse {
  totalFriends: number;
  totalTagLinks: number;
  filteredTerms: InsightTermItem[];
  mostPopularInterests: InsightTermItem[];
  mostPopularFoods: InsightTermItem[];
  dislikesAndAllergies: InsightTermItem[];
  hobbyDistribution: InsightTermItem[];
  travelDistribution: InsightTermItem[];
  lifestyleDistribution: InsightTermItem[];
  categoryDistribution: Array<{
    slug: CategorySlug;
    name_th: string;
    link_count: number;
    unique_terms: number;
    friend_count: number;
  }>;
  similarFriendPairs: Array<{
    friendA: { id: number; nickname: string };
    friendB: { id: number; nickname: string };
    sharedCount: number;
    sharedTags: string[];
  }>;
}

interface ExtractedHistoryRow {
  id: number;
  text_input_id: number;
  friend_id: number | null;
  detected_friend_name: string;
  friend_nickname: string | null;
  friend_full_name: string | null;
  category_slug: ExtractCategorySlug;
  raw_value: string;
  normalized_value: string;
  confidence: number;
  is_ambiguous: number;
  uncertainty_reason: string | null;
  restriction_type: "allergy" | "dislike" | null;
  confirmation_status: string;
  source_label: string;
  created_at: string;
  updated_at?: string;
}

interface HistoryPayload {
  inputs: Array<{
    id: number;
    raw_text: string;
    source_label: string;
    extraction_mode: string;
    status: string;
    created_at: string;
  }>;
  extractedRows: ExtractedHistoryRow[];
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "ยืนยันแล้ว", cls: "bg-[#F1F6F3] text-[#2A6049]" },
  partial: { label: "ยืนยันบางส่วน", cls: "bg-[#FAF7F0] text-[#75571A]" },
  pending_review: { label: "รอตรวจสอบ", cls: "bg-[#F4F2F3] text-[#4A4346]" },
  pending: { label: "รอตรวจสอบ", cls: "bg-[#F4F2F3] text-[#4A4346]" },
  rejected: { label: "ยกเลิก", cls: "bg-[#FDF3F2] text-[#A3322E]" },
};

export function InterestsHub({
  initialTab = "extract",
}: {
  initialTab?: "extract" | "insights";
}) {
  const { notify } = useApp();
  const [tab, setTab] = useState<"extract" | "insights">(initialTab);

  // Extraction state
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("ป้อนข้อความด้วยตนเอง");
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [textInputId, setTextInputId] = useState<number | null>(null);
  const [extractionMode, setExtractionMode] = useState<string>("");
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [existingFriends, setExistingFriends] = useState<ExistingFriendOption[]>([]);
  const [justSavedSummary, setJustSavedSummary] = useState<string>("");

  // Insights & Traceability state
  const [insights, setInsights] = useState<InsightsApiResponse | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [insightCatFilter, setInsightCatFilter] = useState<string>("");
  const [insightSearch, setInsightSearch] = useState<string>("");

  // Traceability inline edit state
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    category_slug: ExtractCategorySlug;
    normalized_value: string;
    detected_friend_name: string;
    restriction_type: "allergy" | "dislike" | "";
    confirmation_status: string;
  }>({
    category_slug: "other_interests",
    normalized_value: "",
    detected_friend_name: "",
    restriction_type: "",
    confirmation_status: "confirmed",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const params = new URLSearchParams();
      if (insightCatFilter) params.set("category", insightCatFilter);
      if (insightSearch.trim()) params.set("q", insightSearch.trim());

      const [iRes, hRes] = await Promise.all([
        fetch(`/api/interests/insights?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/nlp/history", { cache: "no-store" }),
      ]);
      if (iRes.ok) setInsights(await iRes.json());
      if (hRes.ok) setHistory(await hRes.json());
    } finally {
      setLoadingInsights(false);
    }
  }, [insightCatFilter, insightSearch]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  async function handleExtract() {
    if (!rawText.trim()) {
      notify("พิมพ์เล่าเรื่องเพื่อนให้น้องชวนฟังก่อนนะ", "error");
      return;
    }
    setExtracting(true);
    setJustSavedSummary("");
    try {
      const res = await fetch("/api/nlp/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, sourceLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "น้องชวนยังไม่สามารถจัดข้อมูลได้ ลองใหม่อีกครั้งนะ", "error");
        return;
      }
      setTextInputId(data.textInputId);
      setExtractionMode(data.mode);
      setExtractionWarnings(data.warnings || []);
      setDrafts(data.items || []);
      setExistingFriends(data.existingFriends || []);
      if ((data.items || []).length === 0) {
        notify(
          "น้องชวนยังไม่เจอรายละเอียดชัดเจน ลองพิมพ์ชื่อเพื่อนพร้อมสิ่งที่ชอบหรือไม่ชอบอีกนิดนะ",
          "info"
        );
      } else {
        const ambCount = (data.items || []).filter((d: DraftRow) => d.is_ambiguous).length;
        notify(
          ambCount > 0
            ? `น้องชวนจัดข้อมูลให้แล้ว! พบ ${data.items.length} รายการ โดยมี ${ambCount} รายการที่ควรตรวจสอบอีกนิดนะ`
            : "น้องชวนจัดข้อมูลให้แล้ว! ตรวจสอบอีกนิดก่อนบันทึกนะ"
        );
      }
      loadAnalytics();
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirmSave() {
    if (drafts.length === 0) return;
    setConfirming(true);
    try {
      const cleanedDrafts = drafts.filter(
        (d) => !d.selected || d.normalized_value.trim().length > 0
      );
      const res = await fetch("/api/nlp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textInputId, items: cleanedDrafts }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "ไม่สามารถบันทึกข้อมูลได้", "error");
        return;
      }
      const createdMsg =
        data.newlyCreatedFriends?.length > 0
          ? ` · สร้างโปรไฟล์เพื่อนใหม่ ${data.newlyCreatedFriends
              .map((f: { nickname: string }) => f.nickname)
              .join(", ")}`
          : "";
      const skippedMsg =
        data.skippedExistingCount > 0
          ? ` • คงข้อมูลเดิมที่มีอยู่แล้ว ${data.skippedExistingCount} รายการ`
          : "";
      const msg = `บันทึกข้อมูลเพื่อนเพิ่มใหม่ ${data.savedInterestsCount} รายการ${createdMsg}${skippedMsg}`;
      notify(`${msg} เรียบร้อยแล้ว`);
      setJustSavedSummary(msg);
      setDrafts([]);
      setExtractionWarnings([]);
      setTextInputId(null);
      loadAnalytics();
    } finally {
      setConfirming(false);
    }
  }

  function updateDraft(tempId: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)));
  }

  function removeDraft(tempId: string) {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
  }

  function addDraftItemForFriend(friendName: string, matchedFriendId: number | null) {
    const newRow: DraftRow = {
      extractedId: 0,
      tempId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      detected_friend_name: friendName,
      matched_friend_id: matchedFriendId,
      matched_friend_name: null,
      category_slug: "food_preferences",
      raw_value: "",
      normalized_value: "",
      confidence: 1.0,
      is_ambiguous: false,
      uncertainty_reason: null,
      restriction_type: null,
      already_exists: false,
      overwrite_existing: false,
      selected: true,
    };
    setDrafts((prev) => [...prev, newRow]);
  }

  function updateFriendGroupMeta(
    groupKey: string,
    patch: { detected_friend_name?: string; matched_friend_id?: number | null }
  ) {
    setDrafts((prev) =>
      prev.map((d) => {
        const key = d.matched_friend_id ? `id:${d.matched_friend_id}` : `name:${d.detected_friend_name}`;
        return key === groupKey ? { ...d, ...patch } : d;
      })
    );
  }

  function startEditTraceRow(row: ExtractedHistoryRow) {
    setEditingRowId(row.id);
    setEditDraft({
      category_slug: row.category_slug,
      normalized_value: row.normalized_value,
      detected_friend_name: row.detected_friend_name,
      restriction_type: row.restriction_type || "",
      confirmation_status: row.confirmation_status,
    });
  }

  async function saveTraceEdit(id: number) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/nlp/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "อัปเดตรายการไม่สำเร็จ", "error");
        return;
      }
      notify("อัปเดตและเชื่อมโยงข้อมูลไปยังโปรไฟล์เพื่อนเรียบร้อยแล้ว");
      setEditingRowId(null);
      loadAnalytics();
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteTraceRow(id: number) {
    const res = await fetch(`/api/nlp/history/${id}`, { method: "DELETE" });
    if (!res.ok) {
      notify("ลบรายการไม่สำเร็จ", "error");
      return;
    }
    notify("ลบรายการจากประวัติสกัดข้อมูลแล้ว");
    loadAnalytics();
  }

  const groupedDrafts = Array.from(
    drafts
      .reduce((acc, row) => {
        const key = row.matched_friend_id
          ? `id:${row.matched_friend_id}`
          : `name:${row.detected_friend_name}`;
        const existing = acc.get(key);
        if (existing) {
          existing.items.push(row);
        } else {
          acc.set(key, {
            key,
            detected_friend_name: row.detected_friend_name,
            matched_friend_id: row.matched_friend_id,
            items: [row],
          });
        }
        return acc;
      }, new Map<string, { key: string; detected_friend_name: string; matched_friend_id: number | null; items: DraftRow[] }>())
      .values()
  );

  const pageHeading =
    tab === "extract" ? "เล่าเรื่องเพื่อน" : "ความชอบของเพื่อน & ประวัติที่มา";

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#261B20]">{pageHeading}</h1>
          <p className="text-xs text-[#6E5E65] mt-0.5">
            พิมพ์เป็นธรรมชาติ ระบบแยกความชอบและข้อจำกัดอาหารให้อัตโนมัติ
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap sm:inline-flex w-full sm:w-auto gap-1 bg-white p-1.5 rounded-2xl border border-[#F2DFE6] shadow-xs max-w-full">
          <button
            type="button"
            onClick={() => setTab("extract")}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial whitespace-nowrap ${
              tab === "extract" ? "bg-[#E15B87] text-white" : "text-[#4A4346] hover:bg-[#FFF8F3]"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 shrink-0" />
            เล่าเรื่องเพื่อน
          </button>
          <button
            type="button"
            onClick={() => setTab("insights")}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial whitespace-nowrap ${
              tab === "insights" ? "bg-[#E15B87] text-white" : "text-[#4A4346] hover:bg-[#FFF8F3]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            ความชอบ &amp; สถิติ
          </button>
        </div>
      </div>

      {tab === "extract" && (
        <div className="space-y-4 min-w-0">
          {/* 3-Step Visual Workflow Stepper (Minimal pill bar) */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold max-w-full">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE4EC] text-[#8F2849]">
              <span className="w-4 h-4 rounded-full bg-[#E15B87] text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>เล่าเรื่อง</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#C6A9B4] hidden sm:block" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                drafts.length > 0
                  ? "bg-[#FFE4EC] border-[#F5C2D3] text-[#8F2849]"
                  : "bg-white border-[#EAE6E8] text-[#6E5E65]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  drafts.length > 0 ? "bg-[#E15B87] text-white" : "bg-[#EAE6E8] text-[#4A4346]"
                }`}
              >
                2
              </span>
              <span>ตรวจสอบ</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#C6A9B4] hidden sm:block" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                justSavedSummary
                  ? "bg-[#F1F6F3] border-[#D4E3DA] text-[#2A6049]"
                  : "bg-white border-[#EAE6E8] text-[#6E5E65]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  justSavedSummary ? "bg-[#2A6049] text-white" : "bg-[#EAE6E8] text-[#4A4346]"
                }`}
              >
                3
              </span>
              <span>บันทึก</span>
            </div>
          </div>

          {justSavedSummary && (
            <div className="bg-[#F1F6F3] border border-[#D4E3DA] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#2A6049]">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{justSavedSummary}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("insights")}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#D4E3DA] text-[#2A6049] text-xs font-semibold hover:bg-[#FAF9F8] cursor-pointer"
                >
                  ดูข้อมูลและประวัติที่มา
                </button>
                <Link
                  href="/friends"
                  className="px-4 py-2 rounded-xl bg-[#2A6049] text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                >
                  ดูรายชื่อเพื่อน →
                </Link>
              </div>
            </div>
          )}

          {/* Step 1: Text Input */}
          <div className="bg-white rounded-2xl p-6 border border-[#F2DFE6] shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MascotAvatar pose="curious" size="sm" />
                <div>
                  <h2 className="font-bold text-[#261B20] text-base inline-flex items-center gap-1.5">
                    <span>เล่าเรื่องเพื่อนให้น้องชวนฟัง</span>
                    <Heart className="w-4 h-4 text-[#993858] shrink-0" strokeWidth={2} />
                  </h2>
                  <p className="text-xs text-[#6E5E65]">
                    พิมพ์สิ่งที่เพื่อนชอบ ไม่ชอบ หรืออาหารที่แพ้ แล้วให้ระบบช่วยจัดหมวดให้อัตโนมัติ
                  </p>
                </div>
              </div>
              <details className="group sm:text-right">
                <summary className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#EBD6DD] bg-[#FFF8F3] text-[11px] font-medium text-[#6E5E65] hover:text-[#993858] cursor-pointer list-none">
                  <Plus className="w-3 h-3" />
                  <span>{sourceLabel ? `ที่มา: ${sourceLabel}` : "ระบุที่มา (ไม่บังคับ)"}</span>
                </summary>
                <div className="mt-2">
                  <input
                    type="text"
                    aria-label="แหล่งที่มาของข้อความ"
                    value={sourceLabel}
                    onChange={(e) => setSourceLabel(e.target.value)}
                    placeholder="เช่น แชทกลุ่ม หรือบันทึกส่วนตัว"
                    className="w-full sm:w-56 min-w-0 px-3 py-1.5 rounded-xl border border-[#EBD6DD] bg-[#FFF8F3] text-xs font-medium text-[#261B20] placeholder:text-[#A0A0A0]"
                  />
                </div>
              </details>
            </div>

            <textarea
              rows={4}
              aria-label="เล่าเรื่องเพื่อน"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="ตัวอย่าง: แนนชอบกินหมูกระทะ ไม่ชอบอาหารทะเล และชอบไปเที่ยวคาเฟ่"
              className="w-full p-4 rounded-xl border border-[#EBD6DD] bg-white text-sm leading-relaxed text-[#261B20] placeholder:text-[#A0A0A0] placeholder:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
            />


            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#6E5E65]">
                น้องชวนช่วยจัดคำมาตรฐาน แยกอาหารที่ชอบ/ไม่ชอบ/แพ้ และข้อจำกัดด้านอาหารให้อัตโนมัติ
              </p>
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting}
                className="px-6 py-2.5 rounded-xl bg-[#E15B87] hover:bg-[#C84572] text-white font-semibold text-sm shadow-soft transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>{extracting ? "น้องชวนกำลังจัดข้อมูลให้อยู่นะ..." : "ให้น้องชวนช่วยจัดข้อมูล"}</span>
              </button>
            </div>
          </div>

          {/* Extraction Warnings */}
          {extractionWarnings.length > 0 && (
            <div className="bg-[#FFF8F3] border border-[#F0D8B8] rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#75571A]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>ข้อสังเกตจากน้องชวน</span>
              </div>
              <ul className="list-disc list-inside text-xs text-[#75571A] space-y-1">
                {extractionWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 2: Friend-Grouped Editable Review */}
          {drafts.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-[#F47FA5]/55 shadow-soft space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MascotAvatar pose="happy" size="sm" />
                  <div>
                    <h2 className="font-bold text-[#261B20] text-lg inline-flex items-center gap-1.5">
                      <span>น้องชวนเจอข้อมูลเหล่านี้</span>
                      <Sparkles className="w-4 h-4 text-[#993858] shrink-0" strokeWidth={2} />
                    </h2>
                    <p className="text-xs text-[#6E5E65]">
                      ข้อมูลที่น้องชวนพบจัดกลุ่มตามชื่อเพื่อน {groupedDrafts.length} คน รวม {drafts.length} รายการ · แก้ไข เพิ่ม หรือลบก่อนบันทึกได้ตามใจเลย
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addDraftItemForFriend("เพื่อนใหม่", null)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#FFE4EC]/60 hover:bg-[#FFE4EC] border border-[#F4B6CA] text-[#8F2849] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    เพิ่มเพื่อน
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    disabled={confirming}
                    className="px-5 py-2.5 rounded-xl bg-[#261B20] hover:bg-[#3A2D33] text-white text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#FFE4EC]" />
                    {confirming ? "กำลังบันทึก..." : "บันทึกข้อมูลเพื่อน"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6E5E65] bg-[#FFF8F3] px-3.5 py-2 rounded-xl border border-[#F2DFE6]">
                <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#261B20]">
                  <input
                    type="checkbox"
                    aria-label="เลือกทั้งหมด"
                    checked={drafts.every((d) => d.selected)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDrafts((prev) => prev.map((d) => ({ ...d, selected: checked })));
                    }}
                    className="w-4 h-4 accent-[#E15B87] cursor-pointer"
                  />
                  <span>เลือกทุกรายการก่อนบันทึก</span>
                </label>
                <span className="tabular-nums">
                  กำลังเลือก {drafts.filter((d) => d.selected).length} จาก {drafts.length} รายการ
                </span>
              </div>

              <div className="space-y-4">
                {groupedDrafts.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-[#F2DFE6] bg-[#FFF8F3]/60 p-4 space-y-3"
                  >
                    {/* Friend Card Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#F2DFE6] min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE4EC] text-[#8F2849] font-bold text-sm flex items-center justify-center shrink-0">
                          {(group.detected_friend_name || "?").slice(0, 2)}
                        </div>
                        <input
                          type="text"
                          aria-label="ชื่อเพื่อน"
                          value={group.detected_friend_name}
                          onChange={(e) =>
                            updateFriendGroupMeta(group.key, {
                              detected_friend_name: e.target.value,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-[#EBD6DD] bg-white text-sm font-bold text-[#261B20] w-full sm:w-44 min-w-0"
                        />
                        <select
                          aria-label="จับคู่กับเพื่อนที่มีอยู่"
                          value={group.matched_friend_id ?? ""}
                          onChange={(e) =>
                            updateFriendGroupMeta(group.key, {
                              matched_friend_id: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-[#EBD6DD] bg-white text-xs text-[#261B20] w-full sm:w-auto max-w-full min-w-0"
                        >
                          <option value="">
                            + สร้างโปรไฟล์เพื่อนใหม่: {group.detected_friend_name}
                          </option>
                          {existingFriends.map((ef) => (
                            <option key={ef.id} value={ef.id}>
                              เชื่อมโยง: {ef.nickname} · {ef.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          addDraftItemForFriend(group.detected_friend_name, group.matched_friend_id)
                        }
                        className="self-start md:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#EBD6DD] hover:border-[#F47FA5] text-xs font-semibold text-[#8F2849] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่มรายการ
                      </button>
                    </div>

                    {/* Extracted Items under this Friend */}
                    <div className="space-y-2">
                      {group.items.map((row) => {
                        const selectKey = getReviewSelectKey(row.category_slug, row.restriction_type);
                        const catMeta =
                          REVIEW_CATEGORY_OPTIONS.find((o) => o.key === selectKey) ||
                          REVIEW_CATEGORY_OPTIONS[7];
                        return (
                          <div
                            key={row.tempId}
                            className={`rounded-xl border p-3 bg-white flex flex-col lg:flex-row lg:items-center gap-2.5 transition-opacity ${
                              !row.selected
                                ? "opacity-55 border-[#EAE6E8]"
                                : row.is_ambiguous
                                  ? "border-[#E8DFCB] bg-[#FFFDF8]"
                                  : "border-[#F0E3E8]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap min-w-0">
                              <input
                                type="checkbox"
                                aria-label={`เลือกรายการ ${row.normalized_value}`}
                                checked={row.selected}
                                onChange={(e) =>
                                  updateDraft(row.tempId, { selected: e.target.checked })
                                }
                                className="w-4 h-4 accent-[#E15B87] cursor-pointer shrink-0"
                              />
                              <select
                                aria-label="หมวดหมู่ความสนใจ"
                                value={selectKey}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "disliked_food:allergy") {
                                    updateDraft(row.tempId, {
                                      category_slug: "disliked_food",
                                      restriction_type: "allergy",
                                    });
                                  } else if (val === "disliked_food:dislike") {
                                    updateDraft(row.tempId, {
                                      category_slug: "disliked_food",
                                      restriction_type: "dislike",
                                    });
                                  } else {
                                    updateDraft(row.tempId, {
                                      category_slug: val as ExtractCategorySlug,
                                      restriction_type: null,
                                    });
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold shrink-0 ${catMeta.badgeCls}`}
                              >
                                {REVIEW_CATEGORY_OPTIONS.map((opt) => (
                                  <option key={opt.key} value={opt.key} className="bg-white text-[#261B20]">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                aria-label="ข้อความที่จัดเรียบร้อยแล้ว"
                                value={row.normalized_value}
                                placeholder="พิมพ์รายละเอียด เช่น ไก่ย่าง หรือ ต้องการอาหารฮาลาล"
                                onChange={(e) =>
                                  updateDraft(row.tempId, {
                                    normalized_value: e.target.value,
                                    raw_value: row.raw_value || e.target.value,
                                  })
                                }
                                className="flex-1 min-w-[160px] px-3 py-1.5 rounded-xl border border-[#EBD6DD] text-xs font-semibold text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]"
                              />
                            </div>

                            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pl-6 lg:pl-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {row.raw_value && row.raw_value !== row.normalized_value && (
                                  <span className="text-[11px] text-[#6E5E65]">
                                    จากคำว่า “{row.raw_value}”
                                  </span>
                                )}
                                {row.is_ambiguous && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F0] border border-[#E8DFCB] text-[#75571A] text-[10px] font-semibold">
                                    <AlertTriangle className="w-3 h-3" />
                                    {row.uncertainty_reason || "ควรตรวจสอบ"}
                                  </span>
                                )}
                                {row.already_exists && (
                                  <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4F2F3] text-[#4A4346] border border-[#EAE6E8] text-[10px] font-medium cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.overwrite_existing)}
                                      onChange={(e) =>
                                        updateDraft(row.tempId, { overwrite_existing: e.target.checked })
                                      }
                                      className="w-3 h-3 accent-[#E15B87]"
                                    />
                                    <span>มีในระบบแล้ว · อัปเดตทับ</span>
                                  </label>
                                )}
                              </div>
                              <button
                                type="button"
                                aria-label={`ลบรายการ ${row.normalized_value}`}
                                onClick={() => removeDraft(row.tempId)}
                                className="p-1.5 rounded-lg text-[#A3322E] hover:bg-[#FDF3F2] cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "insights" && (
        <div className="space-y-6">
          {/* Structured Interest Filter Bar */}
          <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#1F1A1C] text-base">
                  สำรวจความสนใจที่จัดหมวดหมู่แล้วจากฐานข้อมูล
                </h2>
                <p className="text-xs text-[#6E666A]">
                  รายชื่อเพื่อน {insights?.totalFriends ?? 0} คน • ข้อมูลความชอบและข้อจำกัดด้านอาหาร{" "}
                  {insights?.totalTagLinks ?? 0} รายการ
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#6E666A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={insightSearch}
                    onChange={(e) => setInsightSearch(e.target.value)}
                    placeholder="ค้นหาคำหรือชื่อเพื่อน"
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-xs font-medium text-[#1F1A1C]"
                  />
                </div>
                <select
                  aria-label="กรองตามหมวดหมู่ความสนใจ"
                  value={insightCatFilter}
                  onChange={(e) => setInsightCatFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[#DED8DA] bg-[#FAF9F8] text-xs font-medium text-[#1F1A1C]"
                >
                  <option value="">ทุกหมวดหมู่</option>
                  {Object.values(CATEGORY_META).map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name_th}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingInsights ? (
              <CardGridSkeleton count={3} />
            ) : insights && insights.filteredTerms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {insights.filteredTerms.slice(0, 32).map((item) => {
                  const meta = CATEGORY_META[item.category_slug];
                  return (
                    <div
                      key={`${item.category_slug}-${item.normalized_value}`}
                      title={`เพื่อน: ${item.friends.join(", ")}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                    >
                      <span>{item.normalized_value}</span>
                      {item.allergy_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#A3322E] text-white text-[10px]">
                          แพ้ {item.allergy_count}
                        </span>
                      )}
                      <span className="opacity-75 text-[11px] font-semibold tabular-nums">
                        · {item.friend_count} คน
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#6E666A]">ไม่พบข้อมูลความสนใจตามเงื่อนไขที่เลือก</p>
            )}
          </div>

          {insights && (
            <>
              {/* Main Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
                  <h2 className="font-bold text-[#1F1A1C] flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#B3486B]" />
                    <span>อาหารยอดนิยมเปรียบเทียบกับข้อจำกัดและอาหารที่ไม่ชอบ</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-semibold text-[#2A6049] mb-2">อาหารที่เพื่อนชื่นชอบ</p>
                      <PastelBarChart
                        items={insights.mostPopularFoods.slice(0, 7).map((i) => ({
                          label: i.normalized_value,
                          value: i.friend_count,
                          color: "#B3486B",
                        }))}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#A3322E] mb-2">สิ่งที่ไม่ชอบหรือแพ้อาหาร</p>
                      <PastelBarChart
                        items={insights.dislikesAndAllergies.slice(0, 7).map((i) => ({
                          label:
                            i.allergy_count > 0
                              ? `${i.normalized_value} · แพ้`
                              : i.normalized_value,
                          value: i.friend_count,
                          color: "#A3322E",
                        }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
                  <h2 className="font-bold text-[#1F1A1C] flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#8D8298]" />
                    <span>การกระจายตัวของความสนใจตามหมวดหมู่</span>
                  </h2>
                  <CategoryDonutChart
                    items={insights.categoryDistribution.map((c) => ({
                      slug: c.slug,
                      name_th: c.name_th,
                      color: CATEGORY_META[c.slug]?.color || "#B3486B",
                      count: c.link_count,
                    }))}
                  />
                </div>
              </div>

              {/* Hobbies, Travel & Lifestyle Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3">
                  <h3 className="font-bold text-sm text-[#1F1A1C] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#8D8298]" />
                    <span>งานอดิเรกยอดนิยม</span>
                  </h3>
                  <PastelBarChart
                    items={insights.hobbyDistribution.slice(0, 5).map((i) => ({
                      label: i.normalized_value,
                      value: i.friend_count,
                      color: "#8D8298",
                    }))}
                  />
                </div>
                <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3">
                  <h3 className="font-bold text-sm text-[#1F1A1C] flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#668096]" />
                    <span>แนวทางการท่องเที่ยวยอดนิยม</span>
                  </h3>
                  <PastelBarChart
                    items={insights.travelDistribution.slice(0, 5).map((i) => ({
                      label: i.normalized_value,
                      value: i.friend_count,
                      color: "#668096",
                    }))}
                  />
                </div>
                <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3">
                  <h3 className="font-bold text-sm text-[#1F1A1C] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#9D8866]" />
                    <span>ไลฟ์สไตล์ของกลุ่มเพื่อน</span>
                  </h3>
                  <PastelBarChart
                    items={insights.lifestyleDistribution.slice(0, 5).map((i) => ({
                      label: i.normalized_value,
                      value: i.friend_count,
                      color: "#9D8866",
                    }))}
                  />
                </div>
              </div>

              {/* Similar Friend Pairs */}
              <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4">
                <h2 className="font-bold text-[#1F1A1C] flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-[#B3486B]" />
                  <span>รายชื่อเพื่อนที่มีความสนใจร่วมกันมากที่สุด</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {insights.similarFriendPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-sm text-[#1F1A1C]">
                          <Link
                            href={`/friends/${pair.friendA.id}`}
                            className="hover:text-[#8F3553]"
                          >
                            {pair.friendA.nickname}
                          </Link>{" "}
                          และ{" "}
                          <Link
                            href={`/friends/${pair.friendB.id}`}
                            className="hover:text-[#8F3553]"
                          >
                            {pair.friendB.nickname}
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {pair.sharedTags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F9F2F5] text-[#8F3553] border border-[#E8D5DD]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-white border border-[#EAE6E8] text-xs font-semibold text-[#8F3553] shrink-0">
                        ตรงกัน {pair.sharedCount} รายการ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Data Traceability Log with Edit & Reclassify */}
          {history && (
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#EAE6E8] shadow-card space-y-4 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#6E666A]" />
                  <h2 className="font-bold text-[#1F1A1C]">
                    ประวัติการเล่าเรื่องเพื่อนและที่มา · {history.extractedRows.length} รายการล่าสุด
                  </h2>
                </div>
                <span className="text-xs text-[#6E666A]">
                  แก้ไขหรือปรับเปลี่ยนหมวดหมู่ได้ตลอดเวลา
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EAE6E8] text-[#6E666A]">
                      <th className="py-2 px-2">เพื่อน</th>
                      <th className="py-2 px-2">หมวดหมู่</th>
                      <th className="py-2 px-2">คำตั้งต้น</th>
                      <th className="py-2 px-2">คำมาตรฐาน</th>
                      <th className="py-2 px-2">ที่มาและสถานะ</th>
                      <th className="py-2 px-2">เวลา</th>
                      <th className="py-2 px-2 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECEE]">
                    {history.extractedRows.slice(0, 40).map((r) => {
                      const isEditing = editingRowId === r.id;
                      const badge = STATUS_BADGES[r.confirmation_status] || STATUS_BADGES.pending;

                      if (isEditing) {
                        return (
                          <tr key={r.id} className="bg-[#FAF9F8]">
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={editDraft.detected_friend_name}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    detected_friend_name: e.target.value,
                                  }))
                                }
                                className="w-28 px-2 py-1 rounded-lg border border-[#DED8DA] bg-white font-semibold"
                              />
                            </td>
                            <td className="py-2 px-2 space-y-1">
                              <select
                                value={editDraft.category_slug}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    category_slug: e.target.value as ExtractCategorySlug,
                                  }))
                                }
                                className="px-2 py-1 rounded-lg border border-[#DED8DA] bg-white font-medium"
                              >
                                {Object.values(EXTRACT_CATEGORY_META).map((c) => (
                                  <option key={c.slug} value={c.slug}>
                                    {c.name_th}
                                  </option>
                                ))}
                              </select>
                              {editDraft.category_slug === "disliked_food" && (
                                <select
                                  value={editDraft.restriction_type || "dislike"}
                                  onChange={(e) =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      restriction_type:
                                        e.target.value === "allergy" ? "allergy" : "dislike",
                                    }))
                                  }
                                  className="block px-2 py-1 rounded-lg border border-[#EED2D0] bg-[#FDF3F2] text-[#A3322E] font-medium"
                                >
                                  <option value="dislike">ไม่ชอบ</option>
                                  <option value="allergy">แพ้อาหาร</option>
                                </select>
                              )}
                            </td>
                            <td className="py-2 px-2 text-[#6E666A]">{r.raw_value}</td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={editDraft.normalized_value}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    normalized_value: e.target.value,
                                  }))
                                }
                                className="w-32 px-2 py-1 rounded-lg border border-[#DED8DA] bg-white font-semibold text-[#8F3553]"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={editDraft.confirmation_status}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    confirmation_status: e.target.value,
                                  }))
                                }
                                className="px-2 py-1 rounded-lg border border-[#DED8DA] bg-white font-medium"
                              >
                                <option value="confirmed">ยืนยันแล้ว</option>
                                <option value="pending">รอตรวจสอบ</option>
                                <option value="rejected">ยกเลิก</option>
                              </select>
                            </td>
                            <td className="py-2 px-2 text-[#6E666A]">
                              {(r.updated_at || r.created_at).slice(0, 16)}
                            </td>
                            <td className="py-2 px-2 text-right space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={() => saveTraceEdit(r.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2A6049] text-white font-semibold cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                บันทึก
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRowId(null)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#DED8DA] text-[#4A4346] cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={r.id}>
                          <td className="py-2 px-2 font-semibold text-[#1F1A1C]">
                            {r.friend_id ? (
                              <Link href={`/friends/${r.friend_id}`} className="hover:text-[#8F3553]">
                                {r.friend_nickname || r.detected_friend_name}
                              </Link>
                            ) : (
                              r.detected_friend_name
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <span>{EXTRACT_CATEGORY_META[r.category_slug]?.name_th || r.category_slug}</span>
                            {r.restriction_type === "allergy" && (
                              <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FDF3F2] text-[#A3322E] text-[10px] font-semibold border border-[#EED2D0]">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                แพ้
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-[#6E666A]">{r.raw_value}</td>
                          <td className="py-2 px-2 font-semibold text-[#8F3553]">
                            {r.normalized_value}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-[#6E666A]">{r.source_label}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-[#6E666A] whitespace-nowrap">
                            {(r.updated_at || r.created_at).slice(0, 16)}
                          </td>
                          <td className="py-2 px-2 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              aria-label={`แก้ไขรายการ ${r.normalized_value}`}
                              onClick={() => startEditTraceRow(r)}
                              className="p-1.5 rounded-lg text-[#4A4346] hover:bg-[#F4F2F3] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`ลบรายการ ${r.normalized_value}`}
                              onClick={() => deleteTraceRow(r.id)}
                              className="p-1.5 rounded-lg text-[#A3322E] hover:bg-[#FDF3F2] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
