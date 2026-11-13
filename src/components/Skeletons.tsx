"use client";

import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลดข้อมูลแดชบอร์ด">
      <div className="h-36 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 h-72 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
        <div className="lg:col-span-5 h-72 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-busy="true"
      aria-label="กำลังโหลดรายการ"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-44 rounded-2xl skeleton-shimmer border border-[#EAE6E8]"
        />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6" aria-busy="true" aria-label="กำลังโหลดรายละเอียด">
      <div className="h-10 w-44 rounded-xl skeleton-shimmer" />
      <div className="h-40 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
      <div className="h-64 rounded-2xl skeleton-shimmer border border-[#EAE6E8]" />
    </div>
  );
}
