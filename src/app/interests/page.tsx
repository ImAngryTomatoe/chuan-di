"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, UserCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function InterestsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-profile");
  }, [router]);

  return (
    <AppShell>
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="bg-white rounded-2xl p-8 border border-[#EAE6E8] shadow-card space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0F5] text-[#B3486B] flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#1F1A1C]">
            ย้ายไปจัดการข้อมูลที่โปรไฟล์ของแต่ละคนแล้ว
          </h1>
          <p className="text-xs text-[#6E666A] leading-relaxed">
            ข้อมูลความชอบและข้อจำกัดด้านอาหารจะมาจากที่เพื่อนแต่ละคนกรอกในโปรไฟล์ของตัวเอง แล้วซิงก์อัตโนมัติเมื่อแอดเพื่อนในแอป CHUAN-DI
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/my-profile"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B3486B] text-white text-xs font-semibold"
            >
              <span>ไปที่โปรไฟล์ฉัน</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/friends?add=1"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#EAE6E8] text-[#1F1A1C] text-xs font-semibold"
            >
              <Users className="w-3.5 h-3.5 text-[#8F3553]" />
              <span>แอดเพื่อนในแอป</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
