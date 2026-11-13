-- Phase 5: Structured Religion, Dietary Can-Eat / Cannot-Eat & Allergy Distinction
ALTER TABLE friends
  ADD COLUMN IF NOT EXISTS religion TEXT NOT NULL DEFAULT 'ไม่ระบุ';

ALTER TABLE friends
  ADD COLUMN IF NOT EXISTS can_eat TEXT NOT NULL DEFAULT '';

ALTER TABLE friends
  ADD COLUMN IF NOT EXISTS cannot_eat TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN friends.religion IS 'ศาสนาของเพื่อน เช่น พุทธ, อิสลาม, คริสต์, ฮินดู';
COMMENT ON COLUMN friends.can_eat IS 'อาหารหรือวัตถุดิบที่เพื่อนทานได้ เช่น ฮาลาล, ไก่, ทะเล, มังสวิรัติ';
COMMENT ON COLUMN friends.cannot_eat IS 'ข้อจำกัดหรืออาหารที่ทานไม่ได้ เช่น งดหมู (ฮาลาล), งดเนื้อวัว, งดแอลกอฮอล์';
