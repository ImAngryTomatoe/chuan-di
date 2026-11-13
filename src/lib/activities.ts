import {
  CATEGORY_META,
  CategorySlug,
  FriendDietaryRestrictionItem,
  FriendRecord,
} from "./types";
import { parseFriendConstraints } from "./plans";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateActivityPayload(input: {
  title: string;
  location: string;
  activity_date: string;
  start_time: string;
  end_time?: string | null;
}): string | null {
  if (!input.title.trim()) return "กรุณากรอกชื่อกิจกรรม";
  if (!input.activity_date.trim()) return "กรุณาระบุวันที่จัดกิจกรรม";
  if (!DATE_RE.test(input.activity_date.trim())) {
    return "รูปแบบวันที่ไม่ถูกต้อง ต้องระบุเป็น YYYY-MM-DD";
  }
  const parsedDate = new Date(`${input.activity_date.trim()}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "วันที่ไม่ถูกต้อง กรุณาตรวจสอบปฏิทิน";
  }

  if (!input.start_time.trim() || !TIME_RE.test(input.start_time.trim())) {
    return "กรุณาระบุเวลาเริ่มต้นให้ถูกต้อง รูปแบบ HH:MM";
  }

  if (input.end_time && input.end_time.trim()) {
    if (!TIME_RE.test(input.end_time.trim())) {
      return "รูปแบบเวลาสิ้นสุดไม่ถูกต้อง รูปแบบ HH:MM";
    }
    if (input.end_time.trim() <= input.start_time.trim()) {
      return "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น";
    }
  }

  if (!input.location.trim()) return "กรุณากรอกสถานที่จัดกิจกรรม";
  return null;
}

const TITLE_KEYWORD_HINTS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /หมูกระทะ|หมูย่างกระทะ|หมูกะทะ|bbq|ปิ้งย่าง/i, tag: "หมูกระทะ" },
  { pattern: /ชาบู|shabu|สุกี้/i, tag: "ชาบู" },
  { pattern: /คาเฟ่|cafe|กาแฟ|coffee/i, tag: "คาเฟ่" },
  { pattern: /ทะเล|ชายหาด|beach|sea/i, tag: "ทะเล" },
  { pattern: /ภูเขา|ดอย|แคมป์ปิ้ง|camp/i, tag: "ภูเขา" },
  { pattern: /บอร์ดเกม|board\s*game/i, tag: "บอร์ดเกม" },
  { pattern: /หนัง|movie|cinema|ภาพยนตร์/i, tag: "ดูหนัง" },
  { pattern: /ถ่ายรูป|photo/i, tag: "ถ่ายรูป" },
  { pattern: /ส้มตำ|อาหารอีสาน/i, tag: "ส้มตำ" },
  { pattern: /พิซซ่า|pizza/i, tag: "พิซซ่า" },
  { pattern: /ปิกนิก|picnic/i, tag: "ปิกนิก" },
  { pattern: /วิ่ง|run|ออกกำลังกาย/i, tag: "วิ่งออกกำลังกาย" },
];

export function detectTagsFromActivityTitle(
  title: string,
  knownNormalizedTerms: string[] = []
): string[] {
  const detected = new Set<string>();
  const lowerTitle = title.toLowerCase();

  for (const hint of TITLE_KEYWORD_HINTS) {
    if (hint.pattern.test(title)) {
      detected.add(hint.tag);
    }
  }

  for (const term of knownNormalizedTerms) {
    const clean = term.trim();
    if (clean.length >= 2 && lowerTitle.includes(clean.toLowerCase())) {
      detected.add(clean);
    }
  }

  return Array.from(detected);
}

const ACTIVITY_CATEGORY_TO_INTEREST_CATS: Record<string, CategorySlug[]> = {
  "อาหารและสังสรรค์": ["food_preferences"],
  "คาเฟ่และไลฟ์สไตล์": ["lifestyle", "food_preferences"],
  ท่องเที่ยว: ["travel_interests"],
  "งานอดิเรกและเกม": ["hobbies"],
  "ภาพยนตร์และบันเทิง": ["hobbies", "other_interests"],
  ออกกำลังกาย: ["hobbies", "lifestyle"],
  "อื่น ๆ": ["other_interests"],
};

export interface RecommendedFriendResult {
  id: number;
  full_name: string;
  nickname: string;
  religion: string;
  cannot_eat: string;
  avatar_color: string;
  contact_info: string | null;
  matchedLikes: string[];
  categoryRelated: string[];
  dislikes: Array<{ normalized_value: string; restriction_type: "allergy" | "dislike" | null }>;
  dietary_restrictions: FriendDietaryRestrictionItem[];
  dietaryWarnings: string[];
  hasTargetConflict: boolean;
  matchScore: number;
  recommendationReason: string;
}

export function buildFriendRecommendations(
  friends: FriendRecord[],
  targetTags: string[],
  activityCategory: string
): RecommendedFriendResult[] {
  const lowerTags = targetTags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const preferredCats = ACTIVITY_CATEGORY_TO_INTEREST_CATS[activityCategory] || [];

  return friends
    .map((f) => {
      const matchedLikes: string[] = [];
      const seenMatched = new Set<string>();
      const categoryRelated: string[] = [];
      const seenRelated = new Set<string>();
      const dislikes: Array<{
        normalized_value: string;
        restriction_type: "allergy" | "dislike" | null;
      }> = [];

      for (const item of f.interests) {
        if (item.category_slug === "disliked_food") {
          dislikes.push({
            normalized_value: item.normalized_value,
            restriction_type: item.restriction_type ?? "dislike",
          });
          continue;
        }

        const normLower = item.normalized_value.toLowerCase();
        if (lowerTags.includes(normLower) && !seenMatched.has(normLower)) {
          seenMatched.add(normLower);
          matchedLikes.push(item.normalized_value);
        } else if (
          preferredCats.includes(item.category_slug) &&
          !seenRelated.has(normLower)
        ) {
          seenRelated.add(normLower);
          categoryRelated.push(item.normalized_value);
        }
      }

      const constraints = parseFriendConstraints(f);
      const dislikesSet = new Set(dislikes.map((d) => d.normalized_value.toLowerCase()));
      const effectiveMatchedLikes = matchedLikes.filter(
        (val) => !dislikesSet.has(val.toLowerCase())
      );
      const conflictedTargets = dislikes
        .map((d) => d.normalized_value)
        .filter((val) => lowerTags.includes(val.toLowerCase()));

      // Check dietary restrictions & food conflicts without removing friend from list
      const hasPorkTag = lowerTags.some((t) => /หมูกระทะ|หมู|แฮม|เบคอน/.test(t));
      const dietConflicts: string[] = [];
      const dietaryWarnings: string[] = [];

      if (constraints.wantsHalal) {
        dietaryWarnings.push(
          `น้องชวนเจอว่า${f.nickname}ต้องการอาหารฮาลาล ลองตรวจสอบร้านก่อนนะ จะได้ชวนเพื่อนไปสนุกด้วยกันทุกคน!`
        );
      } else if (constraints.noPork) {
        dietaryWarnings.push(
          `น้องชวนเจอว่า${f.nickname}ไม่กินหมู ลองเช็กเมนูทางเลือกของร้านก่อนชวนนะ`
        );
      }
      if (constraints.noBeef) {
        dietaryWarnings.push(`น้องชวนเจอว่า${f.nickname}ไม่กินเนื้อวัว ควรเช็กเมนูทางเลือกของร้าน`);
      }
      if (constraints.vegan) {
        dietaryWarnings.push(`น้องชวนเจอว่า${f.nickname}ทานวีแกน ควรเช็กเมนูปลอดเนื้อสัตว์และนมไข่`);
      } else if (constraints.vegetarian) {
        dietaryWarnings.push(`น้องชวนเจอว่า${f.nickname}ทานมังสวิรัติ ควรเช็กเมนูผักและเต้าหู้`);
      }
      if (constraints.alcoholFree) {
        dietaryWarnings.push(`น้องชวนเจอว่า${f.nickname}ไม่ดื่มแอลกอฮอล์`);
      }
      if (constraints.allergies.length > 0) {
        dietaryWarnings.push(
          `${f.nickname}แพ้อาหาร: ${constraints.allergies.join(", ")} ควรแจ้งร้านก่อนสั่ง`
        );
      }

      if (hasPorkTag && constraints.noPork) {
        dietConflicts.push(
          constraints.wantsHalal
            ? "ต้องการอาหารฮาลาลและไม่กินหมู"
            : constraints.vegetarian
              ? "ทานมังสวิรัติ งดเนื้อสัตว์ใหญ่"
              : "ไม่กินหมู"
        );
      }

      const hasTargetConflict = conflictedTargets.length > 0 || dietConflicts.length > 0;

      const matchScore = hasTargetConflict
        ? 0
        : effectiveMatchedLikes.length * 10 + categoryRelated.length;
      const reasonParts: string[] = [];
      if (hasTargetConflict) {
        const conflictSummary = [...conflictedTargets, ...dietConflicts].join(", ");
        reasonParts.push(`มีข้อควรระวังตรงกับกิจกรรม: ${conflictSummary}`);
      } else if (effectiveMatchedLikes.length > 0) {
        reasonParts.push(`ชอบตรงกับกิจกรรม: ${effectiveMatchedLikes.join(", ")}`);
      } else if (categoryRelated.length > 0) {
        const catNames = preferredCats
          .map((slug) => CATEGORY_META[slug]?.name_th)
          .filter(Boolean)
          .join("/");
        reasonParts.push(
          `สนใจในหมวด${catNames || activityCategory}: ${categoryRelated.slice(0, 3).join(", ")}`
        );
      } else {
        reasonParts.push("ยังไม่มีความชอบที่ตรงแท็กโดยตรง");
      }

      const dietaryLabels = (f.dietary_restrictions || []).map((d) => d.restriction_label);
      if (dietaryLabels.length > 0) {
        reasonParts.push(`ข้อจำกัดด้านอาหาร: ${dietaryLabels.join(", ")}`);
      } else if (f.cannot_eat) {
        reasonParts.push(`ข้อจำกัดด้านอาหาร: ${f.cannot_eat}`);
      }

      if (dislikes.length > 0) {
        const formatted = dislikes
          .map((d) =>
            d.restriction_type === "allergy"
              ? `แพ้ ${d.normalized_value}`
              : `ไม่ชอบ ${d.normalized_value}`
          )
          .join(", ");
        reasonParts.push(`ข้อควรระวัง: ${formatted}`);
      }

      return {
        id: f.id,
        full_name: f.full_name,
        nickname: f.nickname,
        religion: f.religion || "ไม่ระบุ",
        cannot_eat: f.cannot_eat || "",
        avatar_color: f.avatar_color,
        contact_info: f.contact_info,
        matchedLikes: hasTargetConflict ? [] : effectiveMatchedLikes,
        categoryRelated,
        dislikes,
        dietary_restrictions: f.dietary_restrictions || [],
        dietaryWarnings,
        hasTargetConflict,
        matchScore,
        recommendationReason: reasonParts.join(" • "),
      };
    })
    .sort(
      (a, b) =>
        b.matchedLikes.length - a.matchedLikes.length ||
        b.matchScore - a.matchScore ||
        a.nickname.localeCompare(b.nickname, "th")
    );
}
