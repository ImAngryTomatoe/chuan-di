import { ExtractCategorySlug } from "./types";

interface NormalizationEntry {
  canonical: string;
  defaultCategory?: ExtractCategorySlug;
  variants: string[];
}

const NORMALIZATION_TABLE: NormalizationEntry[] = [
  {
    canonical: "หมูกระทะ",
    defaultCategory: "food_preferences",
    variants: ["หมูกระทะ", "หมูย่างกระทะ", "หมูกะทะ", "ปิ้งย่างหมูกระทะ", "mookata", "thai bbq"],
  },
  {
    canonical: "ชาบู",
    defaultCategory: "food_preferences",
    variants: ["ชาบู", "ชาบูชาบู", "สุกี้ชาบู", "shabu", "shabu shabu"],
  },
  {
    canonical: "คาเฟ่",
    defaultCategory: "lifestyle",
    variants: ["คาเฟ่", "ร้านกาแฟ", "ไปคาเฟ่", "cafe", "café", "cafe hopping", "คาเฟ่ฮอปปิ้ง", "coffee shop"],
  },
  {
    canonical: "กาแฟ",
    defaultCategory: "food_preferences",
    variants: ["กาแฟ", "ดื่มกาแฟ", "coffee", "ลาเต้", "อเมริกาโน่", "เอสเปรสโซ่"],
  },
  {
    canonical: "ทะเล",
    defaultCategory: "travel_interests",
    variants: ["ทะเล", "เที่ยวทะเล", "ไปทะเล", "ชายหาด", "ริมทะเล", "beach", "sea"],
  },
  {
    canonical: "ภูเขา",
    defaultCategory: "travel_interests",
    variants: ["ภูเขา", "เที่ยวภูเขา", "ขึ้นดอย", "ดอย", "mountain", "mountains"],
  },
  {
    canonical: "แคมป์ปิ้ง",
    defaultCategory: "travel_interests",
    variants: ["แคมป์ปิ้ง", "กางเต็นท์", "แคมปิ้ง", "camping"],
  },
  {
    canonical: "เดินทาง",
    defaultCategory: "travel_interests",
    variants: ["เดินทาง", "ท่องเที่ยว", "ไปเที่ยว", "เที่ยวต่างจังหวัด", "travel", "traveling", "travelling"],
  },
  {
    canonical: "ถ่ายรูป",
    defaultCategory: "hobbies",
    variants: ["ถ่ายรูป", "ถ่ายภาพ", "กล้องฟิล์ม", "photography", "taking photos"],
  },
  {
    canonical: "บอร์ดเกม",
    defaultCategory: "hobbies",
    variants: ["บอร์ดเกม", "เล่นบอร์ดเกม", "board game", "board games", "boardgame"],
  },
  {
    canonical: "ดูหนัง",
    defaultCategory: "hobbies",
    variants: ["ดูหนัง", "ดูภาพยนตร์", "ภาพยนตร์", "หนัง", "movie", "movies", "cinema"],
  },
  {
    canonical: "อ่านหนังสือ",
    defaultCategory: "hobbies",
    variants: ["อ่านหนังสือ", "อ่านนิยาย", "reading", "books"],
  },
  {
    canonical: "ทำขนม",
    defaultCategory: "hobbies",
    variants: ["ทำขนม", "เบเกอรี่", "อบขนม", "baking"],
  },
  {
    canonical: "วิ่งออกกำลังกาย",
    defaultCategory: "hobbies",
    variants: ["วิ่งออกกำลังกาย", "วิ่ง", "ออกกำลังกาย", "running", "jogging"],
  },
  {
    canonical: "อาหารทะเล",
    defaultCategory: "food_preferences",
    variants: ["อาหารทะเล", "ซีฟู้ด", "อาหารซีฟู้ด", "กุ้งเผา", "seafood"],
  },
  {
    canonical: "อาหารเผ็ด",
    defaultCategory: "disliked_food",
    variants: ["อาหารเผ็ด", "ของเผ็ด", "อาหารรสเผ็ด", "เผ็ด", "spicy food", "spicy"],
  },
  {
    canonical: "อาหารเกาหลี",
    defaultCategory: "food_preferences",
    variants: ["อาหารเกาหลี", "ปิ้งย่างเกาหลี", "korean food", "korean bbq"],
  },
  {
    canonical: "อาหารญี่ปุ่น",
    defaultCategory: "food_preferences",
    variants: ["อาหารญี่ปุ่น", "japanese food"],
  },
  {
    canonical: "ซูชิ",
    defaultCategory: "food_preferences",
    variants: ["ซูชิ", "ปลาดิบ", "ซาชิมิ", "sushi", "sashimi"],
  },
  {
    canonical: "ส้มตำ",
    defaultCategory: "food_preferences",
    variants: ["ส้มตำ", "อาหารอีสาน", "ยำ", "somtum"],
  },
  {
    canonical: "ทุเรียน",
    defaultCategory: "disliked_food",
    variants: ["ทุเรียน", "durian"],
  },
  {
    canonical: "ผักชี",
    defaultCategory: "disliked_food",
    variants: ["ผักชี", "coriander", "cilantro"],
  },
  {
    canonical: "ของหวาน",
    defaultCategory: "food_preferences",
    variants: ["ของหวาน", "ขนมหวาน", "เค้ก", "บิงซู", "dessert", "desserts", "sweets"],
  },
  {
    canonical: "เนื้อวัว",
    defaultCategory: "food_preferences",
    variants: ["เนื้อวัว", "เนื้อ", "beef"],
  },
  {
    canonical: "ต้องการอาหารฮาลาล",
    defaultCategory: "dietary_restriction",
    variants: [
      "ต้องการอาหารฮาลาล",
      "เลือกอาหารฮาลาล",
      "กินอาหารฮาลาล",
      "ทานอาหารฮาลาล",
      "รับประทานอาหารฮาลาล",
      "อาหารฮาลาล",
      "ฮาลาล",
      "halal",
    ],
  },
  {
    canonical: "ไม่ดื่มแอลกอฮอล์",
    defaultCategory: "dietary_restriction",
    variants: ["ไม่ดื่มแอลกอฮอล์", "งดแอลกอฮอล์", "ไม่กินแอลกอฮอล์", "แอลกอฮอล์", "alcohol", "ไม่ดื่มเหล้า", "ไม่ดื่มเบียร์"],
  },
  {
    canonical: "มังสวิรัติ",
    defaultCategory: "dietary_restriction",
    variants: ["มังสวิรัติ", "อาหารมังสวิรัติ", "vegetarian"],
  },
  {
    canonical: "วีแกน",
    defaultCategory: "dietary_restriction",
    variants: ["วีแกน", "อาหารวีแกน", "vegan"],
  },
  {
    canonical: "ชานมไข่มุก",
    defaultCategory: "food_preferences",
    variants: ["ชานมไข่มุก", "ชานม", "ไข่มุก", "bubble tea", "boba"],
  },
  {
    canonical: "พิซซ่า",
    defaultCategory: "food_preferences",
    variants: ["พิซซ่า", "pizza"],
  },
  {
    canonical: "ดนตรี",
    defaultCategory: "other_interests",
    variants: ["ดนตรี", "ฟังเพลง", "คอนเสิร์ต", "music", "concert"],
  },
  {
    canonical: "เกม",
    defaultCategory: "other_interests",
    variants: ["เล่นเกม", "เกม", "gaming", "video games"],
  },
  {
    canonical: "รักสัตว์",
    defaultCategory: "lifestyle",
    variants: ["รักสัตว์", "ชอบแมว", "ชอบหมา", "ทาสแมว", "pet lover"],
  },
  {
    canonical: "สายชิล",
    defaultCategory: "lifestyle",
    variants: ["สายชิล", "ชิล", "ชิวๆ", "นั่งชิล", "chill"],
  },
  {
    canonical: "ปิกนิก",
    defaultCategory: "travel_interests",
    variants: ["ปิกนิก", "เดินสวน", "สวนสาธารณะ", "picnic"],
  },
];

const VARIANT_LOOKUP: Array<{ variant: string; canonical: string; defaultCategory?: ExtractCategorySlug }> = [];
for (const entry of NORMALIZATION_TABLE) {
  for (const v of entry.variants) {
    VARIANT_LOOKUP.push({
      variant: v.toLowerCase(),
      canonical: entry.canonical,
      defaultCategory: entry.defaultCategory,
    });
  }
}
VARIANT_LOOKUP.sort((a, b) => b.variant.length - a.variant.length);

const VAGUE_TERMS = new Set([
  "อะไรก็ได้",
  "ทั่วไป",
  "ปกติ",
  "ไม่แน่ใจ",
  "แล้วแต่",
  "บางอย่าง",
  "นิดหน่อย",
  "เยอะ",
  "ทุกอย่าง",
  "anything",
  "something",
  "normal",
]);

export function normalizeInterestTerm(
  rawTerm: string,
  hintCategory?: ExtractCategorySlug
): { normalized: string; suggestedCategory?: ExtractCategorySlug } {
  const cleaned = rawTerm
    .trim()
    .replace(/^(?:ไปกิน|ไปเที่ยว|กิน|ทาน|ดื่ม|เลือก|ต้องการ|ไป|เที่ยว|เล่น|ดู|ฟัง|ชอบ|เรื่อง)\s*/i, "")
    .replace(/^(?:และ|กับ|หรือ|แต่)\s*/i, "")
    .replace(/(?:และ|กับ|หรือ|แต่)$/i, "")
    .replace(/[.!?,"'()]+$/g, "")
    .trim();

  const lower = cleaned.toLowerCase();

  // Explicit dietary restriction normalizations preserved regardless of generic fallback
  if (hintCategory === "dietary_restriction") {
    if (/ฮาลาล|halal/.test(lower)) {
      return { normalized: "ต้องการอาหารฮาลาล", suggestedCategory: "dietary_restriction" };
    }
    if (/^(?:เนื้อ)?หมู$|^pork$/.test(lower)) {
      return { normalized: "ไม่กินหมู", suggestedCategory: "dietary_restriction" };
    }
    if (/^(?:เนื้อ)?วัว$|^beef$/.test(lower)) {
      return { normalized: "ไม่กินเนื้อวัว", suggestedCategory: "dietary_restriction" };
    }
    if (/แอลกอฮอล์|เหล้า|เบียร์|alcohol/.test(lower)) {
      return { normalized: "ไม่ดื่มแอลกอฮอล์", suggestedCategory: "dietary_restriction" };
    }
    if (/มังสวิรัติ|vegetarian/.test(lower)) {
      return { normalized: "มังสวิรัติ", suggestedCategory: "dietary_restriction" };
    }
    if (/วีแกน|vegan/.test(lower)) {
      return { normalized: "วีแกน", suggestedCategory: "dietary_restriction" };
    }
    return {
      normalized: cleaned || rawTerm.trim(),
      suggestedCategory: "dietary_restriction",
    };
  }

  for (const item of VARIANT_LOOKUP) {
    if (lower === item.variant || (lower.length <= 24 && lower.includes(item.variant))) {
      // Never convert negative/disliked items into positive categories
      const cat =
        hintCategory === "disliked_food"
          ? "disliked_food"
          : item.defaultCategory || hintCategory;
      return { normalized: item.canonical, suggestedCategory: cat };
    }
  }
  return {
    normalized: cleaned || rawTerm.trim(),
    suggestedCategory: hintCategory,
  };
}

export interface RawExtractedTuple {
  friendName: string;
  category: ExtractCategorySlug;
  rawValue: string;
  normalizedValue: string;
  confidence: number;
  isAmbiguous: boolean;
  uncertaintyReason: string | null;
  restrictionType: "allergy" | "dislike" | null;
}

export interface ExtractionResult {
  mode: "llm_openai" | "llm_gemini" | "rule_based_fallback";
  items: RawExtractedTuple[];
  warnings: string[];
}

const SPLIT_INLINE_STOPWORDS = new Set([
  "และ",
  "กับ",
  "หรือ",
  "แต่",
  "แล้วก็",
  "รวมถึง",
  "ส่วน",
  "เพื่อน",
  "ฉัน",
  "เรา",
  "ผม",
  "หนู",
  "เขา",
  "ใคร",
  "บางคน",
  "ไม่รู้",
  "ไม่แน่ใจ",
  "อาจจะ",
  "น่าจะ",
  "ชอบ",
  "ไม่ชอบ",
  "ไม่กิน",
  "ไม่ทาน",
  "ไม่ดื่ม",
  "แพ้",
  "งด",
  "ต้องการ",
  "เลือก",
  "หมู",
  "ไก่",
  "เนื้อ",
  "กุ้ง",
  "ปลา",
  "ปู",
  "หอย",
  "อาหาร",
  "อาหารทะเล",
  "อาหารฮาลาล",
  "ฮาลาล",
  "แอลกอฮอล์",
  "มังสวิรัติ",
  "วีแกน",
  "ทะเล",
  "ภูเขา",
  "คาเฟ่",
  "กาแฟ",
  "ชาบู",
  "หมูกระทะ",
]);

function splitInlinePeopleLines(text: string): string[] {
  const pre = text
    .replace(/\r\n/g, "\n")
    .replace(
      /\s+(?=(?:ส่วน(?:เพื่อนชื่อ)?|และเพื่อนอีกคนชื่อ|อีกคนชื่อ|แล้วก็เพื่อนชื่อ|whereas\b|meanwhile\b))/gi,
      "\n"
    );

  const verbLeadRegex =
    /^(?:ชอบ(?:กิน|ทาน|ไป|เที่ยว|เล่น|ดู|อ่าน|ทำ|ถ่าย|ฟัง|ดื่ม)?|ไม่ชอบ(?:กิน|ทาน)?|ไม่กิน|ไม่ทาน|ไม่ดื่ม|ไม่รับประทาน|ต้องการอาหาร|เลือกอาหาร|ต้องการ|เลือก|แพ้|งด|เป็นมังสวิรัติ|เป็นวีแกน|กินมังสวิรัติ|ทานมังสวิรัติ|กินเจ|ทานเจ|likes?|dislikes?|hates?|loves?)/i;

  const outLines: string[] = [];
  for (const rawLine of pre.split("\n")) {
    const cleanLine = rawLine.trim();
    if (!cleanLine) continue;

    // Also split mid-line spaces where a new friend name directly precedes a personal verb (e.g. "แนนชอบหมูกระทะ อามีนไม่กินหมู")
    const parts = cleanLine.split(/\s+/);
    let buffer = "";
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      if (!buffer) {
        buffer = token;
        continue;
      }

      // Inspect token attached directly to a verb: e.g., "อามีนไม่กินหมู..."
      const attachedMatch = token.match(
        /^([A-Za-zก-๙]{2,18}?)(ชอบ|ไม่ชอบ|ไม่กิน|ไม่ทาน|ไม่ดื่ม|ไม่รับประทาน|ต้องการ|เลือก|แพ้|งด|เป็นมังสวิรัติ|เป็นวีแกน)(.*)$/
      );
      const isAttachedPerson =
        attachedMatch &&
        !SPLIT_INLINE_STOPWORDS.has(attachedMatch[1].toLowerCase()) &&
        !VARIANT_LOOKUP.some((v) => v.variant === attachedMatch[1].toLowerCase());

      // Inspect spaced capitalized English name + verb on next token: e.g., "Bob ชอบ..."
      const isSpacedEngPerson =
        i + 1 < parts.length &&
        /^[A-Z][a-zA-Z]{1,18}$/.test(token) &&
        verbLeadRegex.test(parts[i + 1]) &&
        !SPLIT_INLINE_STOPWORDS.has(token.toLowerCase());

      if (isAttachedPerson || isSpacedEngPerson) {
        outLines.push(buffer);
        buffer = token;
      } else {
        buffer += " " + token;
      }
    }
    if (buffer) outLines.push(buffer);
  }

  return outLines;
}

function splitPersonSegments(
  text: string
): Array<{ personHint: string; body: string; personMissing: boolean }> {
  const lines = splitInlinePeopleLines(text)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const segments: Array<{ personHint: string; body: string; personMissing: boolean }> = [];
  const personVerbLookahead =
    "(?:ชอบ|ไม่ชอบ|ไม่กิน|ไม่ทาน|ไม่ดื่ม|ไม่รับประทาน|ต้องการ|เลือก|แพ้|งด|สนใจ|อยากไป|อยากกิน|อยากลอง|โปรด|รัก|เป็นสาย|เป็นมังสวิรัติ|เป็นวีแกน|กินอาหาร|ทานอาหาร|กินมังสวิรัติ|ทานมังสวิรัติ|กินเจ|likes?|dislikes?|hates?|loves?|is\\s)";

  for (const rawLine of lines) {
    const line = rawLine.replace(/^ส่วน(?:เพื่อนชื่อ)?\s*/i, (m, _offset, str) => {
      // Only strip "ส่วน" when followed by a name + verb or colon
      const rest = str.slice(m.length);
      return /^[A-Za-zก-๙]/.test(rest) ? "" : m;
    });

    // Pattern 1: "Alice: ชอบ..."
    let match = line.match(
      /^(?:เพื่อน(?:เรา|ของฉัน|ผม|ใหม่|สนิท|ร่วมงาน|เก่า|ที่ทำงาน)?\s*ชื่อ|คุณ|น้อง|พี่)?\s*([A-Za-zก-๙]{2,24}?)\s*[:：]\s*(.+)$/
    );
    if (match) {
      segments.push({ personHint: match[1].trim(), body: match[2].trim(), personMissing: false });
      continue;
    }

    // Pattern 2: "เพื่อนเราชื่อ Alice ชอบ..." or "เพื่อนใหม่ชื่อ น้องเฟิร์น ชอบ..."
    match = line.match(
      new RegExp(
        `^(?:เพื่อน(?:เรา|ของฉัน|ผม|ใหม่|สนิท|ร่วมงาน|เก่า|ที่ทำงาน)?\\s*ชื่อ)\\s*([A-Za-zก-๙]{2,24}?)\\s*(?=${personVerbLookahead})(.+)$`,
        "i"
      )
    );
    if (match) {
      segments.push({ personHint: match[1].trim(), body: match[2].trim(), personMissing: false });
      continue;
    }

    // Pattern 3: Direct name before verb: "มิ้นท์ชอบชาบู" or "อามีนไม่กินหมู..." or "Alice likes..."
    match = line.match(
      new RegExp(`^([A-Za-zก-๙]{2,20}?)\\s*(?=${personVerbLookahead})(.+)$`, "i")
    );
    const candidateName = match?.[1]?.trim() || "";
    if (
      match &&
      !SPLIT_INLINE_STOPWORDS.has(candidateName.toLowerCase()) &&
      !["ไม่", "น่าจะ", "อาจจะ"].includes(candidateName)
    ) {
      segments.push({ personHint: candidateName, body: match[2].trim(), personMissing: false });
      continue;
    }

    // Ambiguous / missing person name
    if (segments.length > 0 && !/^(ส่วน|เพื่อน|ใคร|บางคน)/.test(rawLine)) {
      segments[segments.length - 1].body += " " + rawLine;
    } else {
      segments.push({ personHint: "ไม่ระบุชื่อเพื่อน", body: rawLine, personMissing: true });
    }
  }

  return segments;
}

function splitInterestTokens(rawPhrase: string): string[] {
  return rawPhrase
    .replace(/(?:^|\s)(?:แต่|และ|หรือ|แล้วก็|รวมถึง)(?:\s|$)/gi, "|")
    .replace(/\s*(?:และ|กับ|แล้วก็|รวมถึง|หรือ|แต่|and|&|,|\/)\s*/gi, "|")
    .replace(/([ก-๙a-zA-Z])กับ([ก-๙a-zA-Z])/g, "$1|$2")
    .replace(/([ก-๙a-zA-Z])และ([ก-๙a-zA-Z])/g, "$1|$2")
    .split("|")
    .map((s) => s.replace(/^(?:และ|กับ|หรือ|แต่)\s*/i, "").replace(/\s*(?:และ|กับ|หรือ|แต่)$/i, "").trim())
    .filter((s) => s.length >= 2 && s.length <= 50);
}

function inferCategoryFromClause(
  verb: string,
  token: string
): { category: ExtractCategorySlug; restrictionType: "allergy" | "dislike" | null } {
  const v = verb.trim().toLowerCase();
  const t = token.trim().toLowerCase();

  // Allergies always stay disliked_food + restrictionType="allergy" (displayed clearly in "อาหารที่แพ้" section)
  if (/แพ้|allergic/.test(v)) {
    return { category: "disliked_food", restrictionType: "allergy" };
  }

  // Religious / cultural / dietary restrictions
  if (/ฮาลาล|halal|มังสวิรัติ|vegetarian|วีแกน|vegan/.test(t)) {
    return { category: "dietary_restriction", restrictionType: null };
  }
  if (
    /ไม่กิน|ไม่ทาน|ไม่รับประทาน|งด|หลีกเลี่ยง|ห้ามกิน/.test(v) &&
    /^(?:เนื้อ)?หมู$|^pork$|^(?:เนื้อ)?วัว$|^beef$/.test(t)
  ) {
    return { category: "dietary_restriction", restrictionType: null };
  }
  if (
    /ไม่ดื่ม|งด|ไม่กิน|ไม่ทาน/.test(v) &&
    /แอลกอฮอล์|เหล้า|เบียร์|ไวน์|alcohol/.test(t)
  ) {
    return { category: "dietary_restriction", restrictionType: null };
  }
  if (/เป็นมังสวิรัติ|เป็นวีแกน|กินเจ|ทานเจ/.test(`${v}${t}`) || /^เจ$/.test(t)) {
    return { category: "dietary_restriction", restrictionType: null };
  }

  // Disliked food (distinct from dietary restriction & allergies)
  if (/ไม่ชอบ|ไม่กิน|ไม่ทาน|ไม่ดื่ม|ไม่รับประทาน|งด|เกลียด|หลีกเลี่ยง|ห้ามกิน|dislike|hate/.test(v)) {
    return { category: "disliked_food", restrictionType: "dislike" };
  }

  if (/กิน|ทาน|รับประทาน|ดื่ม|อาหาร|ร้านอาหาร|เครื่องดื่ม|eat|food/.test(v)) {
    return { category: "food_preferences", restrictionType: null };
  }
  if (/ต้องการ|เลือก/.test(v)) {
    if (/อาหาร|เมนู|ร้าน/.test(t)) {
      return { category: "food_preferences", restrictionType: null };
    }
    return { category: "other_interests", restrictionType: null };
  }
  if (/เที่ยว|อยากไป|travel|trip|visit/.test(v)) {
    return { category: "travel_interests", restrictionType: null };
  }
  if (/ไป/.test(v)) {
    if (/คาเฟ่|ร้านกาแฟ|cafe|coffee shop/.test(t)) {
      return { category: "lifestyle", restrictionType: null };
    }
    return { category: "travel_interests", restrictionType: null };
  }
  if (/เล่น|ดู|ถ่าย|อ่าน|ทำ|ออกกำลัง|play|watch|hobby/.test(v)) {
    return { category: "hobbies", restrictionType: null };
  }
  if (/สาย|เป็นคน/.test(v) || /^สาย/.test(t)) {
    return { category: "lifestyle", restrictionType: null };
  }

  if (
    /หมูกระทะ|หมูกะทะ|ชาบู|กาแฟ|ส้มตำ|ซูชิ|พิซซ่า|ไก่ย่าง|กุ้ง|อาหาร|ขนม|เค้ก|ชานม|ก๋วยเตี๋ยว|ราเมง|บุฟเฟ่ต์/.test(
      t
    )
  ) {
    return { category: "food_preferences", restrictionType: null };
  }
  if (/คาเฟ่|ร้านกาแฟ|สาย|รักสัตว์|แมว|หมา|ชิล/.test(t)) {
    return { category: "lifestyle", restrictionType: null };
  }
  if (/ทะเล|ภูเขา|ดอย|แคมป์|เดินทาง|ท่องเที่ยว|ต่างจังหวัด|ต่างประเทศ|ปิกนิก|สวน/.test(t)) {
    return { category: "travel_interests", restrictionType: null };
  }
  if (/บอร์ดเกม|ดูหนัง|ถ่ายรูป|อ่านหนังสือ|ทำขนม|วิ่ง|โยคะ|วาดรูป|ร้องเพลง/.test(t)) {
    return { category: "hobbies", restrictionType: null };
  }
  return { category: "other_interests", restrictionType: null };
}

export function extractWithRules(text: string): {
  items: RawExtractedTuple[];
  warnings: string[];
} {
  const segments = splitPersonSegments(text);
  const results: RawExtractedTuple[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  const clauseRegex =
    /(?:^|\s+|(?:และ|หรือ|แต่|แล้วก็|,|อาจจะ|น่าจะ)\s*)(ไม่ชอบกิน|ไม่ชอบทาน|ไม่ชอบ|ไม่กิน|ไม่ทาน|ไม่ดื่ม|ไม่รับประทาน|แพ้|งด|หลีกเลี่ยง|ห้ามกิน|ต้องการ|เลือก|ชอบกิน|ชอบทาน|ชอบไป|ชอบเที่ยว|ชอบเล่น|ชอบดู|ชอบอ่าน|ชอบทำ|ชอบถ่าย|ชอบฟัง|ชอบดื่ม|ชอบ|กินเจ|ทานเจ|เป็นมังสวิรัติ|เป็นวีแกน|มังสวิรัติ|วีแกน|กิน|ทาน|ดื่ม|สนใจ|อยากไป|อยากกิน|อยากลอง|โปรดปราน|เป็นสาย|dislikes?|hates?|allergic to|interested in|likes? to eat|likes? to|loves?)/gi;

  for (const seg of segments) {
    if (seg.personMissing) {
      warnings.push(
        `พบข้อความที่ไม่ได้ระบุชื่อเพื่อนชัดเจน: "${seg.body.slice(0, 45)}..." กรุณาเลือกเพื่อนที่ถูกต้องก่อนบันทึก`
      );
    }

    const matches: Array<{ verb: string; start: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = clauseRegex.exec(seg.body)) !== null) {
      matches.push({ verb: m[1], start: m.index, end: m.index + m[0].length });
    }

    if (matches.length === 0) {
      warnings.push(
        `ข้อความของ "${seg.personHint}" ไม่มีคำบ่งชี้ความชอบหรือข้อจำกัดที่ชัดเจน · ${seg.body.slice(
          0,
          40
        )}`
      );
      continue;
    }

    for (let i = 0; i < matches.length; i++) {
      const curr = matches[i];
      const nextStart = i + 1 < matches.length ? matches[i + 1].start : seg.body.length;
      const chunk = seg.body.slice(curr.end, nextStart).trim();
      const isSelfRestrictionVerb = /^(?:กินเจ|ทานเจ|เป็นมังสวิรัติ|เป็นวีแกน|มังสวิรัติ|วีแกน)$/i.test(
        curr.verb.trim()
      );
      if (!chunk && !isSelfRestrictionVerb) continue;

      const tokens = isSelfRestrictionVerb
        ? [curr.verb.replace(/^(?:เป็น|กิน|ทาน)/, "").trim() || curr.verb.trim()]
        : splitInterestTokens(chunk);
      for (const tok of tokens) {
        const rawDisplay = tok.trim();
        const { category: inferredCat, restrictionType } = inferCategoryFromClause(
          curr.verb,
          rawDisplay
        );
        const norm = normalizeInterestTerm(rawDisplay, inferredCat);
        const cleanNorm = norm.normalized;

        if (!cleanNorm || cleanNorm.length < 2) continue;

        const isVague =
          VAGUE_TERMS.has(cleanNorm.toLowerCase()) ||
          /ไม่แน่ใจ|อาจจะ|มั้ง|เดาว่า|\?/.test(chunk);

        const finalCat: ExtractCategorySlug =
          inferredCat === "disliked_food"
            ? "disliked_food"
            : inferredCat === "dietary_restriction"
              ? "dietary_restriction"
              : norm.suggestedCategory || inferredCat;

        const isAmbiguous = seg.personMissing || isVague;
        let uncertaintyReason: string | null = null;
        if (seg.personMissing) {
          uncertaintyReason = "ไม่พบชื่อเพื่อนชัดเจนในประโยค";
        } else if (isVague) {
          uncertaintyReason = "คำอธิบายมีความกำกวมหรือไม่แน่นอน";
        }

        const rawLabel =
          restrictionType === "allergy"
            ? `แพ้${rawDisplay}`
            : finalCat === "dietary_restriction" && !isSelfRestrictionVerb
              ? `${curr.verb}${rawDisplay}`
              : rawDisplay;

        const key = `${seg.personHint}|${finalCat}|${cleanNorm}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            friendName: seg.personHint,
            category: finalCat,
            rawValue: rawLabel,
            normalizedValue: cleanNorm,
            confidence: isAmbiguous ? 0.55 : 0.92,
            isAmbiguous,
            uncertaintyReason,
            restrictionType,
          });
        }
      }
    }
  }

  // Flag contradictions (same person has same normalized item as both positive and negative)
  for (const item of results) {
    const hasConflict = results.some(
      (other) =>
        other !== item &&
        other.friendName === item.friendName &&
        other.normalizedValue === item.normalizedValue &&
        (other.category === "disliked_food") !== (item.category === "disliked_food")
    );
    if (hasConflict) {
      item.isAmbiguous = true;
      item.confidence = Math.min(item.confidence, 0.5);
      item.uncertaintyReason = "พบข้อมูลขัดแย้ง ทั้งชอบและไม่ชอบรายการเดียวกัน";
    }
  }

  return { items: results, warnings };
}

async function extractWithOpenAI(text: string): Promise<RawExtractedTuple[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract friend preferences and dietary restrictions from Thai/English text into JSON: { items: [{ friendName, category, rawValue, normalizedValue, isAmbiguous, uncertaintyReason, restrictionType }] }. Valid categories: food_preferences, disliked_food, dietary_restriction, hobbies, travel_interests, lifestyle, other_interests. Classify halal, no pork, no beef, no alcohol, vegetarian, vegan under dietary_restriction (normalized e.g. ต้องการอาหารฮาลาล, ไม่กินหมู, ไม่ดื่มแอลกอฮอล์, มังสวิรัติ, วีแกน, ไม่กินเนื้อวัว). Keep food dislikes (restrictionType='dislike') and food allergies (restrictionType='allergy') under disliked_food. NEVER guess or infer religion from names or dietary restrictions. Flag isAmbiguous=true if unsure.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.items)) return null;

    return parsed.items
      .filter((x: Record<string, unknown>) => x.rawValue)
      .map((x: Record<string, unknown>) => {
        const cat = String(x.category || "other_interests") as ExtractCategorySlug;
        const norm = normalizeInterestTerm(String(x.normalizedValue || x.rawValue), cat);
        const isAmbiguous = Boolean(x.isAmbiguous) || !x.friendName;
        return {
          friendName: String(x.friendName || "ไม่ระบุชื่อเพื่อน").trim(),
          category: cat,
          rawValue: String(x.rawValue).trim(),
          normalizedValue: norm.normalized,
          confidence: isAmbiguous ? 0.6 : 0.95,
          isAmbiguous,
          uncertaintyReason: x.uncertaintyReason ? String(x.uncertaintyReason) : null,
          restrictionType:
            x.restrictionType === "allergy" || x.restrictionType === "dislike"
              ? x.restrictionType
              : null,
        };
      });
  } catch {
    return null;
  }
}

async function extractWithGemini(text: string): Promise<RawExtractedTuple[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract friend preferences and dietary restrictions from this Thai/English text and return ONLY valid JSON {"items":[{"friendName":"","category":"","rawValue":"","normalizedValue":"","isAmbiguous":false,"uncertaintyReason":null,"restrictionType":null}]}. Valid categories: food_preferences, disliked_food, dietary_restriction, hobbies, travel_interests, lifestyle, other_interests. Classify halal/no pork/no beef/no alcohol/vegetarian/vegan under dietary_restriction; keep dislikes and allergies under disliked_food with restrictionType. NEVER infer religion from names or dietary notes.\nText: ${text}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;
    return parsed.items
      .filter((x: Record<string, unknown>) => x.rawValue)
      .map((x: Record<string, unknown>) => {
        const cat = String(x.category || "other_interests") as ExtractCategorySlug;
        const norm = normalizeInterestTerm(String(x.normalizedValue || x.rawValue), cat);
        const isAmbiguous = Boolean(x.isAmbiguous) || !x.friendName;
        return {
          friendName: String(x.friendName || "ไม่ระบุชื่อเพื่อน").trim(),
          category: cat,
          rawValue: String(x.rawValue).trim(),
          normalizedValue: norm.normalized,
          confidence: isAmbiguous ? 0.6 : 0.95,
          isAmbiguous,
          uncertaintyReason: x.uncertaintyReason ? String(x.uncertaintyReason) : null,
          restrictionType:
            x.restrictionType === "allergy" || x.restrictionType === "dislike"
              ? x.restrictionType
              : null,
        };
      });
  } catch {
    return null;
  }
}

export async function extractInterestsFromText(text: string): Promise<ExtractionResult> {
  if (process.env.OPENAI_API_KEY) {
    const llmItems = await extractWithOpenAI(text);
    if (llmItems && llmItems.length > 0) {
      return { mode: "llm_openai", items: llmItems, warnings: [] };
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const llmItems = await extractWithGemini(text);
    if (llmItems && llmItems.length > 0) {
      return { mode: "llm_gemini", items: llmItems, warnings: [] };
    }
  }
  const fallback = extractWithRules(text);
  return { mode: "rule_based_fallback", items: fallback.items, warnings: fallback.warnings };
}
