"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { AppShell, useApp } from "@/components/AppShell";
import { FriendForm } from "@/components/FriendForm";
import { FriendRecord } from "@/lib/types";

function EditFriendContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useApp();
  const [friend, setFriend] = useState<FriendRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/friends/${params.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFriend(d?.friend || null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#6E666A]">กำลังโหลดข้อมูล</div>;
  }

  if (!friend) {
    return <div className="py-16 text-center text-sm text-[#6E666A]">ไม่พบข้อมูลรายชื่อเพื่อน</div>;
  }

  if (friend.linked_user_id) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-5">
        <div className="bg-white rounded-2xl border border-[#EAE6E8] shadow-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E6F4EC] text-[#1F5E3B] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#1F1A1C]">
            ไม่สามารถแก้ไขข้อมูลของ {friend.nickname} แทนได้
          </h1>
          <p className="text-xs text-[#6E666A] leading-relaxed">
            เพื่อนคนนี้เชื่อมต่อบัญชี CHUAN-DI เรียบร้อยแล้ว ข้อมูลความชอบ อาหารที่ทานได้/ไม่ได้ และข้อจำกัดด้านอาหารจะซิงก์ตรงจากโปรไฟล์ที่เพื่อนกรอกเองเท่านั้น
          </p>
          <div className="pt-2">
            <Link
              href={`/friends/${friend.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B3486B] hover:bg-[#993858] text-white text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับไปดูโปรไฟล์ของ {friend.nickname}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/friends/${friend.id}`}
          className="p-2 rounded-xl bg-white border border-[#EAE6E8] text-[#6E666A] hover:border-[#B3486B]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1F1A1C]">แก้ไขข้อมูล {friend.nickname}</h1>
          <p className="text-xs text-[#6E666A]">
            เมื่อปรับปรุงข้อมูลความสนใจ ระบบจัดกลุ่มเพื่อนจะอัปเดตให้โดยอัตโนมัติ
          </p>
        </div>
      </div>

      <FriendForm
        initialFriend={friend}
        submitLabel="บันทึกการเปลี่ยนแปลง"
        submitting={submitting}
        onSubmit={async (payload) => {
          setSubmitting(true);
          try {
            const res = await fetch(`/api/friends/${friend.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
              notify(data.error || "ไม่สามารถบันทึกได้", "error");
              return;
            }
            notify(`อัปเดตข้อมูล ${data.friend.nickname} เรียบร้อยแล้ว`);
            router.push(`/friends/${friend.id}`);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}

export default function EditFriendPage() {
  return (
    <AppShell>
      <EditFriendContent />
    </AppShell>
  );
}
