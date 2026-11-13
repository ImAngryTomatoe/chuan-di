import { FriendRecord } from "./types";

export interface PlanFriendOutcome {
  id: number;
  nickname: string;
  full_name: string;
  religion: string;
  reason: string;
  caution?: string;
}

export type SuitabilityLevel = "all_safe" | "needs_care" | "partial_group";

export interface SmartRecommendedPlan {
  id: string;
  title: string;
  category: string;
  activityTitleSuggestion: string;
  targetTags: string[];
  suitabilityLevel: SuitabilityLevel;
  suitabilityLabel: string;
  pose: "happy" | "cool" | "curious" | "love" | "welcome";
  safeCount: number;
  totalTargetCount: number;
  loverCount: number;
  safeFriends: PlanFriendOutcome[];
  excludedFriends: PlanFriendOutcome[];
  allergyWarnings: string[];
  religionWarnings: string[];
  summaryReason: string;
  tips: string;
  createActivityHref: string;
}

export interface GroupDietarySnapshot {
  targetCount: number;
  religions: Array<{ religion: string; count: number; nicknames: string[] }>;
  allergyAlerts: Array<{ friendId: number; nickname: string; items: string[] }>;
  noPorkFriends: Array<{ friendId: number; nickname: string; reason: string }>;
  noBeefFriends: Array<{ friendId: number; nickname: string; reason: string }>;
  noMeatFriends: Array<{ friendId: number; nickname: string; reason: string }>;
}

interface ParsedConstraints {
  religion: string;
  cannotEat: string;
  canEat: string;
  foodLikes: string[];
  allLikes: string[];
  allergies: string[];
  dislikes: string[];
  dietaryLabels: string[];
  wantsHalal: boolean;
  noPork: boolean;
  noBeef: boolean;
  vegetarian: boolean;
  vegan: boolean;
  alcoholFree: boolean;
  noSeafood: boolean;
  noCrustacean: boolean;
  noPeanut: boolean;
  noDairy: boolean;
  noSpicy: boolean;
}

export function parseFriendConstraints(friend: FriendRecord): ParsedConstraints {
  const religion = (friend.religion || "ไม่ระบุ").trim();
  const cannotEat = (friend.cannot_eat || "").trim();
  const canEat = (friend.can_eat || "").trim();
  const notes = (friend.personal_notes || "").trim();
  const dietaryLabels = (friend.dietary_restrictions || []).map((d) => d.restriction_label);

  const foodLikes: string[] = [];
  const allLikes: string[] = [];
  const allergies: string[] = [];
  const dislikes: string[] = [];

  for (const item of friend.interests || []) {
    if (item.category_slug === "disliked_food") {
      if (item.restriction_type === "allergy") {
        allergies.push(item.normalized_value);
      } else {
        dislikes.push(item.normalized_value);
      }
    } else {
      allLikes.push(item.normalized_value);
      if (item.category_slug === "food_preferences") {
        foodLikes.push(item.normalized_value);
      }
    }
  }

  const dietaryJoined = dietaryLabels.join(" ").toLowerCase();
  const combinedRestrict = `${religion} ${cannotEat} ${dietaryJoined} ${allergies.join(" ")} ${dislikes.join(" ")}`.toLowerCase();
  const allergyRestrict = `${allergies.join(" ")} ${cannotEat} ${dietaryJoined}`.toLowerCase();

  // Only infer halal if explicitly religious Islam or explicitly specified halal (never infer from non-pork alone)
  const wantsHalal =
    religion === "อิสลาม" || /ฮาลาล|halal/.test(`${dietaryJoined} ${canEat.toLowerCase()} ${cannotEat.toLowerCase()}`);

  const vegan = /วีแกน|vegan/.test(`${combinedRestrict} ${notes.toLowerCase()}`);
  const vegetarian = vegan || /มังสวิรัติ|อาหารเจ|งดเนื้อสัตว์/.test(`${combinedRestrict} ${notes.toLowerCase()}`);
  const noPork =
    wantsHalal ||
    vegetarian ||
    /อิสลาม|งดหมู|ไม่กินหมู|ไม่ทานหมู|เนื้อหมู/.test(combinedRestrict);
  const noBeef =
    religion === "ฮินดู" ||
    vegetarian ||
    /ฮินดู|งดเนื้อวัว|ไม่กินเนื้อวัว|ไม่ทานเนื้อ|เนื้อวัว|เจ้าแม่กวนอิม/.test(combinedRestrict);
  const alcoholFree = /แอลกอฮอล์|alcohol|เหล้า|เบียร์/.test(combinedRestrict);
  const noSeafood = /อาหารทะเล|ซีฟู้ด/.test(combinedRestrict);
  const noCrustacean = /กุ้ง|ปู|หอย|ปลาหมึก|อาหารทะเล|ซีฟู้ด/.test(allergyRestrict);
  const noPeanut = /ถั่ว|ถั่วลิสง|ถั่วเปลือกแข็ง|อัลมอนด์/.test(`${allergies.join(" ")} ${cannotEat} ${dietaryJoined}`.toLowerCase());
  const noDairy = /นม|นมวัว|แลคโตส|lactose|ชีส/.test(allergyRestrict);
  const noSpicy = /เผ็ด|พริก/.test(combinedRestrict);

  return {
    religion,
    cannotEat,
    canEat,
    foodLikes,
    allLikes,
    allergies,
    dislikes,
    dietaryLabels,
    wantsHalal,
    noPork,
    noBeef,
    vegetarian,
    vegan,
    alcoholFree,
    noSeafood,
    noCrustacean,
    noPeanut,
    noDairy,
    noSpicy,
  };
}

export function buildGroupDietarySnapshot(
  friends: FriendRecord[],
  selectedFriendIds?: number[]
): GroupDietarySnapshot {
  const target =
    selectedFriendIds && selectedFriendIds.length > 0
      ? friends.filter((f) => selectedFriendIds.includes(f.id))
      : friends;

  const relMap = new Map<string, string[]>();
  const allergyAlerts: Array<{ friendId: number; nickname: string; items: string[] }> = [];
  const noPorkFriends: Array<{ friendId: number; nickname: string; reason: string }> = [];
  const noBeefFriends: Array<{ friendId: number; nickname: string; reason: string }> = [];
  const noMeatFriends: Array<{ friendId: number; nickname: string; reason: string }> = [];

  for (const f of target) {
    const c = parseFriendConstraints(f);
    const rList = relMap.get(c.religion) || [];
    rList.push(f.nickname);
    relMap.set(c.religion, rList);

    if (c.allergies.length > 0) {
      allergyAlerts.push({ friendId: f.id, nickname: f.nickname, items: c.allergies });
    }
    if (c.noPork) {
      noPorkFriends.push({
        friendId: f.id,
        nickname: f.nickname,
        reason:
          c.religion === "อิสลาม"
            ? "อิสลาม งดเนื้อหมูและต้องเป็นอาหารฮาลาล"
            : c.wantsHalal
              ? "ต้องการอาหารฮาลาลและไม่กินหมู"
              : c.cannotEat || "ไม่กินหมู",
      });
    }
    if (c.noBeef) {
      noBeefFriends.push({
        friendId: f.id,
        nickname: f.nickname,
        reason: c.religion === "ฮินดู" ? "ฮินดู งดเนื้อวัว" : c.cannotEat || "งดเนื้อวัว",
      });
    }
    if (c.vegetarian) {
      noMeatFriends.push({
        friendId: f.id,
        nickname: f.nickname,
        reason: c.cannotEat || "มังสวิรัติ/งดเนื้อสัตว์ใหญ่",
      });
    }
  }

  return {
    targetCount: target.length,
    religions: Array.from(relMap.entries()).map(([religion, nicknames]) => ({
      religion,
      count: nicknames.length,
      nicknames,
    })),
    allergyAlerts,
    noPorkFriends,
    noBeefFriends,
    noMeatFriends,
  };
}

export const IDEAL_OUTING_MIN = 4;
export const IDEAL_OUTING_MAX = 10;
export const DEFAULT_OUTING_SIZE = 6;

function selectPlanFriends(
  friends: FriendRecord[],
  parsedMap: Map<number, ParsedConstraints>,
  options: {
    selectedFriendIds?: number[];
    desiredSize: number;
    scoreFriend: (friend: FriendRecord, parsed: ParsedConstraints) => number;
    preferCompatible?: boolean;
    isCompatible?: (parsed: ParsedConstraints) => boolean;
  }
): FriendRecord[] {
  const { selectedFriendIds, desiredSize, scoreFriend, preferCompatible, isCompatible } = options;
  if (selectedFriendIds && selectedFriendIds.length > 0) {
    return friends.filter((f) => selectedFriendIds.includes(f.id));
  }
  if (friends.length <= desiredSize) {
    return friends;
  }

  return [...friends]
    .sort((a, b) => {
      const pa = parsedMap.get(a.id)!;
      const pb = parsedMap.get(b.id)!;
      if (preferCompatible && isCompatible) {
        const ca = isCompatible(pa) ? 1 : 0;
        const cb = isCompatible(pb) ? 1 : 0;
        if (cb !== ca) return cb - ca;
      }
      const sa = scoreFriend(a, pa);
      const sb = scoreFriend(b, pb);
      if (sb !== sa) return sb - sa;
      return a.id - b.id;
    })
    .slice(0, desiredSize);
}

export function generateSmartGroupPlans(
  friends: FriendRecord[],
  selectedFriendIds?: number[],
  options?: { groupSize?: number }
): SmartRecommendedPlan[] {
  const hasExplicitSelection = Boolean(selectedFriendIds && selectedFriendIds.length > 0);
  const explicitTarget = hasExplicitSelection
    ? friends.filter((f) => selectedFriendIds!.includes(f.id))
    : friends;

  if (explicitTarget.length === 0) return [];

  const desiredSize = Math.min(
    friends.length,
    Math.max(IDEAL_OUTING_MIN, Math.min(IDEAL_OUTING_MAX, options?.groupSize ?? DEFAULT_OUTING_SIZE))
  );

  const parsedMap = new Map<number, ParsedConstraints>();
  for (const f of friends) {
    parsedMap.set(f.id, parseFriendConstraints(f));
  }

  const plans: SmartRecommendedPlan[] = [];

  const makeCreateHref = (title: string, category: string, safeList: PlanFriendOutcome[]) => {
    const ids = safeList.map((s) => s.id).join(",");
    return `/activities/new?title=${encodeURIComponent(title)}&category=${encodeURIComponent(
      category
    )}&friends=${encodeURIComponent(ids)}`;
  };

  // Plan 1: คาเฟ่ & เบเกอรี่ + เมนูทางเลือก (ปลอดภัยสูงที่สุด ข้ามศาสนาได้ง่าย)
  {
    const target = selectPlanFriends(friends, parsedMap, {
      selectedFriendIds,
      desiredSize,
      scoreFriend: (_f, c) =>
        c.allLikes.filter((t) => ["คาเฟ่", "กาแฟ", "ของหวาน", "ชานมไข่มุก", "ถ่ายรูป"].includes(t))
          .length,
    });
    const safe: PlanFriendOutcome[] = [];
    const excluded: PlanFriendOutcome[] = [];
    const allergyWarnings: string[] = [];
    const religionWarnings: string[] = [];
    let lovers = 0;

    for (const f of target) {
      const c = parsedMap.get(f.id)!;
      const likesCafe = c.allLikes.some((t) => ["คาเฟ่", "กาแฟ", "ของหวาน", "ชานมไข่มุก", "ถ่ายรูป"].includes(t));
      if (likesCafe) lovers += 1;

      const cautions: string[] = [];
      if (c.wantsHalal) {
        cautions.push("เลือกเบเกอรี่ไร้เจลาตินหมู แอลกอฮอล์ และร้านที่รองรับฮาลาล");
      }
      if (c.noDairy) {
        cautions.push("แพ้นมวัว — สั่งเมนูนมโอ๊ตหรือชาผลไม้");
        allergyWarnings.push(`${f.nickname}: แพ้นมวัว ควรเลือกเมนูนมโอ๊ตหรือมัทฉะน้ำ`);
      }
      if (c.noPeanut) {
        cautions.push("แพ้ถั่ว — ตรวจสอบขนมปลอดถั่ว");
        allergyWarnings.push(`${f.nickname}: แพ้ถั่ว (${c.allergies.filter((a) => /ถั่ว|อัลมอนด์/.test(a)).join(", ") || "ถั่ว"})`);
      }

      safe.push({
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        religion: c.religion,
        reason: likesCafe ? "ชื่นชอบคาเฟ่ เครื่องดื่ม หรือถ่ายรูป" : "เข้าร่วมกิจกรรมได้",
        caution: cautions.length > 0 ? cautions.join(" · ") : undefined,
      });
    }

    const hasHalalNeed = target.some((f) => parsedMap.get(f.id)!.wantsHalal);
    if (hasHalalNeed) {
      religionWarnings.push("มีเพื่อนที่ต้องการอาหารฮาลาล เลือกร้านที่ไม่มีแอลกอฮอล์และเจลาตินหมู");
    }

    const level: SuitabilityLevel =
      allergyWarnings.length === 0 && religionWarnings.length === 0 ? "all_safe" : "needs_care";
    const title = "คาเฟ่และเบเกอรี่ — เหมาะกับทุกกลุ่ม";
    plans.push({
      id: "plan-cafe",
      title,
      category: "คาเฟ่และไลฟ์สไตล์",
      activityTitleSuggestion: "Cafe Hopping นัดพูดคุยและจิบกาแฟ",
      targetTags: ["คาเฟ่", "กาแฟ", "ของหวาน"],
      suitabilityLevel: level,
      suitabilityLabel:
        level === "all_safe" ? "ไปได้ทุกคนในวงนี้" : "ไปได้ครบ · เช็กนมและส่วนผสม",
      pose: "happy",
      safeCount: safe.length,
      totalTargetCount: target.length,
      loverCount: lovers,
      safeFriends: safe,
      excludedFriends: excluded,
      allergyWarnings,
      religionWarnings,
      summaryReason: hasExplicitSelection
        ? `วิเคราะห์จากเพื่อนที่เลือก ${target.length} คน ไม่มีเมนูหมูหรือเนื้อวัวที่ขัดแย้ง (${lovers} คนชอบคาเฟ่)`
        : `คัดวงเล็กสายคาเฟ่ ${safe.length} คน (${lovers} คนชอบแนวนี้โดยตรง) นั่งคุยสบายและรองรับทุกศาสนา`,
      tips: "เลือกร้านที่มีเมนูนมโอ๊ต ชาผลไม้ และเบเกอรี่ปลอดถั่วเพื่อรองรับทุกคนในวง",
      createActivityHref: makeCreateHref("Cafe Hopping นัดพูดคุยและจิบกาแฟ", "คาเฟ่และไลฟ์สไตล์", safe),
    });
  }

  // Plan 2: ชาบู / สุกี้หม้อแยก (ฮาลาล / มังสวิรัติปรับหม้อได้)
  {
    const target = selectPlanFriends(friends, parsedMap, {
      selectedFriendIds,
      desiredSize,
      scoreFriend: (_f, c) =>
        (c.foodLikes.includes("ชาบู") ? 3 : 0) + (c.foodLikes.includes("หมูกระทะ") ? 1 : 0),
    });
    const safe: PlanFriendOutcome[] = [];
    const excluded: PlanFriendOutcome[] = [];
    const allergyWarnings: string[] = [];
    const religionWarnings: string[] = [];
    let lovers = 0;

    const hasMuslim = target.some((f) => parsedMap.get(f.id)!.wantsHalal);
    const hasHinduOrNoBeef = target.some((f) => parsedMap.get(f.id)!.noBeef);
    const hasVeg = target.some((f) => parsedMap.get(f.id)!.vegetarian);

    if (hasMuslim) religionWarnings.push("มีเพื่อนที่ต้องการอาหารฮาลาล ควรเลือกร้านชาบูฮาลาลที่ปลอดเนื้อหมู");
    if (hasHinduOrNoBeef) religionWarnings.push("มีเพื่อนงดเนื้อวัว ควรแยกหม้อไม่ต้มรวมเนื้อวัว");
    if (hasVeg) religionWarnings.push("มีเพื่อนทานมังสวิรัติ ควรสั่งหม้อซุปผักแยกต่างหาก");

    for (const f of target) {
      const c = parsedMap.get(f.id)!;
      const likesShabu = c.foodLikes.includes("ชาบู");
      if (likesShabu) lovers += 1;

      const cautions: string[] = [];
      if (c.wantsHalal) cautions.push("ร้านชาบูฮาลาล ไร้หมู");
      else if (c.noPork) cautions.push("ไม่กินหมู");
      if (c.noBeef) cautions.push("แยกหม้อไร้เนื้อวัว");
      if (c.vegetarian) cautions.push("แยกหม้อซุปผักและเต้าหู้");
      if (c.noCrustacean || c.noSeafood) {
        cautions.push(`เลี่ยงซีฟู้ดในหม้อเดียวกัน — ${c.allergies.join(", ") || "งดอาหารทะเล"}`);
        if (c.allergies.length > 0) {
          allergyWarnings.push(`${f.nickname}: แพ้ ${c.allergies.join(", ")} — ห้ามต้มซีฟู้ดลงหม้อเดียว`);
        }
      }
      if (c.noPeanut) {
        cautions.push("ระวังถั่วในน้ำจิ้ม");
        allergyWarnings.push(`${f.nickname}: แพ้ถั่วลิสง — เช็กน้ำจิ้มสุกี้ไม่ผสมถั่ว`);
      }

      safe.push({
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        religion: c.religion,
        reason: likesShabu ? "ชื่นชอบชาบูโดยตรง" : "เลือกซุปและวัตถุดิบเฉพาะบุคคลได้",
        caution: cautions.length > 0 ? cautions.join(" · ") : undefined,
      });
    }

    const level: SuitabilityLevel =
      allergyWarnings.length === 0 && religionWarnings.length === 0 ? "all_safe" : "needs_care";
    const planTitle = hasMuslim
      ? "ชาบูฮาลาลหม้อแยก — รองรับทุกศาสนา"
      : "ชาบูและสุกี้หม้อแยกเลือกวัตถุดิบ";
    plans.push({
      id: "plan-shabu",
      title: planTitle,
      category: "อาหารและสังสรรค์",
      activityTitleSuggestion: hasMuslim ? "ชาบูฮาลาลหม้อแยกร่วมกับเพื่อน" : "นัดรับประทานชาบูหม้อแยก",
      targetTags: ["ชาบู"],
      suitabilityLevel: level,
      suitabilityLabel:
        level === "all_safe" ? "ไปได้ทุกคนในวงนี้" : "ไปได้ครบ · ใช้หม้อแยก",
      pose: "welcome",
      safeCount: safe.length,
      totalTargetCount: target.length,
      loverCount: lovers,
      safeFriends: safe,
      excludedFriends: excluded,
      allergyWarnings,
      religionWarnings,
      summaryReason: hasExplicitSelection
        ? `หม้อแยกช่วยให้ทุกคนที่เลือก (${safe.length} คน) ทานร่วมโต๊ะได้ โดย ${lovers} คนชอบชาบูเป็นพิเศษ`
        : `คัดวงเพื่อน ${safe.length} คนที่ชอบชาบู (${lovers} คน) รูปแบบหม้อแยกช่วยให้ปรับวัตถุดิบตามข้อจำกัดแต่ละคนได้ง่าย`,
      tips: hasMuslim
        ? "เลือกร้านชาบูฮาลาลที่ปลอดเนื้อหมูทั้งร้าน หรือมีหม้อแยกชัดเจน"
        : "สั่งหม้อแยกสำหรับผู้ที่ไม่ทานเนื้อวัวหรือมังสวิรัติ และแยกจานซีฟู้ดสำหรับผู้แพ้อาหารทะเล",
      createActivityHref: makeCreateHref(
        hasMuslim ? "ชาบูฮาลาลหม้อแยกร่วมกับเพื่อน" : "นัดรับประทานชาบูหม้อแยก",
        "อาหารและสังสรรค์",
        safe
      ),
    });
  }

  // Plan 3: ส้มตำ ไก่ย่าง ซีฟู้ดฮาลาล (งดเนื้อ/งดหมูปรับได้ แต่ดูถั่ว/ซีฟู้ด/เผ็ด)
  {
    const target = selectPlanFriends(friends, parsedMap, {
      selectedFriendIds,
      desiredSize,
      preferCompatible: true,
      isCompatible: (c) => !c.vegetarian,
      scoreFriend: (_f, c) =>
        (c.foodLikes.includes("ส้มตำ") ? 3 : 0) + (c.foodLikes.includes("อาหารทะเล") ? 2 : 0),
    });
    const safe: PlanFriendOutcome[] = [];
    const excluded: PlanFriendOutcome[] = [];
    const allergyWarnings: string[] = [];
    const religionWarnings: string[] = [];
    let lovers = 0;

    for (const f of target) {
      const c = parsedMap.get(f.id)!;
      const likesIsan = c.foodLikes.some((t) => ["ส้มตำ", "อาหารทะเล"].includes(t));
      if (likesIsan) lovers += 1;

      const cautions: string[] = [];
      if (c.wantsHalal) cautions.push("เลือกร้านอาหารอีสานฮาลาล เช่น ไก่ย่างและปลานึ่ง");
      if (c.noBeef) cautions.push("งดเมนูเนื้อวัว");
      if (c.noPeanut) {
        cautions.push("กำชับไม่ใส่ถั่วลิสงทุกจาน");
        allergyWarnings.push(`${f.nickname}: แพ้ถั่วลิสง — ส้มตำต้องไม่ใส่ถั่วและแยกครก`);
      }
      if (c.noCrustacean || c.noSeafood) {
        cautions.push("งดกุ้งแห้ง ปู และปลาร้าทะเล เลือกเมนูไก่ย่างแทน");
        if (c.allergies.length > 0) {
          allergyWarnings.push(`${f.nickname}: แพ้ ${c.allergies.join(", ")} — ระวังกุ้งแห้งและปูในส้มตำ`);
        }
      }
      if (c.noSpicy) cautions.push("สั่งตำไทยไม่พริกหรือเผ็ดน้อย");
      if (c.vegetarian) {
        excluded.push({
          id: f.id,
          nickname: f.nickname,
          full_name: f.full_name,
          religion: c.religion,
          reason: "ทานมังสวิรัติ — เมนูในร้านส้มตำไก่ย่างมีจำกัด",
        });
        continue;
      }

      safe.push({
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        religion: c.religion,
        reason: likesIsan ? "ชื่นชอบส้มตำและอาหารอีสาน" : "รับประทานไก่ย่างหรือปลาได้",
        caution: cautions.length > 0 ? cautions.join(" · ") : undefined,
      });
    }

    const level: SuitabilityLevel =
      excluded.length > 0 ? "partial_group" : allergyWarnings.length > 0 ? "needs_care" : "all_safe";
    plans.push({
      id: "plan-somtum-chicken",
      title: "ร้านไก่ย่าง ส้มตำ และอาหารอีสานฮาลาล",
      category: "อาหารและสังสรรค์",
      activityTitleSuggestion: "นัดรับประทานส้มตำและไก่ย่างร่วมกับเพื่อน",
      targetTags: ["ส้มตำ", "อาหารทะเล"],
      suitabilityLevel: level,
      suitabilityLabel:
        excluded.length > 0
          ? `ชวนได้ ${safe.length}/${target.length} คน (เว้นมังสวิรัติ)`
          : allergyWarnings.length > 0
            ? "ไปได้ครบ · แยกครกถั่ว/กุ้งแห้ง"
            : "ไปได้ทุกคนในวงนี้",
      pose: "cool",
      safeCount: safe.length,
      totalTargetCount: target.length,
      loverCount: lovers,
      safeFriends: safe,
      excludedFriends: excluded,
      allergyWarnings,
      religionWarnings,
      summaryReason: hasExplicitSelection
        ? `เมนูไก่ย่างและส้มตำเหมาะกับกลุ่ม ${target.length} คนที่เลือก (มี ${lovers} คนชอบอาหารอีสาน)`
        : `คัดเพื่อนวงเล็ก ${safe.length} คนที่ทานเมนูไก่ย่างและอาหารอีสานได้ (${lovers} คนชอบโดยตรง)`,
      tips: "สั่งแยกครกสำหรับผู้แพ้ถั่วหรือกุ้งแห้ง และแยกจานส้มตำไม่เผ็ดตามความชอบ",
      createActivityHref: makeCreateHref("นัดรับประทานส้มตำและไก่ย่างร่วมกับเพื่อน", "อาหารและสังสรรค์", safe),
    });
  }

  // Plan 4: หมูกระทะและปิ้งย่าง
  {
    const target = selectPlanFriends(friends, parsedMap, {
      selectedFriendIds,
      desiredSize,
      preferCompatible: true,
      isCompatible: (c) => !c.noPork && !c.vegetarian,
      scoreFriend: (_f, c) => (c.foodLikes.includes("หมูกระทะ") ? 4 : 0),
    });
    const safe: PlanFriendOutcome[] = [];
    const excluded: PlanFriendOutcome[] = [];
    const allergyWarnings: string[] = [];
    const religionWarnings: string[] = [];
    let lovers = 0;

    for (const f of target) {
      const c = parsedMap.get(f.id)!;
      if (c.noPork || c.vegetarian) {
        const why =
          c.wantsHalal
            ? "ต้องการอาหารฮาลาลและไม่กินหมู แนะนำเลือกร้านฮาลาลแทนร้านหมูกระทะทั่วไป"
            : c.vegetarian
              ? "ทานมังสวิรัติ งดเนื้อสัตว์ใหญ่"
              : `ไม่กินหมู${c.cannotEat ? ` — ${c.cannotEat}` : ""}`;
        excluded.push({
          id: f.id,
          nickname: f.nickname,
          full_name: f.full_name,
          religion: c.religion,
          reason: why,
        });
        religionWarnings.push(`${f.nickname}: ${why}`);
        continue;
      }

      const likesMookata = c.foodLikes.includes("หมูกระทะ");
      if (likesMookata) lovers += 1;

      const cautions: string[] = [];
      if (c.noBeef) cautions.push("งดเนื้อวัว สั่งเฉพาะชุดหมูหรือไก่");
      if (c.noCrustacean || c.noSeafood) {
        cautions.push(`เลี่ยงกระทะที่มีกุ้งปู — ${c.allergies.join(", ") || "งดอาหารทะเล"}`);
        if (c.allergies.length > 0) {
          allergyWarnings.push(`${f.nickname}: แพ้ ${c.allergies.join(", ")} — แยกเตาไม่ปิ้งกุ้งหมึกรวมกับหมู`);
        }
      }

      safe.push({
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        religion: c.religion,
        reason: likesMookata ? "ชื่นชอบหมูกระทะโดยตรง" : "รับประทานหมูและไก่ปิ้งย่างได้",
        caution: cautions.length > 0 ? cautions.join(" · ") : undefined,
      });
    }

    plans.push({
      id: "plan-mookata",
      title: "หมูกระทะและปิ้งย่าง",
      category: "อาหารและสังสรรค์",
      activityTitleSuggestion: "หมูกระทะวันศุกร์ สำหรับเพื่อนที่ร่วมรับประทานได้",
      targetTags: ["หมูกระทะ"],
      suitabilityLevel: excluded.length > 0 ? "partial_group" : allergyWarnings.length > 0 ? "needs_care" : "all_safe",
      suitabilityLabel:
        excluded.length > 0
          ? `ชวนได้ ${safe.length}/${target.length} คน (${excluded.length} คนงดหมู/มังสวิรัติ)`
          : allergyWarnings.length > 0
            ? "ทานหมูได้ครบ · แยกเตาซีฟู้ด"
            : "ทานหมูกระทะได้ทุกคนในวงนี้",
      pose: excluded.length > 0 ? "curious" : "happy",
      safeCount: safe.length,
      totalTargetCount: target.length,
      loverCount: lovers,
      safeFriends: safe,
      excludedFriends: excluded,
      allergyWarnings,
      religionWarnings,
      summaryReason:
        excluded.length > 0
          ? `มี ${lovers} คนชอบหมูกระทะ แต่มี ${excluded.length} คนงดหมูหรือมังสวิรัติ จึงควรเลือกร้านฮาลาลหรือชวนเฉพาะกลุ่มที่ทานได้`
          : `คัดแก๊งสายหมูกระทะ ${safe.length} คนที่ทานหมูได้ครบทั้งหมด (${lovers} คนชอบหมูกระทะเป็นเมนูโปรด)`,
      tips:
        excluded.length > 0
          ? "หากอยากชวนครบทุกคนในวงนี้ แนะนำสลับเป็นร้านชาบูฮาลาลหรือไก่ย่างแทน"
          : "แยกเตาปิ้งหมูและไก่ ออกจากเตาที่มีกุ้งหรือหอยสำหรับเพื่อนที่แพ้อาหารทะเล",
      createActivityHref: makeCreateHref(
        "หมูกระทะวันศุกร์ สำหรับเพื่อนที่ร่วมรับประทานได้",
        "อาหารและสังสรรค์",
        safe
      ),
    });
  }

  // Plan 5: บอร์ดเกมและพิซซ่า
  {
    const target = selectPlanFriends(friends, parsedMap, {
      selectedFriendIds,
      desiredSize,
      scoreFriend: (_f, c) =>
        c.allLikes.filter((t) => ["บอร์ดเกม", "พิซซ่า", "เกม"].includes(t)).length,
    });
    const safe: PlanFriendOutcome[] = [];
    const excluded: PlanFriendOutcome[] = [];
    const allergyWarnings: string[] = [];
    const religionWarnings: string[] = [];
    let lovers = 0;

    for (const f of target) {
      const c = parsedMap.get(f.id)!;
      const likesBg = c.allLikes.some((t) => ["บอร์ดเกม", "พิซซ่า", "เกม"].includes(t));
      if (likesBg) lovers += 1;

      const cautions: string[] = [];
      if (c.wantsHalal) {
        cautions.push("สั่งพิซซ่าฮาลาล หน้าไก่ ซีฟู้ด หรือชีส งดแฮมและเบคอน");
      }
      if (c.vegetarian) cautions.push("สั่งหน้ามาร์เกอริต้าหรือผักโขม");
      if (c.noDairy) {
        cautions.push("แพ้นมวัว — ระวังชีสและครีม ควรสั่งปีกไก่หรือของทานเล่นเสริม");
        allergyWarnings.push(`${f.nickname}: แพ้นมวัว — สั่งเมนูเสริมไร้ชีส เช่น ปีกไก่บาร์บีคิว`);
      }

      safe.push({
        id: f.id,
        nickname: f.nickname,
        full_name: f.full_name,
        religion: c.religion,
        reason: likesBg ? "ชื่นชอบบอร์ดเกมหรือพิซซ่า" : "เข้าร่วมกิจกรรมเล่นเกมได้",
        caution: cautions.length > 0 ? cautions.join(" · ") : undefined,
      });
    }

    if (target.some((f) => parsedMap.get(f.id)!.wantsHalal)) {
      religionWarnings.push("มีเพื่อนที่ต้องการอาหารฮาลาล เลือกพิซซ่าฮาลาลหรือแยกถาดไม่มีแฮม/เบคอน");
    }

    const level: SuitabilityLevel =
      allergyWarnings.length === 0 && religionWarnings.length === 0 ? "all_safe" : "needs_care";
    plans.push({
      id: "plan-boardgame",
      title: "บอร์ดเกมและพิซซ่า",
      category: "งานอดิเรกและเกม",
      activityTitleSuggestion: "นัดเล่นบอร์ดเกมกับกลุ่มเพื่อน",
      targetTags: ["บอร์ดเกม", "พิซซ่า"],
      suitabilityLevel: level,
      suitabilityLabel:
        level === "all_safe" ? "ไปได้ทุกคนในวงนี้" : "ไปได้ครบ · แยกหน้าพิซซ่า",
      pose: "cool",
      safeCount: safe.length,
      totalTargetCount: target.length,
      loverCount: lovers,
      safeFriends: safe,
      excludedFriends: excluded,
      allergyWarnings,
      religionWarnings,
      summaryReason: hasExplicitSelection
        ? `กิจกรรมเล่นเกมรองรับเพื่อนต่างข้อจำกัดได้ง่าย (${safe.length} คนในวง, ${lovers} คนชอบบอร์ดเกม/พิซซ่า)`
        : `คัดตี้บอร์ดเกมกำลังดี ${safe.length} คน (${lovers} คนชอบเล่นเกมหรือพิซซ่า) ครบวงเล่นพอดีโต๊ะ`,
      tips: "สั่งพิซซ่าแยกหน้าไก่/ผักสำหรับเพื่อนอิสลามและมังสวิรัติ พร้อมของทานเล่นไร้ชีส",
      createActivityHref: makeCreateHref("นัดเล่นบอร์ดเกมกับกลุ่มเพื่อน", "งานอดิเรกและเกม", safe),
    });
  }

  // Sort: fewest exclusions first -> highest safe ratio -> highest lover count
  return plans.sort(
    (a, b) =>
      a.excludedFriends.length - b.excludedFriends.length ||
      b.loverCount - a.loverCount ||
      b.safeCount - a.safeCount
  );
}
