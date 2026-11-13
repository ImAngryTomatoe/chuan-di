"use client";

import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A1C]/40 backdrop-blur-sm p-4"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE6E8]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? "bg-[#FDF3F2] text-[#A3322E]" : "bg-[#F9F2F5] text-[#B3486B]"
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 id="confirm-modal-title" className="text-lg font-bold text-[#1F1A1C]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ปิดหน้าต่างยืนยัน"
            className="p-1.5 rounded-xl text-[#6E666A] hover:bg-[#FAF9F8] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-[#4A4346] leading-relaxed">{message}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-[#EAE6E8] text-sm font-semibold text-[#4A4346] hover:bg-[#FAF9F8] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors cursor-pointer disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
              danger
                ? "bg-[#A3322E] hover:bg-[#872824] focus-visible:ring-[#A3322E]"
                : "bg-[#B3486B] hover:bg-[#993858] focus-visible:ring-[#B3486B]"
            }`}
          >
            {loading ? "กำลังดำเนินการ" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
