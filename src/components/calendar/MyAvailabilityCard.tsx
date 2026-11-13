"use client";

import React, { useEffect, useState } from "react";
import { CalendarCheck2, Clock, Repeat, Trash2 } from "lucide-react";
import { formatThaiDateLabel, WEEKDAY_NAMES_TH, WEEKDAY_SHORT_TH } from "@/lib/calendar";

export interface WeeklyRuleItem {
  id: number;
  weekday: number;
  status: "available" | "unavailable";
  start_time: string;
  end_time: string;
  note: string | null;
}

export interface DateOverrideItem {
  id: number;
  avail_date: string;
  status: "available" | "unavailable" | "unknown";
  start_time: string;
  end_time: string;
  note: string | null;
}

interface Props {
  selectedDate: string;
  weeklyRules: WeeklyRuleItem[];
  dateOverrides: DateOverrideItem[];
  saving: boolean;
  onSaveDate: (payload: {
    avail_date: string;
    status: "available" | "unavailable" | "unknown";
    start_time: string;
    end_time: string;
    note: string;
  }) => Promise<void>;
  onDeleteDate: (dateStr: string) => Promise<void>;
  onSaveWeekly: (payload: {
    weekday: number;
    status: "available" | "unavailable";
    start_time: string;
    end_time: string;
    note: string;
  }) => Promise<void>;
  onDeleteWeekly: (weekday: number) => Promise<void>;
}

export function MyAvailabilityCard({
  selectedDate,
  weeklyRules,
  dateOverrides,
  saving,
  onSaveDate,
  onDeleteDate,
  onSaveWeekly,
  onDeleteWeekly,
}: Props) {
  const [tab, setTab] = useState<"date" | "weekly">("date");

  const existingDateOverride = dateOverrides.find((d) => d.avail_date === selectedDate);
  const [dateStatus, setDateStatus] = useState<"available" | "unavailable" | "unknown">(
    existingDateOverride?.status || "available"
  );
  const [dateStart, setDateStart] = useState(existingDateOverride?.start_time || "10:00");
  const [dateEnd, setDateEnd] = useState(existingDateOverride?.end_time || "20:00");
  const [dateNote, setDateNote] = useState(existingDateOverride?.note || "");

  useEffect(() => {
    const found = dateOverrides.find((d) => d.avail_date === selectedDate);
    if (found) {
      setDateStatus(found.status);
      setDateStart(found.start_time || "10:00");
      setDateEnd(found.end_time || "20:00");
      setDateNote(found.note || "");
    } else {
      setDateStatus("available");
      setDateStart("10:00");
      setDateEnd("20:00");
      setDateNote("");
    }
  }, [selectedDate, dateOverrides]);

  const [weekday, setWeekday] = useState<number>(6);
  const existingWeeklyRule = weeklyRules.find((w) => w.weekday === weekday);
  const [weeklyStatus, setWeeklyStatus] = useState<"available" | "unavailable">(
    existingWeeklyRule?.status || "available"
  );
  const [weeklyStart, setWeeklyStart] = useState(existingWeeklyRule?.start_time || "10:00");
  const [weeklyEnd, setWeeklyEnd] = useState(existingWeeklyRule?.end_time || "21:00");
  const [weeklyNote, setWeeklyNote] = useState(existingWeeklyRule?.note || "");

  useEffect(() => {
    const found = weeklyRules.find((w) => w.weekday === weekday);
    if (found) {
      setWeeklyStatus(found.status);
      setWeeklyStart(found.start_time);
      setWeeklyEnd(found.end_time);
      setWeeklyNote(found.note || "");
    } else {
      setWeeklyStatus("available");
      setWeeklyStart("10:00");
      setWeeklyEnd("21:00");
      setWeeklyNote("");
    }
  }, [weekday, weeklyRules]);

  return (
    <section className="bg-white rounded-xl border border-[#E2E4E7] p-3.5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-[#15803D] shrink-0" />
            <span>เวลาว่างของฉัน</span>
          </h2>
          <p className="text-[11px] text-[#6B7280] mt-0.5">
            กำหนดรายวันหรือประจำสัปดาห์
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[#F3F4F6]">
        <button
          type="button"
          onClick={() => setTab("date")}
          className={`px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
            tab === "date"
              ? "bg-white text-[#111827] shadow-xs"
              : "text-[#6B7280] hover:text-[#111827]"
          }`}
        >
          กำหนดรายวัน
        </button>
        <button
          type="button"
          onClick={() => setTab("weekly")}
          className={`px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            tab === "weekly"
              ? "bg-white text-[#111827] shadow-xs"
              : "text-[#6B7280] hover:text-[#111827]"
          }`}
        >
          <Repeat className="w-3 h-3" />
          <span>ประจำสัปดาห์</span>
        </button>
      </div>

      {tab === "date" ? (
        <div className="space-y-2.5">
          <div className="px-2.5 py-1.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-[#6B7280]">วันที่เลือก</div>
              <div className="text-xs font-bold text-[#111827] truncate">
                {formatThaiDateLabel(selectedDate)}
              </div>
            </div>
            {existingDateOverride && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onDeleteDate(selectedDate)}
                title="ล้างค่าเฉพาะวันนี้"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#6B7280] hover:bg-[#E5E7EB] cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                <span>ล้าง</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {[
              { value: "available" as const, label: "ว่าง" },
              { value: "unavailable" as const, label: "ไม่ว่าง" },
              { value: "unknown" as const, label: "ยังไม่ทราบ" },
            ].map((opt) => {
              const active = dateStatus === opt.value;
              const styleMap = {
                available: active
                  ? "bg-[#DCFCE7] border-[#16A34A] text-[#14532D]"
                  : "bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]",
                unavailable: active
                  ? "bg-[#FEE2E2] border-[#DC2626] text-[#991B1B]"
                  : "bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]",
                unknown: active
                  ? "bg-[#F3F4F6] border-[#6B7280] text-[#111827]"
                  : "bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]",
              };
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDateStatus(opt.value)}
                  className={`py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer truncate ${styleMap[opt.value]}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {dateStatus !== "unknown" && (
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[#6B7280] block mb-0.5">ตั้งแต่</span>
                <input
                  type="time"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-[#D1D5DB] text-[11px] text-[#111827] bg-white focus:outline-none focus:border-[#16A34A]"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-medium text-[#6B7280] block mb-0.5">ถึง</span>
                <input
                  type="time"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-1.5 py-1 rounded-lg border border-[#D1D5DB] text-[11px] text-[#111827] bg-white focus:outline-none focus:border-[#16A34A]"
                />
              </label>
            </div>
          )}

          <input
            type="text"
            value={dateNote}
            onChange={(e) => setDateNote(e.target.value)}
            placeholder="หมายเหตุสั้น ๆ (เช่น เลิกงาน 18:00)"
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#16A34A]"
          />

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSaveDate({
                avail_date: selectedDate,
                status: dateStatus,
                start_time: dateStart,
                end_time: dateEnd,
                note: dateNote,
              })
            }
            className="w-full py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกเวลาวันที่เลือก"}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <span className="text-[10px] font-medium text-[#6B7280] block mb-1">
              เลือกวันประจำสัปดาห์
            </span>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_SHORT_TH.map((shortLabel, idx) => {
                const rule = weeklyRules.find((r) => r.weekday === idx);
                const selected = weekday === idx;
                return (
                  <button
                    key={shortLabel}
                    type="button"
                    onClick={() => setWeekday(idx)}
                    className={`py-1 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#111827] text-white border-[#111827]"
                        : rule?.status === "available"
                        ? "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]"
                        : rule?.status === "unavailable"
                        ? "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]"
                        : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setWeeklyStatus("available")}
              className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer truncate ${
                weeklyStatus === "available"
                  ? "bg-[#DCFCE7] border-[#16A34A] text-[#14532D]"
                  : "bg-white border-[#E5E7EB] text-[#4B5563]"
              }`}
            >
              ว่างทุกวัน{WEEKDAY_NAMES_TH[weekday]}
            </button>
            <button
              type="button"
              onClick={() => setWeeklyStatus("unavailable")}
              className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer truncate ${
                weeklyStatus === "unavailable"
                  ? "bg-[#FEE2E2] border-[#DC2626] text-[#991B1B]"
                  : "bg-white border-[#E5E7EB] text-[#4B5563]"
              }`}
            >
              ไม่ว่างทุกวัน{WEEKDAY_NAMES_TH[weekday]}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="block min-w-0">
              <span className="text-[10px] font-medium text-[#6B7280] block mb-0.5">ตั้งแต่</span>
              <input
                type="time"
                value={weeklyStart}
                onChange={(e) => setWeeklyStart(e.target.value)}
                className="w-full px-1.5 py-1 rounded-lg border border-[#D1D5DB] text-[11px] text-[#111827] bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[10px] font-medium text-[#6B7280] block mb-0.5">ถึง</span>
              <input
                type="time"
                value={weeklyEnd}
                onChange={(e) => setWeeklyEnd(e.target.value)}
                className="w-full px-1.5 py-1 rounded-lg border border-[#D1D5DB] text-[11px] text-[#111827] bg-white focus:outline-none focus:border-[#16A34A]"
              />
            </label>
          </div>

          <input
            type="text"
            value={weeklyNote}
            onChange={(e) => setWeeklyNote(e.target.value)}
            placeholder={`หมายเหตุ เช่น ว่างทุกวัน${WEEKDAY_NAMES_TH[weekday]}`}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#16A34A]"
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                onSaveWeekly({
                  weekday,
                  status: weeklyStatus,
                  start_time: weeklyStart,
                  end_time: weeklyEnd,
                  note: weeklyNote,
                })
              }
              className="flex-1 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {saving ? "กำลังบันทึก..." : `บันทึกทุกวัน${WEEKDAY_NAMES_TH[weekday]}`}
            </button>
            {existingWeeklyRule && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onDeleteWeekly(weekday)}
                aria-label="ลบกฎประจำสัปดาห์"
                className="p-2 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {weeklyRules.length > 0 && (
            <div className="pt-2 border-t border-[#E5E7EB] space-y-1">
              <div className="text-[10px] font-semibold text-[#6B7280] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>ตารางประจำสัปดาห์ที่ตั้งไว้</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {weeklyRules.map((r) => (
                  <button
                    key={r.weekday}
                    type="button"
                    onClick={() => setWeekday(r.weekday)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                      r.status === "available"
                        ? "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]"
                        : "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]"
                    }`}
                  >
                    {WEEKDAY_SHORT_TH[r.weekday]} {r.start_time}–{r.end_time}{" "}
                    {r.status === "available" ? "ว่าง" : "ไม่ว่าง"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
