export type CategorySlug =
  | "food_preferences"
  | "disliked_food"
  | "hobbies"
  | "travel_interests"
  | "lifestyle"
  | "other_interests";

export type ExtractCategorySlug = CategorySlug | "dietary_restriction";

export const DIETARY_RESTRICTION_OPTIONS = [
  "ไม่กินหมู",
  "ต้องการอาหารฮาลาล",
  "ไม่ดื่มแอลกอฮอล์",
  "มังสวิรัติ",
  "วีแกน",
  "แพ้อาหารทะเล",
  "แพ้ถั่ว",
  "แพ้นม",
  "ไม่กินเนื้อวัว",
] as const;

export type DietaryRestrictionCategory =
  | "halal"
  | "religious_or_cultural"
  | "allergy"
  | "diet_style"
  | "alcohol_free"
  | "other";

export function inferDietaryCategory(label: string): DietaryRestrictionCategory {
  const clean = label.trim().toLowerCase();
  if (clean.includes("ฮาลาล") || clean.includes("halal")) return "halal";
  if (clean.includes("แอลกอฮอล์") || clean.includes("alcohol") || clean.includes("เหล้า") || clean.includes("เบียร์")) {
    return "alcohol_free";
  }
  if (clean.includes("มังสวิรัติ") || clean.includes("วีแกน") || clean.includes("เจ") || clean.includes("vegetarian") || clean.includes("vegan")) {
    return "diet_style";
  }
  if (clean.includes("แพ้")) return "allergy";
  if (clean.includes("ไม่กินหมู") || clean.includes("ไม่ทานหมู") || clean.includes("งดหมู") || clean.includes("ไม่กินเนื้อ") || clean.includes("ไม่ทานเนื้อ") || clean.includes("งดเนื้อ")) {
    return "religious_or_cultural";
  }
  return "other";
}

export function getDietaryBadgeClass(category: DietaryRestrictionCategory): string {
  if (category === "halal" || category === "religious_or_cultural") {
    return "bg-[#E6F4EC] text-[#1F5E3B] border-[#BBE0C8]";
  }
  if (category === "allergy") {
    return "bg-[#FCE8E6] text-[#9A332E] border-[#EED2D0]";
  }
  return "bg-[#FFE4EC] text-[#8F2849] border-[#F5C2D3]";
}

export interface FriendDietaryRestrictionItem {
  id: number;
  friend_id: number;
  restriction_label: string;
  restriction_category: DietaryRestrictionCategory;
  source: string;
  text_input_id: number | null;
  created_at: string;
}

export interface CategoryMeta {
  slug: CategorySlug;
  name_th: string;
  name_en: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export interface ExtractCategoryMeta {
  slug: ExtractCategorySlug;
  name_th: string;
  name_en: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const CATEGORY_META: Record<CategorySlug, CategoryMeta> = {
  food_preferences: {
    slug: "food_preferences",
    name_th: "อาหารที่ชอบ",
    name_en: "Food Preferences",
    color: "#C2597C",
    bgClass: "bg-[#F9F1F4]",
    textClass: "text-[#8F3553]",
    borderClass: "border-[#E8D2DA]",
  },
  disliked_food: {
    slug: "disliked_food",
    name_th: "อาหารที่ไม่ชอบหรือข้อจำกัด",
    name_en: "Disliked Food",
    color: "#B85C58",
    bgClass: "bg-[#FDF3F2]",
    textClass: "text-[#9A332E]",
    borderClass: "border-[#EED2D0]",
  },
  hobbies: {
    slug: "hobbies",
    name_th: "งานอดิเรก",
    name_en: "Hobbies",
    color: "#7F738E",
    bgClass: "bg-[#F4F3F5]",
    textClass: "text-[#4D4554]",
    borderClass: "border-[#E3DFE6]",
  },
  travel_interests: {
    slug: "travel_interests",
    name_th: "ความสนใจท่องเที่ยว",
    name_en: "Travel Interests",
    color: "#9C8458",
    bgClass: "bg-[#F7F4EE]",
    textClass: "text-[#63512E]",
    borderClass: "border-[#E6DEC9]",
  },
  lifestyle: {
    slug: "lifestyle",
    name_th: "ไลฟ์สไตล์",
    name_en: "Lifestyle",
    color: "#5E8B77",
    bgClass: "bg-[#F2F6F4]",
    textClass: "text-[#325947]",
    borderClass: "border-[#D6E3DC]",
  },
  other_interests: {
    slug: "other_interests",
    name_th: "ความสนใจอื่น ๆ",
    name_en: "Other Interests",
    color: "#6B7C93",
    bgClass: "bg-[#F3F5F7]",
    textClass: "text-[#3E4C61]",
    borderClass: "border-[#DFE3E8]",
  },
};

export const RELIGION_OPTIONS = [
  "พุทธ",
  "อิสลาม",
  "คริสต์",
  "ฮินดู",
  "ซิกข์",
  "ไม่ระบุ",
] as const;

export const DECLINE_REASONS = [
  "ไม่ว่าง",
  "ติดธุระ",
  "ไม่สะดวกเดินทาง",
  "ไม่สนใจกิจกรรมนี้",
  "อื่น ๆ",
] as const;

export interface FriendInterestItem {
  id: number;
  interest_id: number;
  category_slug: CategorySlug;
  category_name_th: string;
  normalized_value: string;
  raw_value: string;
  source: string;
  text_input_id: number | null;
  confidence: number;
  confirmed: number;
  restriction_type?: "allergy" | "dislike" | null;
  created_at: string;
}

export interface FriendRecord {
  id: number;
  user_id: number;
  linked_user_id?: number | null;
  linked_user_email?: string | null;
  full_name: string;
  nickname: string;
  birthday: string | null;
  contact_info: string | null;
  personal_notes: string | null;
  religion: string;
  can_eat: string;
  cannot_eat: string;
  avatar_color: string;
  consent_given: number;
  joined_via_invite: number;
  created_at: string;
  updated_at: string;
  interests: FriendInterestItem[];
  dietary_restrictions?: FriendDietaryRestrictionItem[];
}

export interface UserSelfProfile {
  user_id: number;
  email: string;
  full_name: string;
  nickname: string;
  birthday: string | null;
  contact_info: string | null;
  religion: string;
  can_eat: string;
  cannot_eat: string;
  bio: string | null;
  avatar_color: string;
  updated_at: string;
  interests: FriendInterestItem[];
  dietary_restrictions: FriendDietaryRestrictionItem[];
}

export interface FriendRequestItem {
  id: number;
  sender_user_id: number;
  receiver_user_id: number;
  status: "pending" | "accepted" | "rejected";
  message: string | null;
  created_at: string;
  responded_at: string | null;
  other_user_id: number;
  other_name: string;
  other_nickname: string;
  other_email: string;
  other_avatar_color: string;
}

export interface ExtractedItemDraft {
  extractedId?: number;
  tempId: string;
  detected_friend_name: string;
  matched_friend_id: number | null;
  matched_friend_name: string | null;
  category_slug: ExtractCategorySlug;
  raw_value: string;
  normalized_value: string;
  confidence: number;
  is_ambiguous?: boolean;
  uncertainty_reason?: string | null;
  restriction_type?: "allergy" | "dislike" | null;
  already_exists?: boolean;
  selected: boolean;
}

export interface SavedSegment {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  include_interests: string[];
  exclude_interests: string[];
  category_filter: string;
  match_mode: "any" | "all";
  created_at: string;
  updated_at: string;
}

export const EXTRACT_CATEGORY_META: Record<ExtractCategorySlug, ExtractCategoryMeta> = {
  ...CATEGORY_META,
  dietary_restriction: {
    slug: "dietary_restriction",
    name_th: "ข้อจำกัดด้านอาหาร",
    name_en: "Dietary Restrictions",
    color: "#B9486D",
    bgClass: "bg-[#FFE4EC]",
    textClass: "text-[#8F2849]",
    borderClass: "border-[#F4B6CA]",
  },
};
