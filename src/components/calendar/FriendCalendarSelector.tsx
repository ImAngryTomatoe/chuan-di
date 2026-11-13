"use client";

import React, { useMemo, useState } from "react";
import { Check, Search, Sparkles, Users } from "lucide-react";

export interface FriendCatalogItem {
  id: number;
  nickname: string;
  full_name: string;
  avatar_color: string;
  is_shared: boolean;
  google_connected?: boolean;
  interests: string[];
}

export interface InterestGroupItem {
  tag: string;
  count: number;
  friendIds: number[];
}

interface Props {
  friends: FriendCatalogItem[];
  interestGroups: InterestGroupItem[];
  selectedFriendIds: number[];
  onChangeSelected: (ids: number[]) => void;
}

export function FriendCalendarSelector({
  friends,
  interestGroups,
  selectedFriendIds,
  onChangeSelected,
}: Props) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedFriendIds), [selectedFriendIds]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.nickname.toLowerCase().includes(q) ||
        f.full_name.toLowerCase().includes(q) ||
        f.interests.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [friends, query]);

  const sharedIds = useMemo(
    () => friends.filter((f) => f.is_shared).map((f) => f.id),
    [friends]
  );

  const activeGroupTag = useMemo(() => {
    if (selectedFriendIds.length === 0) return "";
    const matched = interestGroups.find(
      (g) =>
        g.friendIds.length === selectedFriendIds.length &&
        g.friendIds.every((id) => selectedSet.has(id))
    );
    return matched?.tag ?? "";
  }, [interestGroups, selectedFriendIds, selectedSet]);

  function toggleFriend(id: number) {
    if (selectedSet.has(id)) {
      onChangeSelected(selectedFriendIds.filter((x) => x !== id));
    } else {
      onChangeSelected([...selectedFriendIds, id]);
    }
  }

  function handleInterestSelect(tag: string) {
    if (!tag) return;
    const found = interestGroups.find((g) => g.tag === tag);
    if (found) {
      onChangeSelected(found.friendIds);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-[#E2E4E7] p-3.5 shadow-xs space-y-2.5">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-4 h-4 text-[#15803D] shrink-0" />
          <h2 className="text-xs font-bold text-[#111827] truncate">เลือกเพื่อน</h2>
          <span className="px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#166534] text-[10px] font-bold tabular-nums shrink-0">
            {selectedFriendIds.length}/{friends.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {sharedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeSelected(sharedIds)}
              className="px-2 py-1 rounded-md bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F2937] text-[10px] font-semibold transition-colors cursor-pointer"
            >
              ที่แชร์
            </button>
          )}
          <button
            type="button"
            onClick={() => onChangeSelected([])}
            className="px-2 py-1 rounded-md bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] text-[10px] font-medium transition-colors cursor-pointer"
          >
            ล้าง
          </button>
        </div>
      </div>

      {/* Compact Interest Group Dropdown */}
      {interestGroups.length > 0 && (
        <div className="relative">
          <Sparkles className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            aria-label="เลือกตามกลุ่มความสนใจ"
            value={activeGroupTag}
            onChange={(e) => handleInterestSelect(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-[#E2E4E7] bg-[#F9FAFB] text-[11px] font-medium text-[#1F2937] focus:bg-white focus:outline-none focus:border-[#16A34A] cursor-pointer"
          >
            <option value="">เลือกด่วนตามความชอบ...</option>
            {interestGroups.map((g) => (
              <option key={g.tag} value={g.tag}>
                {g.tag} ({g.count} คน)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อ หรือความชอบ..."
          className="w-full pl-7 pr-2.5 py-1.5 rounded-lg border border-[#E2E4E7] bg-[#F9FAFB] text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:border-[#16A34A]"
        />
      </div>

      {/* Dense Friend Checklist */}
      <div className="max-h-52 overflow-y-auto pr-0.5 space-y-1">
        {filteredFriends.length === 0 ? (
          <div className="py-5 text-center text-xs text-[#6B7280]">
            ไม่พบรายชื่อเพื่อนที่ค้นหา
          </div>
        ) : (
          filteredFriends.map((f) => {
            const checked = selectedSet.has(f.id);
            const titleHint = f.interests.length > 0
              ? `${f.full_name} · ${f.interests.slice(0, 4).join(", ")}`
              : f.full_name;
            return (
              <label
                key={f.id}
                title={titleHint}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer select-none ${
                  checked
                    ? "bg-[#ECFDF5] border-[#86EFAC]"
                    : "bg-white border-transparent hover:bg-[#F9FAFB] hover:border-[#E5E7EB]"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFriend(f.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked
                        ? "bg-[#16A34A] border-[#16A34A] text-white"
                        : "bg-white border-[#D1D5DB]"
                    }`}
                  >
                    {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </span>

                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: f.avatar_color }}
                  />

                  <span className="text-xs font-semibold text-[#111827] truncate">
                    {f.nickname}
                  </span>
                </span>

                <span
                  className={`text-[10px] font-medium shrink-0 ${
                    f.is_shared
                      ? f.google_connected
                        ? "px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534]"
                        : "text-[#15803D]"
                      : "text-[#9CA3AF]"
                  }`}
                >
                  {f.is_shared
                    ? f.google_connected
                      ? "Google"
                      : "แชร์แล้ว"
                    : "ยังไม่ทราบ"}
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
