"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function NewFriendRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/friends?add=1");
  }, [router]);

  return (
    <AppShell>
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="bg-white rounded-2xl p-8 border border-[#EAE6E8] shadow-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0F5] text-[#B3486B] flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#1F1A1C]">
            แอดเพื่อนจากบัญชี CHUAN-DI ด้วยกัน
          </h1>
          <p className="text-xs text-[#6E666A] leading-relaxed">
            ระบบจะดึงความชอบ อาหารที่ชอบ/แพ้ และวันว่างตรงจากโปรไฟล์ที่เพื่อนกรอกเองเมื่อเชื่อมต่อเป็นเพื่อนกัน
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/friends?add=1"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B3486B] text-white text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              เปิดหน้าแอดเพื่อนในแอป
            </Link>
            <Link
              href="/friends"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#EAE6E8] text-[#1F1A1C] text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              กลับหน้ารายชื่อเพื่อน
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
