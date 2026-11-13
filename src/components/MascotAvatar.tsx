"use client";

import React from "react";
import Image from "next/image";

export type MascotPose =
  | "welcome"
  | "happy"
  | "excited"
  | "curious"
  | "thinking"
  | "cool"
  | "cheering"
  | "love"
  | "sleepy";

const POSE_SRC: Record<MascotPose, string> = {
  welcome: "/mascot/nong_chuan_welcome_clean.png",
  happy: "/mascot/nong_chuan_happy_clean.png",
  excited: "/mascot/nong_chuan_happy_clean.png",
  curious: "/mascot/nong_chuan_curious_clean.png",
  thinking: "/mascot/nong_chuan_curious_clean.png",
  cool: "/mascot/nong_chuan_cool_clean.png",
  cheering: "/mascot/nong_chuan_happy_clean.png",
  love: "/mascot/nong_chuan_love_clean.png",
  sleepy: "/mascot/nong_chuan_love_clean.png",
};

const POSE_ALT: Record<MascotPose, string> = {
  welcome: "น้องชวนต้อนรับ",
  happy: "น้องชวนยิ้มต้อนรับอย่างมีความสุข",
  excited: "น้องชวนดีใจและตื่นเต้นกับความสนใจร่วมกันของเพื่อน",
  curious: "น้องชวนสงสัยและช่วยตามหาข้อมูลที่ขาดหาย",
  thinking: "น้องชวนกำลังคิดวิเคราะห์ข้อมูลเพื่อน",
  cool: "น้องชวนพร้อมชวนเพื่อนออกทริป",
  cheering: "น้องชวนร่วมยินดีเมื่อส่งคำเชิญสำเร็จ",
  love: "น้องชวนส่งหัวใจให้เพื่อนทุกคน",
  sleepy: "น้องชวนพักผ่อนระหว่างรอข้อมูลเพิ่มเติม",
};

const SIZE_MAP = {
  xs: { cls: "w-11 h-11", px: 44 },
  sm: { cls: "w-14 h-14", px: 56 },
  md: { cls: "w-24 h-24", px: 96 },
  lg: { cls: "w-32 h-32", px: 128 },
  xl: { cls: "w-44 h-44", px: 176 },
};

export function MascotAvatar({
  pose = "welcome",
  size = "md",
  className = "",
  float = true,
}: {
  pose?: MascotPose;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  float?: boolean;
}) {
  const spec = SIZE_MAP[size];
  const isSleepy = pose === "sleepy";

  return (
    <div
      className={`relative shrink-0 select-none transition-transform duration-300 hover:scale-110 hover:-rotate-2 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
        isSleepy ? "opacity-90" : ""
      } ${spec.cls} ${float ? "animate-mascot-alive motion-reduce:animate-none" : ""} ${className}`}
    >
      <Image
        src={POSE_SRC[pose]}
        alt={POSE_ALT[pose]}
        width={spec.px}
        height={spec.px}
        className="w-full h-full object-contain object-center drop-shadow-[0_6px_12px_rgba(31,26,28,0.10)]"
        priority={size === "xl" || size === "lg"}
      />
    </div>
  );
}
