"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Heart,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Utensils,
  X,
} from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import { CardGridSkeleton } from "@/components/Skeletons";
import {
  CATEGORY_META,
  CategorySlug,
  DIETARY_RESTRICTION_OPTIONS,
  FriendRecord,
  RELIGION_OPTIONS,
} from "@/lib/types";

interface ConnectUserItem {
  user_id: number;
  name: string;
  nickname: string;
  email: string;
  avatar_color: string;
  connection_status: "connected" | "outgoing_pending" | "incoming_pending" | "none";
  friend_id: number | null;
  pending_request_id: number | null;
}

interface PendingConnectRequest {
  id: number;
  sender_user_id: number;
  receiver_user_id: number;
  other_name: string;
  other_nickname: string;
  other_email: string;
  other_avatar_color: string;
  message: string | null;
}

const QUICK_INTEREST_PILLS = ["หมูกระทะ", "ชาบู", "คาเฟ่", "ทะเล", "บอร์ดเกม", "ดูหนัง"];

function FriendsListContent() {
  const { notify } = useApp();
  const searchParams = useSearchParams();
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [interestPill, setInterestPill] = useState(() => searchParams.get("interest") || "");
  const [dietaryFilter, setDietaryFilter] = useState(() => searchParams.get("dietary") || "");
  const [category, setCategory] = useState(() => searchParams.get("category") || "");
  const [religionFilter, setReligionFilter] = useState(() => searchParams.get("religion") || "");
  const [allergyFilter, setAllergyFilter] = useState(() => searchParams.get("allergy") || "");
  const [sort, setSort] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(() =>
    Boolean(
      searchParams.get("dietary") ||
        searchParams.get("category") ||
        searchParams.get("religion") ||
        searchParams.get("allergy")
    )
  );

  // Account-based Add Friend & Requests panel
  const [showConnectPanel, setShowConnectPanel] = useState(() => searchParams.get("add") === "1");
  const [accountQuery, setAccountQuery] = useState("");
  const [searchingAccounts, setSearchingAccounts] = useState(false);
  const [accountResults, setAccountResults] = useState<ConnectUserItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingConnectRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingConnectRequest[]>([]);
  const [busyConnectKey, setBusyConnectKey] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (interestPill) params.set("interest", interestPill);
      if (dietaryFilter) params.set("dietary", dietaryFilter);
      if (category) params.set("category", category);
      if (religionFilter) params.set("religion", religionFilter);
      if (allergyFilter) params.set("allergy", allergyFilter);
      params.set("sort", sort);
      const res = await fetch(`/api/friends?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, interestPill, dietaryFilter, category, religionFilter, allergyFilter, sort]);

  useEffect(() => {
    const timer = setTimeout(loadFriends, 160);
    return () => clearTimeout(timer);
  }, [loadFriends]);

  const loadConnectState = useCallback(async (queryText: string) => {
    setSearchingAccounts(true);
    try {
      const res = await fetch(`/api/friends/connect?q=${encodeURIComponent(queryText.trim())}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setAccountResults(data.users || []);
      setIncomingRequests(data.incomingRequests || []);
      setOutgoingRequests(data.outgoingRequests || []);
    } finally {
      setSearchingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadConnectState("");
  }, [loadConnectState]);

  async function handleConnectAction(
    key: string,
    payload: {
      action: "request" | "accept" | "reject" | "cancel";
      targetUserId?: number;
      requestId?: number;
    }
  ) {
    setBusyConnectKey(key);
    try {
      const res = await fetch("/api/friends/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "ดำเนินการไม่สำเร็จ", "error");
        return;
      }
      if (payload.action === "request") {
        notify(
          data.status === "accepted"
            ? "เชื่อมต่อเป็นเพื่อนและซิงก์โปรไฟล์เรียบร้อยแล้ว"
            : "ส่งคำขอเป็นเพื่อนเรียบร้อยแล้ว",
          "success"
        );
      } else if (payload.action === "accept") {
        notify("ยอมรับเป็นเพื่อนเรียบร้อย ซิงก์ข้อมูลจากโปรไฟล์เพื่อนแล้ว", "success");
      } else if (payload.action === "reject") {
        notify("ปฏิเสธคำขอแล้ว", "info");
      } else {
        notify("ยกเลิกคำขอแล้ว", "info");
      }
      await Promise.all([loadConnectState(accountQuery), loadFriends()]);
    } finally {
      setBusyConnectKey(null);
    }
  }

  async function handleCreateInviteLink() {
    setShowConnectPanel(true);
    setBusyConnectKey("invite-link");
    try {
      const res = await fetch("/api/invitations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "ลิงก์ชวนเพื่อนเข้า CHUAN-DI และซิงก์โปรไฟล์",
        }),
      });
      if (!res.ok) {
        notify("สร้างลิงก์เชิญไม่สำเร็จ", "error");
        return;
      }
      const data = await res.json();
      setInviteUrl(`${window.location.origin}/invite/${data.invitation.invite_token}`);
      notify("สร้างลิงก์ชวนเพื่อนเรียบร้อย", "success");
    } finally {
      setBusyConnectKey(null);
    }
  }

  const activeAdvancedFilterCount = [dietaryFilter, category, religionFilter, allergyFilter].filter(
    Boolean
  ).length;
  const hasFilters = Boolean(q || interestPill || activeAdvancedFilterCount > 0);

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#261B20]">เพื่อนของฉัน</h1>
          <p className="text-xs text-[#6E5E65] mt-0.5">
            ดูความชอบและข้อจำกัดด้านอาหารจากโปรไฟล์ที่เพื่อนกรอกเอง (ซิงก์อัตโนมัติ)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateInviteLink}
            disabled={busyConnectKey === "invite-link"}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#F0DCE3] hover:border-[#F47FA5] text-xs sm:text-sm font-semibold text-[#261B20] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Link2 className="w-4 h-4 text-[#A34263]" />
            ส่งลิงก์ชวนเพื่อนเข้าแอป
          </button>
          <button
            type="button"
            onClick={() => setShowConnectPanel((v) => !v)}
            className="px-4 py-2 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white text-xs sm:text-sm font-semibold shadow-soft transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
          >
            <UserPlus className="w-4 h-4" />
            <span>แอดเพื่อนในแอป</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white text-[#A34263] text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Add Friend by CHUAN-DI Account Panel */}
      {showConnectPanel && (
        <div className="bg-white rounded-2xl p-5 border border-[#F4C4D5] shadow-soft space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#261B20] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#B3486B]" />
                <span>แอดเพื่อนจากบัญชีผู้ใช้ CHUAN-DI</span>
              </h2>
              <p className="text-xs text-[#6E5E65] mt-0.5">
                ค้นหาเพื่อนด้วยอีเมลหรือชื่อเล่น เมื่อตอบรับเป็นเพื่อน ข้อมูลความชอบ อาหารที่แพ้ และวันว่างจะซิงก์มาให้อัตโนมัติ
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectPanel(false)}
              className="p-1.5 rounded-lg text-[#6E5E65] hover:bg-[#FFF3F6] cursor-pointer"
              aria-label="ปิดหน้าต่างแอดเพื่อน"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadConnectState(accountQuery);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6E5E65] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={accountQuery}
                onChange={(e) => setAccountQuery(e.target.value)}
                placeholder="พิมพ์อีเมลหรือชื่อเล่นเพื่อน เช่น bow@gmail.com หรือ โบว์"
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-xs sm:text-sm text-[#261B20] focus:outline-none focus:ring-2 focus:ring-[#F47FA5]/30 focus:border-[#F47FA5]"
              />
            </div>
            <button
              type="submit"
              disabled={searchingAccounts}
              className="px-4 py-2 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {searchingAccounts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              ค้นหาเพื่อนในระบบ
            </button>
          </form>

          {/* Search Results */}
          {accountQuery.trim() && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#6E5E65]">
                ผลการค้นหาบัญชี ({accountResults.length})
              </div>
              {accountResults.length === 0 && !searchingAccounts ? (
                <div className="p-3.5 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#6E5E65]">
                  <span>ไม่พบบัญชีผู้ใช้ที่ตรงกับ &ldquo;{accountQuery.trim()}&rdquo; เพื่อนอาจยังไม่ได้สมัคร CHUAN-DI</span>
                  <button
                    type="button"
                    onClick={handleCreateInviteLink}
                    className="text-[#8F3553] font-semibold underline cursor-pointer shrink-0"
                  >
                    สร้างลิงก์ชวนเพื่อนสมัครแอป
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {accountResults.map((u) => (
                    <div
                      key={u.user_id}
                      className="p-3 rounded-xl bg-[#FFF9FA] border border-[#F0DCE3] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-[#261B20] shrink-0"
                          style={{ backgroundColor: u.avatar_color || "#D69DAE" }}
                        >
                          {u.nickname.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#261B20] truncate">
                            {u.nickname} {u.name !== u.nickname ? `(${u.name})` : ""}
                          </div>
                          <div className="text-[11px] text-[#6E5E65] truncate">{u.email}</div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {u.connection_status === "connected" && u.friend_id ? (
                          <Link
                            href={`/friends/${u.friend_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E6F4EC] text-[#1F5E3B] text-xs font-semibold border border-[#BBE0C8]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            เป็นเพื่อนแล้ว
                          </Link>
                        ) : u.connection_status === "incoming_pending" && u.pending_request_id ? (
                          <button
                            type="button"
                            disabled={busyConnectKey === `accept-${u.pending_request_id}`}
                            onClick={() =>
                              handleConnectAction(`accept-${u.pending_request_id}`, {
                                action: "accept",
                                requestId: u.pending_request_id!,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold cursor-pointer"
                          >
                            ยอมรับเป็นเพื่อน
                          </button>
                        ) : u.connection_status === "outgoing_pending" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F4F2F3] text-[#6E666A] text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            รอเพื่อนตอบรับ
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyConnectKey === `req-${u.user_id}`}
                            onClick={() =>
                              handleConnectAction(`req-${u.user_id}`, {
                                action: "request",
                                targetUserId: u.user_id,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#F47FA5] hover:bg-[#E0688F] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            แอดเพื่อน
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Incoming Friend Requests */}
          {incomingRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#F4E6EB]">
              <div className="text-xs font-bold text-[#8F2849] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                คำขอเป็นเพื่อนที่รอตอบรับ ({incomingRequests.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {incomingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-[#FFF6F9] border border-[#F5C2D3] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#261B20] truncate">
                        {r.other_nickname} ({r.other_name})
                      </div>
                      <div className="text-[11px] text-[#6E5E65] truncate">{r.other_email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyConnectKey === `accept-${r.id}`}
                        onClick={() =>
                          handleConnectAction(`accept-${r.id}`, {
                            action: "accept",
                            requestId: r.id,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#2A6049] hover:bg-[#1F4A37] text-white text-xs font-semibold cursor-pointer"
                      >
                        ยอมรับ
                      </button>
                      <button
                        type="button"
                        disabled={busyConnectKey === `reject-${r.id}`}
                        onClick={() =>
                          handleConnectAction(`reject-${r.id}`, {
                            action: "reject",
                            requestId: r.id,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E8] text-[#6E666A] text-xs font-semibold cursor-pointer"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Pending Requests */}
          {outgoingRequests.length > 0 && (
            <div className="pt-2 border-t border-[#F4E6EB] flex flex-wrap items-center gap-2 text-xs text-[#6E5E65]">
              <span className="font-semibold">คำขอที่คุณส่งไป ({outgoingRequests.length}):</span>
              {outgoingRequests.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF9F8] border border-[#EAE6E8]"
                >
                  <span>{r.other_nickname} ({r.other_email})</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleConnectAction(`cancel-${r.id}`, {
                        action: "cancel",
                        requestId: r.id,
                      })
                    }
                    className="text-[#9A332E] hover:underline cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Shareable invite link for friends who don't have an account yet */}
          {inviteUrl && (
            <div className="p-3.5 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#8F3553]">
                  ส่งลิงก์นี้ให้เพื่อนสมัครใช้งาน CHUAN-DI และกรอกโปรไฟล์ตัวเอง:
                </div>
                <div className="text-xs font-mono text-[#1F1A1C] truncate">{inviteUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#B3486B] hover:bg-[#993858] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedInvite ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Minimal Search, Collapsible Filters & View Toggle */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-[#F4E6EB] space-y-3 min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-[#6E5E65] absolute left-3.5 top-3" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="ค้นหาเพื่อน"
              placeholder="ค้นหาชื่อ ความชอบ หรืออาหารที่แพ้..."
              className="w-full max-w-full min-w-0 pl-10 pr-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-sm text-[#261B20] focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 ${
              showFilters || activeAdvancedFilterCount > 0
                ? "bg-[#FFF0F5] border-[#F47FA5] text-[#8F2849]"
                : "bg-[#FFF9FA] border-[#F0DCE3] text-[#4A3B41] hover:border-[#F47FA5]"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>ตัวกรอง</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#F47FA5] text-white text-[10px] font-bold leading-none">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>

          <div className="inline-flex bg-[#FFF9FA] p-1 rounded-xl border border-[#F4E6EB] shrink-0">
            <button
              type="button"
              aria-label="มุมมองการ์ด"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === "grid" ? "bg-[#F47FA5] text-white" : "text-[#6E5E65]"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="มุมมองตาราง"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === "table" ? "bg-[#F47FA5] text-white" : "text-[#6E5E65]"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progressive Disclosure Filter Drawer */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#F4E6EB]">
            <select
              aria-label="กรองข้อจำกัดด้านอาหาร"
              value={dietaryFilter}
              onChange={(e) => setDietaryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-xs font-medium text-[#261B20] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <option value="">ข้อจำกัดด้านอาหาร: ทั้งหมด</option>
              {DIETARY_RESTRICTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองตามศาสนา"
              value={religionFilter}
              onChange={(e) => setReligionFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-xs font-medium text-[#261B20] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <option value="">ทุกศาสนา</option>
              {RELIGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "ไม่ระบุ" ? "ไม่ระบุศาสนา" : r}
                </option>
              ))}
            </select>

            <select
              aria-label="กรองประวัติแพ้อาหาร"
              value={allergyFilter}
              onChange={(e) => setAllergyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-xs font-medium text-[#261B20] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <option value="">อาหารที่แพ้: ทั้งหมด</option>
              <option value="only">มีอาหารที่แพ้</option>
              <option value="none">ไม่มีอาหารที่แพ้</option>
            </select>

            <select
              aria-label="กรองตามหมวดหมู่"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0DCE3] bg-[#FFF9FA] text-xs font-medium text-[#261B20] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <option value="">ทุกหมวดความสนใจ</option>
              {Object.values(CATEGORY_META).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name_th}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-[#6E5E65] mr-1">กรองด่วน:</span>
            {QUICK_INTEREST_PILLS.map((pill) => {
              const active = interestPill === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setInterestPill(active ? "" : pill)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#F47FA5] text-white border-[#F47FA5]"
                      : "bg-[#FFF9FA] text-[#4A3B41] border-[#F0DCE3] hover:border-[#F47FA5]"
                  }`}
                >
                  {pill}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E5E65]">
            <select
              aria-label="เรียงลำดับเพื่อน"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-[#F0DCE3] bg-[#FFF9FA] text-xs font-medium text-[#261B20] cursor-pointer"
            >
              <option value="recent">เพิ่มล่าสุด</option>
              <option value="name">เรียงตามชื่อเล่น</option>
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setInterestPill("");
                  setDietaryFilter("");
                  setCategory("");
                  setReligionFilter("");
                  setAllergyFilter("");
                }}
                className="inline-flex items-center gap-1 text-[#A34263] font-semibold hover:underline cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                ล้างตัวกรอง
              </button>
            )}
            <span className="font-semibold tabular-nums">พบ {friends.length} คน</span>
          </div>
        </div>
      </div>

      {/* Friends Content */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : friends.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#EAE6E8] text-center space-y-4">
          <div className="flex justify-center">
            <MascotAvatar pose={hasFilters ? "curious" : "sleepy"} size="lg" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#1F1A1C]">ไม่พบข้อมูลรายชื่อเพื่อนตามเงื่อนไข</h3>
            <p className="text-sm text-[#6E666A] mt-1">
              กรุณาปรับเปลี่ยนเงื่อนไขการค้นหา หรือแอดเพื่อนที่ใช้ CHUAN-DI ด้วยกัน
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConnectPanel(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            แอดเพื่อนในแอป
          </button>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card overflow-x-auto max-w-full min-w-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#F4E6EB] bg-[#FFF9FA] text-xs font-semibold text-[#6E5E65]">
                <th className="py-3.5 px-4">ชื่อเพื่อน</th>
                <th className="py-3.5 px-4">ข้อจำกัดด้านอาหาร</th>
                <th className="py-3.5 px-4">ความชอบของเพื่อน</th>
                <th className="py-3.5 px-4">อาหารที่แพ้และอาหารที่ไม่ชอบ</th>
                <th className="py-3.5 px-4 text-right">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F6EAF0]">
              {friends.map((friend) => {
                const likes = friend.interests.filter((i) => i.category_slug !== "disliked_food");
                const allergies = friend.interests.filter(
                  (i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy"
                );
                const dislikes = friend.interests.filter(
                  (i) => i.category_slug === "disliked_food" && i.restriction_type !== "allergy"
                );
                const dietaryList = friend.dietary_restrictions || [];
                return (
                  <tr key={friend.id} className="hover:bg-[#FFF9FA] transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/friends/${friend.id}`}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-[#261B20] shrink-0"
                          style={{ backgroundColor: friend.avatar_color }}
                        >
                          {friend.nickname.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#261B20]">{friend.nickname}</span>
                            {friend.religion && friend.religion !== "ไม่ระบุ" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF3F6] text-[#6E5E65] border border-[#F0DCE3]">
                                {friend.religion}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#6E5E65]">{friend.full_name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs max-w-xs space-y-1.5">
                      {dietaryList.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {dietaryList.map((d) => (
                            <span
                              key={d.id}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
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
                        </div>
                      )}
                      {friend.can_eat && (
                        <div className="text-[#2A6049]">
                          <strong>ทานได้:</strong> {friend.can_eat}
                        </div>
                      )}
                      {friend.cannot_eat && (
                        <div className="text-[#9A332E]">
                          <strong>เลี่ยง:</strong> {friend.cannot_eat}
                        </div>
                      )}
                      {dietaryList.length === 0 && !friend.can_eat && !friend.cannot_eat && (
                        <span className="text-[#9E9599]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {likes.slice(0, 5).map((item) => {
                          const meta = CATEGORY_META[item.category_slug as CategorySlug];
                          return (
                            <span
                              key={item.id}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`}
                            >
                              {item.normalized_value}
                            </span>
                          );
                        })}
                        {likes.length > 5 && (
                          <span className="text-[11px] text-[#6E5E65]">+{likes.length - 5}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {allergies.length === 0 && dislikes.length === 0 ? (
                        <span className="text-xs text-[#9E9599]">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {allergies.map((d) => (
                            <span
                              key={d.id}
                              className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B53D37] text-white"
                            >
                              แพ้ {d.normalized_value}
                            </span>
                          ))}
                          {dislikes.map((d) => (
                            <span
                              key={d.id}
                              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]"
                            >
                              ไม่ชอบ {d.normalized_value}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/friends/${friend.id}`}
                        className="text-xs font-semibold text-[#A34263] hover:underline cursor-pointer"
                      >
                        ดูข้อมูล →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {friends.map((friend) => {
            const foodLikes = friend.interests.filter((i) => i.category_slug === "food_preferences");
            const otherLikes = friend.interests.filter(
              (i) => i.category_slug !== "disliked_food" && i.category_slug !== "food_preferences"
            );
            const allergies = friend.interests.filter(
              (i) => i.category_slug === "disliked_food" && i.restriction_type === "allergy"
            );
            const dislikes = friend.interests.filter(
              (i) => i.category_slug === "disliked_food" && i.restriction_type !== "allergy"
            );
            const dietaryList = friend.dietary_restrictions || [];

            const topLikes = [...foodLikes, ...otherLikes];

            return (
              <Link
                key={friend.id}
                href={`/friends/${friend.id}`}
                className="min-w-0 overflow-hidden bg-white rounded-2xl p-4 sm:p-5 border border-[#F4E6EB] hover:border-[#F47FA5] shadow-card hover:shadow-soft transition-colors cursor-pointer flex flex-col justify-between gap-3.5 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-[#261B20] shrink-0"
                        style={{ backgroundColor: friend.avatar_color }}
                      >
                        {friend.nickname.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-base text-[#261B20] truncate">
                            {friend.nickname}
                          </h3>
                          {friend.religion && friend.religion !== "ไม่ระบุ" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF3F6] text-[#6E5E65] border border-[#F0DCE3]">
                              {friend.religion}
                            </span>
                          )}
                        </div>
                        {friend.full_name && friend.full_name !== friend.nickname && (
                          <p className="text-[11px] text-[#6E5E65] truncate">{friend.full_name}</p>
                        )}
                      </div>
                    </div>
                    {friend.linked_user_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F4EC] text-[#1F5E3B] border border-[#BBE0C8] shrink-0">
                        <Link2 className="w-2.5 h-2.5" />
                        ซิงก์จากเพื่อน
                      </span>
                    ) : friend.joined_via_invite === 1 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA] shrink-0">
                        กรอกเอง
                      </span>
                    ) : null}
                  </div>

                  {/* Dietary & Allergy Alert Badges (Icon-first compact row) */}
                  {(dietaryList.length > 0 || allergies.length > 0 || dislikes.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dietaryList.slice(0, 2).map((d) => (
                        <span
                          key={d.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            d.restriction_category === "halal" || d.restriction_category === "religious_or_cultural"
                              ? "bg-[#E6F4EC] text-[#1F5E3B] border-[#BBE0C8]"
                              : d.restriction_category === "allergy"
                              ? "bg-[#FCE8E6] text-[#9A332E] border-[#EED2D0]"
                              : "bg-[#FFE4EC] text-[#8F2849] border-[#F5C2D3]"
                          }`}
                        >
                          <Utensils className="w-2.5 h-2.5 shrink-0" />
                          {d.restriction_label}
                        </span>
                      ))}
                      {allergies.slice(0, 2).map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B53D37] text-white"
                        >
                          <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                          แพ้ {a.normalized_value}
                        </span>
                      ))}
                      {dislikes.length > 0 && allergies.length === 0 && dietaryList.length === 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF7F0] text-[#75571A] border border-[#E8DFCB]">
                          ไม่ชอบ {dislikes[0].normalized_value}
                          {dislikes.length > 1 ? ` +${dislikes.length - 1}` : ""}
                        </span>
                      )}
                      {dietaryList.length + allergies.length > 4 && (
                        <span className="text-[10px] text-[#6E5E65] font-medium">
                          +{dietaryList.length + allergies.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Top Likes Pills (Compact max 3) */}
                  {topLikes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Heart className="w-3 h-3 text-[#C85A82] shrink-0 mr-0.5" />
                      {topLikes.slice(0, 3).map((item) => {
                        const meta = CATEGORY_META[item.category_slug as CategorySlug];
                        const isFood = item.category_slug === "food_preferences";
                        return (
                          <span
                            key={item.id}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              isFood
                                ? "bg-[#FFF0F5] text-[#8F2849] border-[#F5C2D3]"
                                : `${meta.bgClass} ${meta.textClass} ${meta.borderClass}`
                            }`}
                          >
                            {item.normalized_value}
                          </span>
                        );
                      })}
                      {topLikes.length > 3 && (
                        <span className="text-[10px] font-medium text-[#6E5E65] px-1">
                          +{topLikes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#F6EAF0] flex items-center justify-between gap-2 text-[11px] text-[#6E5E65]">
                  <span className="truncate min-w-0 inline-flex items-center gap-1">
                    {friend.contact_info ? friend.contact_info : `${friend.interests.length} ความชอบ`}
                  </span>
                  <span className="font-semibold text-[#A34263] shrink-0 inline-flex items-center gap-0.5">
                    ดูข้อมูล →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  return (
    <AppShell>
      <Suspense fallback={<CardGridSkeleton count={6} />}>
        <FriendsListContent />
      </Suspense>
    </AppShell>
  );
}
