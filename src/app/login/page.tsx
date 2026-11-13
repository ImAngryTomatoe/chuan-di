"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, Lock, Mail, Send, Sparkles, User, Users } from "lucide-react";
import { MascotAvatar } from "@/components/MascotAvatar";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { email, password } : { name, email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "demo@chuan-di.app",
          password: "ChuanDiDemo123",
        }),
      });
      if (!res.ok) {
        setError("ไม่สามารถเข้าสู่ระบบบัญชีเดโมได้");
        return;
      }
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF8F3] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl shadow-soft border border-[#F4E6EB] overflow-hidden">
        {/* Left Brand & Mascot Showcase */}
        <div className="lg:col-span-6 bg-[#FFF9FA] border-b lg:border-b-0 lg:border-r border-[#F4E6EB] p-8 sm:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <MascotAvatar pose="welcome" size="lg" float />
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#F0DCE3] text-[11px] font-semibold text-[#A34263] mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#F47FA5]" />
                  ผู้ช่วยนัดเพื่อน
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#261B20] tracking-tight">
                  CHUAN-DI
                </h1>
                <p className="text-sm font-semibold text-[#A34263] mt-0.5 inline-flex items-center gap-1.5">
                  <span>รู้ใจเพื่อน หาวันว่าง ชวนง่ายใน 3 ขั้น</span>
                  <Heart className="w-3.5 h-3.5 text-[#A34263] shrink-0" strokeWidth={2} />
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-white/90 rounded-xl p-3 border border-[#F4E6EB] text-center space-y-1.5">
                <div className="w-8 h-8 mx-auto rounded-lg bg-[#FFF0F5] text-[#D85680] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-[#261B20]">1. เล่าเรื่อง</p>
                <p className="text-[11px] text-[#6E5E65]">เก็บความชอบ &amp; อาหาร</p>
              </div>
              <div className="bg-white/90 rounded-xl p-3 border border-[#F4E6EB] text-center space-y-1.5">
                <div className="w-8 h-8 mx-auto rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-[#261B20]">2. ดูวันว่าง</p>
                <p className="text-[11px] text-[#6E5E65]">เทียบเวลาตรงกัน</p>
              </div>
              <div className="bg-white/90 rounded-xl p-3 border border-[#F4E6EB] text-center space-y-1.5">
                <div className="w-8 h-8 mx-auto rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-[#261B20]">3. ชวนเลย</p>
                <p className="text-[11px] text-[#6E5E65]">ส่งลิงก์เช็กคำตอบ</p>
              </div>
            </div>
          </div>

          {/* Demo Account Box */}
          <div className="bg-white rounded-xl p-4 border border-[#F0DCE3] shadow-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#261B20] tracking-wide">
                บัญชีทดลองใช้งาน · ข้อมูลเพื่อนและกิจกรรมตัวอย่าง
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFE4EC] text-[#8F2849] shrink-0">
                พร้อมใช้งาน
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#FFF9FA] p-3 rounded-xl border border-[#F4E6EB]">
              <div>
                <span className="text-[#6E5E65] block">อีเมล</span>
                <code className="font-semibold text-[#261B20] select-all">demo@chuan-di.app</code>
              </div>
              <div>
                <span className="text-[#6E5E65] block">รหัสผ่าน</span>
                <code className="font-semibold text-[#261B20] select-all">ChuanDiDemo123</code>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
            >
              <span>เข้าสู่ระบบด้วยบัญชีทดลอง</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Auth Form */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex bg-[#FFF9FA] p-1 rounded-xl border border-[#F4E6EB] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-white text-[#261B20] shadow-card"
                  : "text-[#6E5E65] hover:text-[#261B20]"
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-white text-[#261B20] shadow-card"
                  : "text-[#6E5E65] hover:text-[#261B20]"
              }`}
            >
              สมัครสมาชิกใหม่
            </button>
          </div>

          <h2 className="text-xl font-bold text-[#261B20]">
            {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี CHUAN-DI"}
          </h2>
          <p className="text-xs text-[#6E5E65] mt-1 mb-6">
            {mode === "login"
              ? "เข้าสู่ระบบเพื่อเล่าเรื่องเพื่อน จัดการความชอบ และสร้างคำชวนไปทำกิจกรรม"
              : "เริ่มต้นเก็บรวบรวมความชอบและข้อจำกัดของเพื่อนไว้ในที่เดียว"}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] text-xs font-medium text-[#9A332E]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
                  ชื่อที่แสดงในระบบ
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#857B80] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น แพรว, ต้นกล้า"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B3486B]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#544D51] mb-1.5">อีเมล</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#857B80] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B3486B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#544D51] mb-1.5">
                รหัสผ่าน · อย่างน้อย 6 ตัวอักษร
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#857B80] absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E4DFE2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#B3486B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#1F1A1C] hover:bg-[#332C30] text-white font-semibold text-sm transition disabled:opacity-60"
            >
              {loading
                ? "กำลังดำเนินการ..."
                : mode === "login"
                ? "เข้าสู่ระบบ"
                : "สมัครสมาชิกและเริ่มใช้งาน"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
