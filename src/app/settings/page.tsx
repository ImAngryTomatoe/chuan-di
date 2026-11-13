"use client";

import React, { Suspense, useEffect, useState } from "react";
import { RotateCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { ConfirmModal } from "@/components/ConfirmModal";
import { GoogleCalendarSettingsCard } from "@/components/GoogleCalendarSettingsCard";
import { MascotAvatar } from "@/components/MascotAvatar";

function SettingsContent() {
  const { user, refreshUser, notify } = useApp();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ hasOpenAI: boolean; hasGemini: boolean } | null>(
    null
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio || "");
    }
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAiStatus(d.aiStatus || null));
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio }),
      });
      if (res.ok) {
        await refreshUser();
        notify("บันทึกข้อมูลบัญชีเรียบร้อยแล้ว");
      } else {
        notify("ไม่สามารถบันทึกโปรไฟล์ได้", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDemo() {
    setResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify(data.message || "รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว");
        setResetOpen(false);
      } else {
        notify(data.error || "รีเซ็ตข้อมูลไม่สำเร็จ", "error");
        setResetOpen(false);
      }
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F1A1C]">ตั้งค่า</h1>
          <p className="text-xs text-[#6E666A] mt-0.5">
            บัญชีผู้ใช้งาน การเชื่อมต่อ Google Calendar และข้อมูลตัวอย่าง
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.assign("/my-profile")}
          className="px-4 py-2 rounded-xl bg-white hover:border-[#B3486B] border border-[#EAE6E8] text-[#1F1A1C] text-xs font-semibold transition-colors shrink-0 cursor-pointer"
        >
          โปรไฟล์ของฉัน →
        </button>
      </div>

      {/* Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card space-y-4"
      >
        <div className="flex items-center gap-4">
          <MascotAvatar pose="happy" size="md" />
          <div>
            <h2 className="font-bold text-lg text-[#1F1A1C]">{user?.name}</h2>
            <p className="text-xs text-[#6E666A]">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#4A4346] mb-1.5">
              ชื่อที่แสดงในระบบ
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4A4346] mb-1.5">
              ข้อมูลแนะนำตัวหรือแนวทางการจัดกิจกรรม
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#DED8DA] bg-white text-sm text-[#1F1A1C]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? "กำลังบันทึก" : "บันทึกข้อมูลบัญชี"}
          </button>
        </div>
      </form>

      {/* Google Calendar Integration */}
      <Suspense fallback={<div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] h-48 animate-pulse" />}>
        <GoogleCalendarSettingsCard />
      </Suspense>

      {/* AI & Privacy Status */}
      <div className="bg-white rounded-2xl p-5 border border-[#EAE6E8] shadow-card space-y-3">
        <h2 className="font-bold text-[#1F1A1C] flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-[#B3486B]" />
          ความเป็นส่วนตัวและตัวช่วยจัดข้อมูล
        </h2>
        <div className="p-3.5 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] text-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#1F1A1C]">ตัวช่วยแปลงข้อความเป็นแท็กความชอบ</span>
            <span className="px-2.5 py-0.5 rounded-full font-semibold bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA]">
              {aiStatus?.hasOpenAI
                ? "เชื่อมต่อ OpenAI แล้ว"
                : aiStatus?.hasGemini
                ? "เชื่อมต่อ Gemini แล้ว"
                : "ทำงานในแอปทันที · ไม่ส่งข้อมูลออกนอกเครื่อง"}
            </span>
          </div>
          <div className="flex items-start gap-2 text-[#6E666A]">
            <ShieldCheck className="w-4 h-4 text-[#2A6049] shrink-0 mt-0.5" />
            <span>
              เฉพาะเพื่อนที่เชื่อมต่อบัญชีกันเท่านั้นที่จะเห็นความชอบของคุณ และลิงก์คำเชิญสาธารณะจะไม่เปิดเผยข้อมูลส่วนตัวของผู้อื่น
            </span>
          </div>
        </div>
      </div>

      {/* Reset Demo Data (Restricted strictly to designated demo account) */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAE6E8] shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-[#1F1A1C]">รีเซ็ตข้อมูลตัวอย่าง</h2>
          <p className="text-xs text-[#6E666A] mt-0.5">
            {user?.email === "demo@chuan-di.app"
              ? "กู้คืนรายชื่อเพื่อนตัวอย่าง 22 คน กิจกรรม 6 รายการ กลุ่มเพื่อนที่บันทึกไว้ ข้อมูลการตอบรับ และประวัติการสกัดข้อมูลกลับสู่ค่าตั้งต้น"
              : "บัญชีผู้ใช้งานทั่วไปได้รับการปกป้องข้อมูล ไม่สามารถถูกลบหรือแทนที่ด้วยชุดข้อมูลตัวอย่างได้"}
          </p>
        </div>
        {user?.email === "demo@chuan-di.app" ? (
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-[#F3EFE4] border border-[#E8DFCB] text-[#75571A] text-sm font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F1F6F3] text-[#2A6049] border border-[#D4E3DA] text-xs font-semibold shrink-0">
            <ShieldCheck className="w-4 h-4" />
            ปกป้องข้อมูลบัญชีหลัก
          </span>
        )}
      </div>

      <ConfirmModal
        open={resetOpen}
        title="ยืนยันการรีเซ็ตข้อมูลตัวอย่าง"
        message="รายชื่อเพื่อน กิจกรรม และคำเชิญปัจจุบันในบัญชีนี้จะถูกแทนที่ด้วยชุดข้อมูลตัวอย่างตั้งต้น"
        confirmLabel="ยืนยันรีเซ็ตข้อมูล"
        danger={false}
        loading={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleResetDemo}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
