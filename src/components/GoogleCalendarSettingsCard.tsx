"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Info,
  Lock,
  RefreshCw,
  Shield,
  Unlink,
  Users,
} from "lucide-react";
import { useApp } from "@/components/AppShell";
import { ConfirmModal } from "@/components/ConfirmModal";

export interface GoogleCalendarSourceDTO {
  calendarId: string;
  summary: string;
  isPrimary: boolean;
  accessRole: string;
  backgroundColor: string | null;
  timeZone: string | null;
  isSelected: boolean;
}

export interface GoogleSharingTargetDTO {
  friendId: number;
  ownerUserId: number;
  ownerName: string;
  nicknameWithOwner: string;
  isShared: boolean;
  shareSource: string;
  grantedAt: string | null;
}

export interface GoogleCalendarPublicStatusDTO {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  syncStatus: "disconnected" | "connected" | "error";
  syncError: string | null;
  lastSyncedAt: string | null;
  syncWindowStart: string | null;
  syncWindowEnd: string | null;
  connectedAt: string | null;
  selectedCount: number;
  calendars: GoogleCalendarSourceDTO[];
  sharingTargets: GoogleSharingTargetDTO[];
}

function formatThaiTimestamp(iso: string | null): string {
  if (!iso) return "ยังไม่เคยซิงก์";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dt);
  } catch {
    return iso;
  }
}

export function GoogleCalendarSettingsCard() {
  const { notify } = useApp();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GoogleCalendarPublicStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingFriendId, setTogglingFriendId] = useState<number | null>(null);
  const [setupHintOpen, setSetupHintOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/google-calendar/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as GoogleCalendarPublicStatusDTO;
      setStatus(data);
      setSelectedIds(data.calendars.filter((c) => c.isSelected).map((c) => c.calendarId));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const gcalParam = searchParams.get("gcal");
    const reason = searchParams.get("reason");
    if (!gcalParam) return;
    if (gcalParam === "connected") {
      setBanner({
        type: "success",
        text: "เชื่อมต่อ Google Calendar และซิงก์ข้อมูล Free/Busy เรียบร้อยแล้ว",
      });
    } else if (gcalParam === "connected_partial") {
      setBanner({
        type: "warning",
        text: "เชื่อมต่อบัญชี Google สำเร็จแล้ว แต่การซิงก์ช่วงเวลารอบแรกยังไม่สมบูรณ์ กรุณากดรีเฟรชข้อมูลปฏิทินอีกครั้ง",
      });
    } else if (gcalParam === "denied") {
      setBanner({
        type: "warning",
        text: "คุณยกเลิกการอนุญาตเชื่อมต่อ Google Calendar — ระบบไม่ได้บันทึกสิทธิ์หรือเข้าถึงปฏิทินของคุณ",
      });
    } else if (gcalParam === "not_configured") {
      setBanner({
        type: "warning",
        text: "ยังไม่ได้ตั้งค่า Google OAuth Credentials บนเซิร์ฟเวอร์ (ดูคู่มือ docs/GOOGLE_CALENDAR_SETUP.md)",
      });
      setSetupHintOpen(true);
    } else if (gcalParam === "error") {
      setBanner({
        type: "error",
        text: reason
          ? `ไม่สามารถเชื่อมต่อ Google Calendar ได้ (${reason}) กรุณาลองใหม่อีกครั้ง`
          : "ไม่สามารถเชื่อมต่อ Google Calendar ได้ กรุณาลองใหม่อีกครั้ง",
      });
    }
  }, [searchParams]);

  async function handleConnect() {
    setConnecting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/google-calendar/connect?mode=json&redirect=/settings", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        if (data.code === "OAUTH_NOT_CONFIGURED") {
          setSetupHintOpen(true);
        }
        setBanner({
          type: "error",
          text: data.error || "ยังไม่ได้ตั้งค่า Google OAuth 2.0 Credentials",
        });
        notify(data.error || "ยังไม่ได้ตั้งค่า Google OAuth Credentials", "error");
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      notify("ไม่สามารถเริ่มเชื่อมต่อ Google Calendar ได้", "error");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "รีเฟรชข้อมูลปฏิทินไม่สำเร็จ", "error");
        await loadStatus();
        return;
      }
      setStatus(data.status);
      setSelectedIds(
        (data.status?.calendars || [])
          .filter((c: GoogleCalendarSourceDTO) => c.isSelected)
          .map((c: GoogleCalendarSourceDTO) => c.calendarId)
      );
      notify(`รีเฟรชข้อมูลปฏิทินสำเร็จ (${data.sync?.selectedCalendars ?? 0} ปฏิทิน)`, "success");
    } finally {
      setSyncing(false);
    }
  }

  function toggleCalendarSelection(calId: string) {
    setSelectedIds((prev) =>
      prev.includes(calId) ? prev.filter((id) => id !== calId) : [...prev, calId]
    );
  }

  async function handleSaveCalendars() {
    setSavingCalendars(true);
    try {
      const res = await fetch("/api/google-calendar/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "บันทึกปฏิทินที่เลือกไม่สำเร็จ", "error");
        return;
      }
      setStatus(data.status);
      notify(
        selectedIds.length > 0
          ? `บันทึกการเลือก ${selectedIds.length} ปฏิทินและซิงก์ Free/Busy แล้ว`
          : "ยกเลิกการเลือกปฏิทินทั้งหมดแล้ว (เพื่อนจะเห็นสถานะของคุณเป็นยังไม่มีข้อมูล)",
        "success"
      );
    } finally {
      setSavingCalendars(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "ยกเลิกการเชื่อมต่อไม่สำเร็จ", "error");
        return;
      }
      setStatus(data.status);
      setSelectedIds([]);
      setDisconnectOpen(false);
      setBanner({
        type: "warning",
        text: "ยกเลิกการเชื่อมต่อ Google Calendar แล้ว — วันว่างที่คุณตั้งไว้ด้วยตนเองยังคงใช้งานได้ตามปกติ",
      });
      notify("ยกเลิกการเชื่อมต่อ Google Calendar เรียบร้อยแล้ว");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleToggleSharing(target: GoogleSharingTargetDTO) {
    setTogglingFriendId(target.friendId);
    try {
      const nextShared = !target.isShared;
      const res = await fetch("/api/google-calendar/sharing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: target.friendId, isShared: nextShared }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "อัปเดตสิทธิ์การแชร์ไม่สำเร็จ", "error");
        return;
      }
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              sharingTargets: data.sharingTargets || prev.sharingTargets,
            }
          : prev
      );
      notify(
        nextShared
          ? `เปิดแชร์สถานะว่าง/ไม่ว่างให้ ${target.ownerName} แล้ว`
          : `ปิดการแชร์ปฏิทินให้ ${target.ownerName} แล้ว (เพื่อนจะเห็นเป็นยังไม่มีข้อมูล)`
      );
    } finally {
      setTogglingFriendId(null);
    }
  }

  const calendarsChanged =
    status !== null &&
    (() => {
      const current = new Set(status.calendars.filter((c) => c.isSelected).map((c) => c.calendarId));
      if (current.size !== selectedIds.length) return true;
      return selectedIds.some((id) => !current.has(id));
    })();

  return (
    <div
      id="google-calendar"
      className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-5"
    >
      {/* Card Header + Status Badge */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF3FF] text-[#2F59B6] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-[#261B20] flex items-center gap-2 flex-wrap">
              <span>Google Calendar (ซิงก์เวลาว่าง/ไม่ว่างอัตโนมัติ)</span>
              {!loading && status && (
                <span
                  data-testid="gcal-connection-status"
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    status.connected
                      ? "bg-[#EDF7F1] text-[#1E5E42] border-[#CDE6D7]"
                      : "bg-[#F4F2F3] text-[#6E666A] border-[#E2DDE0]"
                  }`}
                >
                  {status.connected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      เชื่อมต่อแล้ว
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      ยังไม่ได้เชื่อมต่อ
                    </>
                  )}
                </span>
              )}
            </h2>
            <p className="text-xs text-[#6E666A] mt-0.5">
              แชร์เฉพาะสถานะ &quot;ว่าง/ไม่ว่าง&quot; โดยไม่เปิดเผยชื่อนัดหมาย
            </p>
          </div>
        </div>
      </div>

      {/* OAuth Callback / Action Feedback Banner */}
      {banner && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-start gap-2.5 border ${
            banner.type === "success"
              ? "bg-[#EDF7F1] border-[#CDE6D7] text-[#1E5E42]"
              : banner.type === "warning"
              ? "bg-[#FFF8EB] border-[#F2DFB6] text-[#855814]"
              : "bg-[#FCE8E6] border-[#EED2D0] text-[#9A332E]"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {loading || !status ? (
        <div className="h-24 rounded-xl bg-[#FAF8F9] animate-pulse" />
      ) : !status.connected ? (
        <div className="space-y-4">
          {!status.configured && (
            <details className="rounded-xl bg-[#FFF8EB] border border-[#F2DFB6] px-3.5 py-2.5 text-xs text-[#7D5211]">
              <summary className="font-semibold flex items-center justify-between gap-2 cursor-pointer list-none">
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  ยังไม่ได้ตั้งค่า Google OAuth บนเซิร์ฟเวอร์ (ระบบไม่จำลองแทนบัญชีจริง)
                </span>
                <span className="text-[11px] underline shrink-0">วิธีตั้งค่า</span>
              </summary>
              <p className="leading-relaxed mt-2 pt-2 border-t border-[#F2DFB6]/70">
                สร้าง OAuth Client ID ใน Google Cloud Console แล้วเพิ่ม{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">GOOGLE_CLIENT_ID</code> และ{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">GOOGLE_CLIENT_SECRET</code>{" "}
                ใน <code className="px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">.env.local</code>{" "}
                (ดูตัวอย่าง <code className="px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">.env.example</code> และ{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/80 font-mono text-[11px]">docs/GOOGLE_CALENDAR_SETUP.md</code>)
              </p>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              data-testid="gcal-connect-button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#261B20] hover:bg-[#3A2B32] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              {connecting ? "กำลังพาไปหน้าเข้าสู่ระบบ Google..." : "เชื่อม Google Calendar"}
            </button>

            <button
              type="button"
              onClick={() => setSetupHintOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#EAE6E8] bg-[#FAF8F9] hover:bg-[#F3EFF1] text-xs font-medium text-[#52494D] cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              {setupHintOpen ? "ซ่อนวิธีตั้งค่า" : "วิธีตั้งค่าและสิทธิ์ที่ขอ"}
            </button>
          </div>

          {setupHintOpen && (
            <div className="rounded-xl bg-[#FAF8F9] border border-[#EAE6E8] p-4 text-xs text-[#52494D] space-y-2">
              <div className="font-semibold text-[#261B20]">
                สิทธิ์ OAuth 2.0 เท่าที่จำเป็น (Least Privilege Scopes)
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <code className="font-mono text-[11px]">calendar.calendarlist.readonly</code> — เพื่อแสดงชื่อปฏิทินให้คุณเลือกแชร์ได้
                </li>
                <li>
                  <code className="font-mono text-[11px]">calendar.freebusy</code> — เพื่อดึงเฉพาะสถานะ &quot;ว่าง / ไม่ว่าง&quot; โดยไม่อ่านชื่อกิจกรรมหรือรายละเอียดนัดหมาย
                </li>
              </ul>
              <p className="text-[#6E666A]">
                รายละเอียด Redirect URI และการสร้าง OAuth Client อยู่ในไฟล์{" "}
                <code className="font-mono text-[11px]">docs/GOOGLE_CALENDAR_SETUP.md</code> และ{" "}
                <code className="font-mono text-[11px]">.env.example</code>
              </p>
            </div>
          )}

          <div className="rounded-xl bg-[#FBF9FA] border border-[#EAE6E8] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#52494D]">
            <span>
              หากยังไม่ได้เชื่อม Google Calendar คุณยังสามารถตั้งค่าวัน-เวลาว่างด้วยตนเองได้ตามปกติ
            </span>
            <Link
              href="/calendar"
              className="font-semibold text-[#261B20] underline hover:text-[#8F2849]"
            >
              ไปตั้งวันว่างด้วยตนเอง
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected account summary & actions */}
          <div className="rounded-xl bg-[#FAF8F9] border border-[#EAE6E8] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-xs">
              <div className="text-sm font-semibold text-[#261B20]">
                บัญชีที่เชื่อมต่อ:{" "}
                <span className="text-[#1E5E42]">{status.googleEmail || "บัญชี Google ส่วนตัว"}</span>
              </div>
              <div className="text-[#6E666A] flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>ซิงก์ล่าสุด: {formatThaiTimestamp(status.lastSyncedAt)}</span>
                {status.syncWindowStart && status.syncWindowEnd && (
                  <span>
                    ช่วงข้อมูล: {status.syncWindowStart} ถึง {status.syncWindowEnd} (เวลาไทย)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                data-testid="gcal-refresh-button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#CDE6D7] bg-[#EDF7F1] hover:bg-[#E1F2E8] text-[#1E5E42] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูลปฏิทิน"}
              </button>

              <button
                type="button"
                onClick={() => setDisconnectOpen(true)}
                data-testid="gcal-disconnect-button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EED2D0] bg-white hover:bg-[#FCE8E6] text-[#9A332E] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          </div>

          {status.syncStatus === "error" && status.syncError && (
            <div className="rounded-xl bg-[#FCE8E6] border border-[#EED2D0] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9A332E]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>พบปัญหาการซิงก์ล่าสุด: {status.syncError}</span>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                className="font-semibold underline cursor-pointer"
              >
                เชื่อม Google Calendar ใหม่
              </button>
            </div>
          )}

          {/* Calendar sources selector */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#261B20]">
                  เลือกปฏิทินที่ต้องการแชร์สถานะ (ว่าง / ไม่ว่าง)
                </h3>
                <p className="text-xs text-[#6E666A]">
                  ใช้เฉพาะช่วงเวลา Free/Busy ของปฏิทินที่ติ๊กเลือกเพื่อนำไปคำนวณวันว่างตรงกันกับเพื่อน
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCalendars}
                disabled={savingCalendars || !calendarsChanged}
                data-testid="gcal-save-calendars-button"
                className="px-3.5 py-2 rounded-xl bg-[#261B20] hover:bg-[#3A2B32] disabled:bg-[#D8D2D5] disabled:text-[#787074] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {savingCalendars ? "กำลังบันทึกและซิงก์..." : "บันทึกปฏิทินที่เลือก"}
              </button>
            </div>

            {status.calendars.length === 0 ? (
              <div className="text-xs text-[#6E666A] bg-[#FAF8F9] rounded-xl p-3 border border-[#EAE6E8]">
                ไม่พบปฏิทินที่อ่านสถานะ Free/Busy ได้ กรุณากด &quot;รีเฟรชข้อมูลปฏิทิน&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {status.calendars.map((cal) => {
                  const checked = selectedIds.includes(cal.calendarId);
                  return (
                    <label
                      key={cal.calendarId}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? "bg-[#FBF7F8] border-[#261B20]/40"
                          : "bg-white border-[#EAE6E8] hover:border-[#CFC8CC]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCalendarSelection(cal.calendarId)}
                        className="mt-0.5 rounded border-[#CFC8CC] accent-[#261B20]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#261B20] flex items-center gap-1.5 flex-wrap">
                          {cal.backgroundColor && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                              style={{ backgroundColor: cal.backgroundColor }}
                            />
                          )}
                          <span className="truncate">{cal.summary}</span>
                          {cal.isPrimary && (
                            <span className="px-1.5 py-0.5 rounded bg-[#EDF7F1] text-[#1E5E42] text-[10px] font-semibold">
                              หลัก
                            </span>
                          )}
                        </div>
                        {cal.calendarId !== cal.summary && (
                          <div className="text-[11px] text-[#6E666A] truncate mt-0.5">
                            {cal.calendarId}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-organizer sharing controls + Privacy details */}
      <div className="pt-4 border-t border-[#EAE6E8] space-y-3">
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-[#4A4246] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-[#261B20]">
              สิทธิ์การมองเห็นเวลาว่าง
            </h3>
            <p className="text-xs text-[#6E666A]">
              เลือกเปิด/ปิดการแชร์ให้ผู้จัดแต่ละคน (ถ้าปิดจะเห็นเป็น &quot;ยังไม่มีข้อมูล&quot;)
            </p>
          </div>
        </div>

        {status && status.sharingTargets.length > 0 ? (
          <div className="space-y-2">
            {status.sharingTargets.map((target) => (
              <div
                key={target.friendId}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF8F9] border border-[#EAE6E8]"
              >
                <div className="text-xs">
                  <div className="font-semibold text-[#261B20]">
                    ผู้จัด: {target.ownerName}
                  </div>
                  <div className="text-[#6E666A]">
                    แสดงชื่อในวงนี้ว่า &quot;{target.nicknameWithOwner}&quot;
                  </div>
                </div>
                <button
                  type="button"
                  disabled={togglingFriendId === target.friendId}
                  onClick={() => handleToggleSharing(target)}
                  data-testid={`gcal-share-toggle-${target.friendId}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    target.isShared
                      ? "bg-[#EDF7F1] text-[#1E5E42] border-[#CDE6D7] hover:bg-[#E1F2E8]"
                      : "bg-white text-[#6E666A] border-[#DCD6D9] hover:bg-[#F3EFF1]"
                  }`}
                >
                  {togglingFriendId === target.friendId
                    ? "กำลังอัปเดต..."
                    : target.isShared
                    ? "กำลังแชร์สถานะว่าง/ไม่ว่าง"
                    : "ปิดการแชร์ (ยังไม่มีข้อมูล)"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#6E666A] bg-[#FAF8F9] rounded-xl p-3 border border-[#EAE6E8]">
            ยังไม่มีผู้จัดที่เชื่อมโปรไฟล์ไว้ — เมื่อตอบรับคำเชิญจะสามารถเลือกเปิด/ปิดการแชร์รายคนได้ที่นี่
          </div>
        )}

        <details className="rounded-xl bg-[#FAF8F9] border border-[#EAE6E8] px-3.5 py-2.5 text-xs text-[#52494D]">
          <summary className="font-semibold text-[#261B20] flex items-center justify-between gap-2 cursor-pointer list-none">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#1E5E42]" />
              ความปลอดภัยและสิทธิ์ข้อมูล
            </span>
            <span className="text-[11px] text-[#6E666A] font-normal">ดูรายละเอียด</span>
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#5F575B] mt-2 pt-2 border-t border-[#EAE6E8]">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#6E666A] shrink-0" />
              เข้ารหัส OAuth Tokens ด้วย AES-256-GCM ฝั่ง Server เท่านั้น
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#6E666A] shrink-0" />
              เพื่อนเห็นเฉพาะ &quot;ว่าง&quot; หรือ &quot;ไม่ว่าง&quot; ไม่เห็นชื่อประชุมหรือสถานที่
            </div>
          </div>
        </details>
      </div>

      <ConfirmModal
        open={disconnectOpen}
        title="ยกเลิกการเชื่อมต่อ Google Calendar?"
        message="ระบบจะเพิกถอนสิทธิ์และลบ Token รวมถึงข้อมูล Free/Busy ที่ซิงก์จาก Google Calendar ทั้งหมด แต่วันว่างที่คุณตั้งค่าไว้ด้วยตนเองจะยังคงอยู่เหมือนเดิม"
        confirmLabel="ยกเลิกการเชื่อมต่อ"
        danger
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectOpen(false)}
      />
    </div>
  );
}
