"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { MascotAvatar } from "@/components/MascotAvatar";
import { DECLINE_REASONS } from "@/lib/types";

interface RsvpPayload {
  invitation: {
    friend_nickname: string;
    organizer_name: string;
    title: string;
    description: string;
    category: string;
    activity_date: string;
    start_time: string;
    end_time: string | null;
    location: string;
    rsvp_status: "pending" | "going" | "not_going";
    decline_reason: string | null;
    response_note: string | null;
  };
  summary: {
    goingNicknames: string[];
    totalInvited: number;
  };
}

export default function PublicRsvpPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<RsvpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [status, setStatus] = useState<"going" | "not_going">("going");
  const [reason, setReason] = useState<string>(DECLINE_REASONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/public/rsvp/${params.token}`, { cache: "no-store" });
      if (res.ok) {
        const d: RsvpPayload = await res.json();
        setData(d);
        if (d.invitation.rsvp_status === "not_going") {
          setStatus("not_going");
          setReason(d.invitation.decline_reason || DECLINE_REASONS[0]);
        } else {
          setStatus("going");
        }
        setNote(d.invitation.response_note || "");
      } else {
        const err = await res.json().catch(() => ({}));
        setLoadError(err.error || "ไม่พบบัตรเชิญนี้หรือลิงก์ไม่ถูกต้อง");
      }
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (status === "not_going" && reason === "อื่น ๆ" && !note.trim()) {
      setSubmitError("กรุณาระบุรายละเอียดเหตุผลเพิ่มเติมเมื่อเลือก 'อื่น ๆ'");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/rsvp/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rsvp_status: status,
          decline_reason: status === "not_going" ? reason : null,
          response_note: note.trim(),
        }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitted(true);
        loadInvite();
      } else {
        setSubmitError(resData.error || "ไม่สามารถบันทึกคำตอบได้");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F6] flex items-center justify-center p-4">
        <p className="text-sm font-medium text-[#6E666A]">กำลังโหลดรายละเอียดคำเชิญ</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F8F7F6] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <MascotAvatar pose="curious" size="lg" />
        <ShieldAlert className="w-8 h-8 text-[#A3322E]" />
        <h1 className="text-xl font-bold text-[#1F1A1C]">ไม่สามารถเปิดหน้าคำเชิญนี้ได้</h1>
        <p className="text-sm text-[#6E666A] max-w-md">
          {loadError || "ลิงก์อาจหมดอายุ ถูกยกเลิก หรือบัญชีที่เข้าสู่ระบบไม่มีสิทธิ์เข้าถึง"}
        </p>
      </div>
    );
  }

  const { invitation, summary } = data;

  return (
      <div className="min-h-screen bg-[#FFF8F3] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl p-5 sm:p-8 border border-[#F4E6EB] shadow-soft space-y-6">
          <div className="flex items-center gap-4">
            <MascotAvatar pose={submitted ? "love" : "cool"} size="md" float />
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A34263]">
                <Heart className="w-3.5 h-3.5 fill-[#F47FA5] text-[#F47FA5]" />
                <span>CHUAN-DI • คำชวนไปทำกิจกรรม</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#261B20] mt-0.5">
                สวัสดี {invitation.friend_nickname}
              </h1>
              <p className="text-xs text-[#6E5E65] flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-[#A34263]" />
                <span>ชวนโดย: {invitation.organizer_name}</span>
              </p>
            </div>
          </div>

          {/* Event Info Card */}
          <div className="bg-[#FFF9FA] rounded-2xl p-5 border border-[#F4E6EB] space-y-3">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-[#F0DCE3] text-[#4A3B41]">
              {invitation.category}
            </span>
            <h2 className="text-lg font-bold text-[#261B20]">{invitation.title}</h2>
            {invitation.description && (
              <p className="text-xs text-[#6E5E65] leading-relaxed">{invitation.description}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-white rounded-xl p-2.5 border border-[#F0DCE3] flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#261B20]">
                <Calendar className="w-4 h-4 text-[#A34263] shrink-0" />
                <span>วันที่ {invitation.activity_date}</span>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-[#F0DCE3] flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#261B20]">
                <Clock className="w-4 h-4 text-[#A34263] shrink-0" />
                <span>
                  {invitation.start_time}
                  {invitation.end_time ? ` - ${invitation.end_time}` : ""} น.
                </span>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-[#F0DCE3] sm:col-span-2 flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#261B20]">
                <MapPin className="w-4 h-4 text-[#A34263] shrink-0" />
                <span>{invitation.location}</span>
              </div>
            </div>

            {summary.goingNicknames.length > 0 && (
              <div className="pt-2 border-t border-[#F4E6EB] text-xs text-[#6E5E65]">
                เพื่อนที่ตอบรับไปด้วยแล้ว · {summary.goingNicknames.length} จาก {summary.totalInvited} คน:{" "}
                <span className="font-semibold text-[#2A6049]">
                  {summary.goingNicknames.join(", ")}
                </span>
              </div>
            )}
          </div>

          {submitted && (
            <div className="p-4 rounded-xl bg-[#F1F6F3] border border-[#D4E3DA] text-sm font-semibold text-[#2A6049] text-center">
              บันทึกคำตอบเรียบร้อยแล้ว คุณสามารถเปลี่ยนคำตอบได้ทุกเมื่อ
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-[#FDF3F2] border border-[#EED2D0] text-xs font-medium text-[#9A332E] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("going")}
                className={`p-4 rounded-xl border-2 font-semibold text-sm flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  status === "going"
                    ? "bg-[#F1F6F3] border-[#2A6049] text-[#2A6049]"
                    : "bg-[#FFF9FA] border-[#F0DCE3] text-[#4A3B41]"
                }`}
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>ไปด้วย</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("not_going")}
                className={`p-4 rounded-xl border-2 font-semibold text-sm flex flex-col items-center gap-1.5 transition cursor-pointer ${
                  status === "not_going"
                    ? "bg-[#FDF3F2] border-[#9A332E] text-[#9A332E]"
                    : "bg-[#FFF9FA] border-[#F0DCE3] text-[#4A3B41]"
                }`}
              >
                <XCircle className="w-6 h-6" />
                <span>ไปไม่ได้</span>
              </button>
            </div>

            {status === "not_going" && (
              <div>
                <label className="block text-xs font-semibold text-[#9A332E] mb-1.5">
                  เลือกเหตุผลสั้น ๆ ให้ผู้จัดทราบหน่อยนะ
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#EED2D0] bg-[#FDF3F2] text-sm font-medium text-[#261B20]"
                >
                  {DECLINE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#4A3B41] mb-1.5">
                {status === "not_going" && reason === "อื่น ๆ"
                  ? "ระบุเหตุผลเพิ่มเติม * จำเป็นเมื่อเลือก อื่น ๆ"
                  : "ข้อความถึงเพื่อนผู้ชวน · ไม่จำเป็นต้องใส่"}
              </label>
              <input
                type="text"
                required={status === "not_going" && reason === "อื่น ๆ"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  status === "not_going" && reason === "อื่น ๆ"
                    ? "บอกเหตุผลเพิ่มเติมสักนิด"
                    : "เช่น เจอกันหน้าร้านนะ หรือแจ้งข้อจำกัดด้านอาหารเพิ่มเติม"
                }
                className="w-full px-4 py-2.5 rounded-xl border border-[#F0DCE3] bg-white text-sm text-[#261B20]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#F47FA5] hover:bg-[#E0688F] text-white font-semibold text-sm shadow-soft transition cursor-pointer disabled:opacity-60"
            >
              {submitting ? "กำลังบันทึกคำตอบ..." : "ตอบรับคำชวน"}
            </button>
          </form>
        </div>
      </div>
  );
}
