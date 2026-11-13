"use client";

import React, { useState } from "react";

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
  href?: string;
  id?: string | number;
}

export function PastelBarChart({
  items,
  emptyText = "ยังไม่มีข้อมูล",
  unit = "คน",
  onBarClick,
}: {
  items: BarItem[];
  emptyText?: string;
  unit?: string;
  onBarClick?: (label: string, item: BarItem) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#6E666A] bg-[#FAF9F8] rounded-xl border border-[#EAE6E8]">
        {emptyText}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = item.value <= 0 ? 4 : Math.max(8, Math.round((item.value / max) * 100));
        const fill =
          item.color ||
          ["#C2597C", "#8D8298", "#9D8866", "#668E7C", "#6E8096", "#A77488"][idx % 6];
        const isHovered = hoveredIdx === idx;

        const inner = (
          <>
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm mb-1.5">
              <span className="font-medium text-[#1F1A1C] group-hover:text-[#A44363] transition-colors flex items-center gap-2 min-w-0">
                <span className="truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-[11px] font-normal text-[#6E666A] shrink-0">
                    · {item.sublabel}
                  </span>
                )}
              </span>
              <span className="font-semibold text-[#1F1A1C] tabular-nums shrink-0">
                {item.value} {unit}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#F2EFF1] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
                style={{
                  width: `${pct}%`,
                  backgroundColor: fill,
                  filter: isHovered ? "brightness(0.92)" : undefined,
                }}
              />
            </div>
          </>
        );

        if (onBarClick) {
          return (
            <button
              key={`${item.id ?? item.label}-${idx}`}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onBarClick(item.label, item)}
              className="w-full text-left group cursor-pointer rounded-xl p-1.5 -m-1.5 hover:bg-[#FAF9F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={`${item.id ?? item.label}-${idx}`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="w-full rounded-xl p-1 -m-1"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export interface DonutItem {
  slug?: string;
  name_th: string;
  color: string;
  count: number;
}

export function CategoryDonutChart({
  items,
  centerLabel = "รายการ",
  emptyText = "ยังไม่มีข้อมูลความชอบที่บันทึกไว้",
  onSliceClick,
}: {
  items: DonutItem[];
  centerLabel?: string;
  emptyText?: string;
  onSliceClick?: (item: DonutItem) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const total = items.reduce((acc, i) => acc + i.count, 0);

  if (total === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#6E666A] bg-[#FAF9F8] rounded-xl border border-[#EAE6E8]">
        {emptyText}
      </div>
    );
  }

  let cumulative = 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const focused = activeIdx !== null ? items[activeIdx] : null;
  const focusedPct = focused ? Math.round((focused.count / total) * 100) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" aria-hidden="true">
          {items.map((item, idx) => {
            if (item.count <= 0) return null;
            const fraction = item.count / total;
            const dashLength = fraction * circumference;
            const dashOffset = -cumulative * circumference;
            cumulative += fraction;
            const isDimmed = activeIdx !== null && activeIdx !== idx;

            return (
              <circle
                key={idx}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={activeIdx === idx ? "24" : "20"}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                opacity={isDimmed ? 0.45 : 1}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => onSliceClick?.(item)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
          <span className="text-2xl font-bold text-[#1F1A1C] tabular-nums">
            {focused ? `${focusedPct}%` : total}
          </span>
          <span className="text-[10px] font-semibold text-[#6E666A] truncate max-w-[78px]">
            {focused ? focused.name_th : centerLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {items.map((item, idx) => {
          const pct = Math.round((item.count / total) * 100);
          const rowContent = (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#1F1A1C] font-medium truncate">{item.name_th}</span>
              </div>
              <span className="font-semibold text-[#6E666A] tabular-nums shrink-0">
                {item.count} · {pct}%
              </span>
            </>
          );

          if (onSliceClick) {
            return (
              <button
                key={idx}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => onSliceClick(item)}
                className="w-full flex items-center justify-between gap-2 text-xs sm:text-sm px-2 py-1 -mx-2 rounded-xl hover:bg-[#FAF9F8] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
              >
                {rowContent}
              </button>
            );
          }

          return (
            <div
              key={idx}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              className="flex items-center justify-between gap-2 text-xs sm:text-sm px-2 py-1 -mx-2 rounded-xl hover:bg-[#FAF9F8] transition-colors"
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
