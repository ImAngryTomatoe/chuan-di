import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import {
  CATEGORY_META,
  CategorySlug,
  DietaryRestrictionCategory,
  FriendDietaryRestrictionItem,
  FriendInterestItem,
  FriendRecord,
  inferDietaryCategory,
} from "./types";

const DEFAULT_DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.CHUAN_DI_DB_PATH
  ? path.resolve(process.env.CHUAN_DI_DB_PATH)
  : path.join(DEFAULT_DB_DIR, "chuan-di.db");
const DB_DIR = path.dirname(DB_PATH);
export const DEMO_ACCOUNT_EMAIL = "demo@chuan-di.app";

declare global {
  // eslint-disable-next-line no-var
  var __chuanDiDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __chuanDiSeeded: boolean | undefined;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT 'ผู้จัดทริปและรวบรวมความชอบเพื่อน ๆ',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      linked_user_id INTEGER,
      full_name TEXT NOT NULL,
      nickname TEXT NOT NULL,
      birthday TEXT,
      contact_info TEXT,
      personal_notes TEXT,
      religion TEXT NOT NULL DEFAULT 'ไม่ระบุ',
      can_eat TEXT NOT NULL DEFAULT '',
      cannot_eat TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '#EFEAE8',
      consent_given INTEGER NOT NULL DEFAULT 1,
      joined_via_invite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);

    CREATE TABLE IF NOT EXISTS interest_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_th TEXT NOT NULL,
      name_en TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      normalized_value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(category_id, normalized_value),
      FOREIGN KEY (category_id) REFERENCES interest_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS text_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      raw_text TEXT NOT NULL,
      source_label TEXT NOT NULL DEFAULT 'ป้อนข้อความด้วยตนเอง',
      extraction_mode TEXT NOT NULL DEFAULT 'rule_based_fallback',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friend_interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      friend_id INTEGER NOT NULL,
      interest_id INTEGER NOT NULL,
      raw_value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      text_input_id INTEGER,
      confidence REAL NOT NULL DEFAULT 1.0,
      confirmed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(friend_id, interest_id),
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE,
      FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE,
      FOREIGN KEY (text_input_id) REFERENCES text_inputs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_friend_interests_friend ON friend_interests(friend_id);
    CREATE INDEX IF NOT EXISTS idx_friend_interests_interest ON friend_interests(interest_id);

    CREATE TABLE IF NOT EXISTS extracted_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_input_id INTEGER NOT NULL,
      friend_id INTEGER,
      detected_friend_name TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      raw_value TEXT NOT NULL,
      normalized_value TEXT NOT NULL,
      confirmation_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (text_input_id) REFERENCES text_inputs(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      activity_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT NOT NULL,
      target_interests_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);

    CREATE TABLE IF NOT EXISTS activity_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      rsvp_status TEXT NOT NULL DEFAULT 'pending',
      decline_reason TEXT,
      response_note TEXT,
      invite_token TEXT NOT NULL UNIQUE,
      sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      responded_at TEXT,
      UNIQUE(activity_id, friend_id),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_act_inv_activity ON activity_invitations(activity_id);
    CREATE INDEX IF NOT EXISTS idx_act_inv_token ON activity_invitations(invite_token);

    CREATE TABLE IF NOT EXISTS registration_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      invite_token TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      target_friend_name TEXT,
      prefill_friend_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      accepted_friend_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      accepted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (prefill_friend_id) REFERENCES friends(id) ON DELETE SET NULL,
      FOREIGN KEY (accepted_friend_id) REFERENCES friends(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS saved_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      include_interests_json TEXT NOT NULL DEFAULT '[]',
      exclude_interests_json TEXT NOT NULL DEFAULT '[]',
      category_filter TEXT NOT NULL DEFAULT '',
      match_mode TEXT NOT NULL DEFAULT 'all',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_saved_segments_user ON saved_segments(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_linked_user ON friends(linked_user_id);

    CREATE TABLE IF NOT EXISTS friend_dietary_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      friend_id INTEGER NOT NULL,
      restriction_label TEXT NOT NULL,
      restriction_category TEXT NOT NULL DEFAULT 'other',
      source TEXT NOT NULL DEFAULT 'manual',
      text_input_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(friend_id, restriction_label),
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE,
      FOREIGN KEY (text_input_id) REFERENCES text_inputs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_friend_dietary_friend ON friend_dietary_restrictions(friend_id);
    CREATE INDEX IF NOT EXISTS idx_friend_dietary_label ON friend_dietary_restrictions(restriction_label);

    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );


    CREATE TABLE IF NOT EXISTS user_weekly_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL CHECK(weekday >= 0 AND weekday <= 6),
      status TEXT NOT NULL CHECK(status IN ('available', 'unavailable')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, weekday),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_date_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      avail_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'unavailable', 'unknown')),
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '21:00',
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, avail_date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_date_avail_user_date ON user_date_availability(user_id, avail_date);

    CREATE TABLE IF NOT EXISTS friend_calendar_permissions (
      friend_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      is_shared INTEGER NOT NULL DEFAULT 0 CHECK(is_shared IN (0, 1)),
      share_source TEXT NOT NULL DEFAULT 'none',
      granted_at TEXT,
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_friend_cal_perm_user ON friend_calendar_permissions(user_id);

    CREATE TABLE IF NOT EXISTS friend_weekly_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      friend_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL CHECK(weekday >= 0 AND weekday <= 6),
      status TEXT NOT NULL CHECK(status IN ('available', 'unavailable')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(friend_id, weekday),
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friend_date_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      friend_id INTEGER NOT NULL,
      avail_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'unavailable', 'unknown')),
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '21:00',
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(friend_id, avail_date),
      FOREIGN KEY (friend_id) REFERENCES friends(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_friend_date_avail_friend_date ON friend_date_availability(friend_id, avail_date);

    CREATE TABLE IF NOT EXISTS google_oauth_states (
      state TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_path TEXT NOT NULL DEFAULT '/settings',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gcal_oauth_expires ON google_oauth_states(expires_at);

    CREATE TABLE IF NOT EXISTS google_calendar_connections (
      user_id INTEGER PRIMARY KEY,
      google_email TEXT,
      google_account_sub TEXT,
      scope TEXT NOT NULL,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      token_expires_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'connected',
      sync_error TEXT,
      last_synced_at TEXT,
      sync_window_start TEXT,
      sync_window_end TEXT,
      connected_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS google_calendar_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      calendar_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      access_role TEXT NOT NULL DEFAULT 'reader',
      background_color TEXT,
      time_zone TEXT,
      is_selected INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, calendar_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gcal_sources_user ON google_calendar_sources(user_id, is_selected);

    CREATE TABLE IF NOT EXISTS google_freebusy_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      calendar_id TEXT NOT NULL,
      start_utc TEXT NOT NULL,
      end_utc TEXT NOT NULL,
      bangkok_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gcal_busy_user_date ON google_freebusy_blocks(user_id, bangkok_date);

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      birthday TEXT,
      contact_info TEXT,
      religion TEXT NOT NULL DEFAULT 'ไม่ระบุ',
      can_eat TEXT NOT NULL DEFAULT '',
      cannot_eat TEXT NOT NULL DEFAULT '',
      bio TEXT,
      avatar_color TEXT NOT NULL DEFAULT '#D69DAE',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_profile_interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      interest_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'self_service',
      restriction_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, interest_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_upi_user ON user_profile_interests(user_id);

    CREATE TABLE IF NOT EXISTS user_profile_dietary_restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      restriction_label TEXT NOT NULL,
      restriction_category TEXT NOT NULL DEFAULT 'other',
      source TEXT NOT NULL DEFAULT 'self_service',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, restriction_label),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_updr_user ON user_profile_dietary_restrictions(user_id);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_user_id INTEGER NOT NULL,
      receiver_user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      responded_at TEXT,
      UNIQUE(sender_user_id, receiver_user_id),
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_friend_req_receiver ON friend_requests(receiver_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_friend_req_sender ON friend_requests(sender_user_id, status);
  `);

  // Non-destructive additive migrations for existing Phase 1/2 database
  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  ensureColumn("text_inputs", "status", "TEXT NOT NULL DEFAULT 'pending_review'");
  ensureColumn("extracted_data", "confidence", "REAL NOT NULL DEFAULT 0.9");
  ensureColumn("extracted_data", "is_ambiguous", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("extracted_data", "uncertainty_reason", "TEXT");
  ensureColumn("extracted_data", "restriction_type", "TEXT");
  ensureColumn("friend_interests", "restriction_type", "TEXT");
  ensureColumn("activity_invitations", "last_opened_at", "TEXT");
  ensureColumn("friends", "religion", "TEXT NOT NULL DEFAULT 'ไม่ระบุ'");
  ensureColumn("friends", "can_eat", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("friends", "cannot_eat", "TEXT NOT NULL DEFAULT ''");

  const upsertCat = db.prepare(`
    INSERT INTO interest_categories (slug, name_th, name_en, color)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name_th = excluded.name_th, name_en = excluded.name_en, color = excluded.color
  `);

  for (const cat of Object.values(CATEGORY_META)) {
    upsertCat.run(cat.slug, cat.name_th, cat.name_en, cat.color);
  }

  runDietaryRestrictionsBackfill(db);


  db.prepare(`
    INSERT OR IGNORE INTO app_migrations (name) VALUES ('google_calendar_schema_v1')
  `).run();

  runSelfProfileAndLinksMigration(db);
}

export function extractDietaryLabelsFromFriendFields(params: {
  religion?: string | null;
  canEat?: string | null;
  cannotEat?: string | null;
  personalNotes?: string | null;
  allergyValues?: string[];
}): string[] {
  const rel = (params.religion || "").trim();
  const canEat = (params.canEat || "").trim();
  const cannotEat = (params.cannotEat || "").trim();
  const notes = (params.personalNotes || "").trim();
  const combined = `${canEat} ${cannotEat} ${notes}`.toLowerCase();
  const allergiesText = (params.allergyValues || []).join(" ").toLowerCase();

  const labels = new Set<string>();
  if (rel === "อิสลาม" || /ฮาลาล|halal/i.test(combined)) {
    labels.add("ต้องการอาหารฮาลาล");
    labels.add("ไม่กินหมู");
  } else if (/ไม่กินหมู|ไม่ทานหมู|งดหมู/.test(cannotEat)) {
    labels.add("ไม่กินหมู");
  }

  if (/งดแอลกอฮอล์|ไม่ดื่มแอลกอฮอล์|ไม่ทานแอลกอฮอล์|alcohol/i.test(`${cannotEat} ${notes}`)) {
    labels.add("ไม่ดื่มแอลกอฮอล์");
  }
  if (/มังสวิรัติ|vegetarian/i.test(`${cannotEat} ${notes}`)) {
    labels.add("มังสวิรัติ");
  }
  if (/วีแกน|vegan/i.test(`${cannotEat} ${notes}`)) {
    labels.add("วีแกน");
  }
  if (rel === "ฮินดู" || /ไม่กินเนื้อวัว|ไม่ทานเนื้อวัว|งดเนื้อวัว/.test(`${cannotEat} ${notes}`)) {
    labels.add("ไม่กินเนื้อวัว");
  }

  if (
    /กุ้ง|ปู|หอย|หมึก|ปลาหมึก|อาหารทะเล|ซีฟู้ด/.test(allergiesText) ||
    /แพ้.*(กุ้ง|ปู|หอย|หมึก|อาหารทะเล)/.test(cannotEat)
  ) {
    labels.add("แพ้อาหารทะเล");
  }
  if (/ถั่ว|อัลมอนด์|ถั่วลิสง/.test(allergiesText) || /แพ้.*(ถั่ว|อัลมอนด์)/.test(cannotEat)) {
    labels.add("แพ้ถั่ว");
  }
  if (/นม|แลคโตส/.test(allergiesText) || /แพ้.*(นม|แลคโตส)/.test(cannotEat)) {
    labels.add("แพ้นม");
  }

  return Array.from(labels);
}

function runDietaryRestrictionsBackfill(db: DatabaseSync) {
  const applied = db
    .prepare("SELECT name FROM app_migrations WHERE name = 'dietary_restrictions_backfill_v1'")
    .get() as { name: string } | undefined;
  if (applied) return;

  const friends = db
    .prepare("SELECT id, religion, can_eat, cannot_eat, personal_notes FROM friends")
    .all() as Array<{
    id: number;
    religion: string | null;
    can_eat: string | null;
    cannot_eat: string | null;
    personal_notes: string | null;
  }>;

  const allergyStmt = db.prepare(`
    SELECT i.normalized_value
    FROM friend_interests fi
    JOIN interests i ON i.id = fi.interest_id
    WHERE fi.friend_id = ? AND fi.restriction_type = 'allergy'
  `);

  for (const f of friends) {
    const existingCnt = db
      .prepare("SELECT COUNT(*) as cnt FROM friend_dietary_restrictions WHERE friend_id = ?")
      .get(f.id) as { cnt: number };
    if (existingCnt.cnt > 0) continue;

    const allergies = (allergyStmt.all(f.id) as Array<{ normalized_value: string }>).map(
      (r) => r.normalized_value
    );
    const labels = extractDietaryLabelsFromFriendFields({
      religion: f.religion,
      canEat: f.can_eat,
      cannotEat: f.cannot_eat,
      personalNotes: f.personal_notes,
      allergyValues: allergies,
    });
    for (const label of labels) {
      upsertFriendDietaryRestriction(db, {
        friendId: f.id,
        label,
        source: "backfill",
        preserveExisting: true,
      });
    }
  }

  db.prepare("INSERT OR IGNORE INTO app_migrations (name) VALUES ('dietary_restrictions_backfill_v1')").run();
}

export function upsertFriendDietaryRestriction(
  db: DatabaseSync,
  params: {
    friendId: number;
    label: string;
    category?: DietaryRestrictionCategory;
    source?: string;
    textInputId?: number | null;
    preserveExisting?: boolean;
  }
) {
  const cleanLabel = params.label.trim();
  if (!cleanLabel) return { inserted: false, skippedExisting: false };
  const category = params.category || inferDietaryCategory(cleanLabel);

  if (params.preserveExisting) {
    const existing = db
      .prepare("SELECT id FROM friend_dietary_restrictions WHERE friend_id = ? AND LOWER(restriction_label) = LOWER(?)")
      .get(params.friendId, cleanLabel);
    if (existing) {
      return { inserted: false, skippedExisting: true };
    }
  }

  db.prepare(`
    INSERT INTO friend_dietary_restrictions (friend_id, restriction_label, restriction_category, source, text_input_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(friend_id, restriction_label) DO UPDATE SET
      restriction_category = excluded.restriction_category,
      source = excluded.source,
      text_input_id = COALESCE(excluded.text_input_id, friend_dietary_restrictions.text_input_id)
  `).run(params.friendId, cleanLabel, category, params.source || "manual", params.textInputId ?? null);

  return { inserted: true, skippedExisting: false };
}

export function replaceFriendDietaryRestrictions(
  db: DatabaseSync,
  friendId: number,
  restrictions: Array<string | { label: string; category?: DietaryRestrictionCategory }>,
  source = "manual"
) {
  db.prepare("DELETE FROM friend_dietary_restrictions WHERE friend_id = ?").run(friendId);
  const seen = new Set<string>();
  for (const item of restrictions) {
    const label = (typeof item === "string" ? item : item.label).trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const category = typeof item === "string" ? inferDietaryCategory(label) : item.category || inferDietaryCategory(label);
    upsertFriendDietaryRestriction(db, {
      friendId,
      label,
      category,
      source,
    });
  }
}

export function resolveOrCreateInterestId(
  db: DatabaseSync,
  categorySlug: string,
  normalizedValue: string
): number | null {
  const cleanVal = normalizedValue.trim();
  if (!cleanVal) return null;
  const cat = db
    .prepare("SELECT id FROM interest_categories WHERE slug = ?")
    .get(categorySlug) as { id: number } | undefined;
  if (!cat) return null;

  const existing = db
    .prepare(
      "SELECT id FROM interests WHERE category_id = ? AND LOWER(normalized_value) = LOWER(?)"
    )
    .get(cat.id, cleanVal) as { id: number } | undefined;
  if (existing) return existing.id;

  const ins = db
    .prepare("INSERT INTO interests (category_id, normalized_value) VALUES (?, ?)")
    .run(cat.id, cleanVal);
  return Number(ins.lastInsertRowid);
}

export function ensureUserSelfProfile(db: DatabaseSync, userId: number) {
  const u = db
    .prepare("SELECT id, name, bio FROM users WHERE id = ?")
    .get(userId) as { id: number; name: string; bio: string | null } | undefined;
  if (!u) return;
  const firstNick = (u.name || "").trim().split(/\s+/)[0] || "สมาชิก";
  db.prepare(
    `INSERT OR IGNORE INTO user_profiles (user_id, full_name, nickname, bio)
     VALUES (?, ?, ?, ?)`
  ).run(u.id, u.name || firstNick, firstNick, u.bio || "");
}

export function getUserSelfProfile(userId: number) {
  const db = getDb();
  ensureUserSelfProfile(db, userId);

  const row = db
    .prepare(
      `SELECT up.user_id, u.email, up.full_name, up.nickname, up.birthday, up.contact_info,
              COALESCE(up.religion, 'ไม่ระบุ') AS religion,
              COALESCE(up.can_eat, '') AS can_eat,
              COALESCE(up.cannot_eat, '') AS cannot_eat,
              up.bio, COALESCE(up.avatar_color, '#D69DAE') AS avatar_color, up.updated_at
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE up.user_id = ?`
    )
    .get(userId) as
    | {
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
      }
    | undefined;

  if (!row) return null;

  const interests = db
    .prepare(
      `SELECT upi.id, upi.interest_id, c.slug AS category_slug, c.name_th AS category_name_th,
              i.normalized_value, i.normalized_value AS raw_value, upi.source,
              NULL AS text_input_id, 1.0 AS confidence, 1 AS confirmed,
              upi.restriction_type, upi.created_at
       FROM user_profile_interests upi
       JOIN interests i ON i.id = upi.interest_id
       JOIN interest_categories c ON c.id = i.category_id
       WHERE upi.user_id = ?
       ORDER BY upi.id ASC`
    )
    .all(userId);

  const dietary_restrictions = db
    .prepare(
      `SELECT id, user_id AS friend_id, restriction_label, restriction_category, source, created_at
       FROM user_profile_dietary_restrictions
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId);

  return {
    ...row,
    interests,
    dietary_restrictions,
  };
}

export function syncLinkedFriendFromUser(
  db: DatabaseSync,
  friendId: number,
  sourceUserId: number
) {
  ensureUserSelfProfile(db, sourceUserId);
  const profile = db
    .prepare(
      `SELECT full_name, nickname, birthday, contact_info,
              COALESCE(religion, 'ไม่ระบุ') AS religion,
              COALESCE(can_eat, '') AS can_eat,
              COALESCE(cannot_eat, '') AS cannot_eat,
              avatar_color
       FROM user_profiles WHERE user_id = ?`
    )
    .get(sourceUserId) as
    | {
        full_name: string;
        nickname: string;
        birthday: string | null;
        contact_info: string | null;
        religion: string;
        can_eat: string;
        cannot_eat: string;
        avatar_color: string;
      }
    | undefined;
  if (!profile) return;

  db.prepare(
    `UPDATE friends
     SET full_name = ?, nickname = ?, birthday = ?, contact_info = ?,
         religion = ?, can_eat = ?, cannot_eat = ?,
         avatar_color = COALESCE(NULLIF(?, ''), avatar_color),
         consent_given = 1,
         updated_at = datetime('now', 'localtime')
     WHERE id = ? AND linked_user_id = ? AND user_id != ?`
  ).run(
    profile.full_name || profile.nickname,
    profile.nickname || profile.full_name,
    profile.birthday,
    profile.contact_info,
    profile.religion || "ไม่ระบุ",
    profile.can_eat || "",
    profile.cannot_eat || "",
    profile.avatar_color || "#D69DAE",
    friendId,
    sourceUserId,
    sourceUserId
  );

  const selfInterests = db
    .prepare(
      `SELECT upi.interest_id, i.normalized_value AS raw_value, upi.source, upi.restriction_type
       FROM user_profile_interests upi
       JOIN interests i ON i.id = upi.interest_id
       WHERE upi.user_id = ?`
    )
    .all(sourceUserId) as Array<{
    interest_id: number;
    raw_value: string;
    source: string;
    restriction_type: string | null;
  }>;

  db.prepare("DELETE FROM friend_interests WHERE friend_id = ?").run(friendId);
  const insInt = db.prepare(
    `INSERT OR REPLACE INTO friend_interests (friend_id, interest_id, raw_value, source, confidence, confirmed, restriction_type)
     VALUES (?, ?, ?, 'self_service', 1.0, 1, ?)`
  );
  for (const item of selfInterests) {
    insInt.run(friendId, item.interest_id, item.raw_value, item.restriction_type ?? null);
  }

  const selfDietary = db
    .prepare(
      "SELECT restriction_label, restriction_category FROM user_profile_dietary_restrictions WHERE user_id = ?"
    )
    .all(sourceUserId) as Array<{ restriction_label: string; restriction_category: string }>;

  db.prepare("DELETE FROM friend_dietary_restrictions WHERE friend_id = ?").run(friendId);
  const insDiet = db.prepare(
    `INSERT OR IGNORE INTO friend_dietary_restrictions (friend_id, restriction_label, restriction_category, source)
     VALUES (?, ?, ?, 'self_service')`
  );
  for (const d of selfDietary) {
    insDiet.run(friendId, d.restriction_label, d.restriction_category);
  }
}

export function syncUserSelfProfileToLinkedFriends(db: DatabaseSync, userId: number) {
  const rows = db
    .prepare("SELECT id FROM friends WHERE linked_user_id = ? AND user_id != ?")
    .all(userId, userId) as Array<{ id: number }>;
  for (const r of rows) {
    syncLinkedFriendFromUser(db, r.id, userId);
  }
}

export function replaceUserSelfProfile(
  db: DatabaseSync,
  userId: number,
  payload: {
    full_name: string;
    nickname: string;
    birthday?: string | null;
    contact_info?: string | null;
    religion?: string;
    can_eat?: string;
    cannot_eat?: string;
    interests?: Array<{
      categorySlug: string;
      normalizedValue: string;
      restrictionType?: "allergy" | "dislike" | null;
      source?: string;
    }>;
    dietary_restrictions?: Array<string | { label: string; category?: DietaryRestrictionCategory }>;
  }
) {
  ensureUserSelfProfile(db, userId);

  const finalNickname = (payload.nickname || payload.full_name).trim();
  const finalFullName = (payload.full_name || payload.nickname).trim();

  db.prepare(
    `UPDATE user_profiles
     SET full_name = ?, nickname = ?, birthday = ?, contact_info = ?,
         religion = ?, can_eat = ?, cannot_eat = ?,
         updated_at = datetime('now', 'localtime')
     WHERE user_id = ?`
  ).run(
    finalFullName,
    finalNickname,
    payload.birthday ?? null,
    payload.contact_info ?? null,
    payload.religion || "ไม่ระบุ",
    payload.can_eat ?? "",
    payload.cannot_eat ?? "",
    userId
  );

  if (Array.isArray(payload.interests)) {
    db.prepare("DELETE FROM user_profile_interests WHERE user_id = ?").run(userId);
    const ins = db.prepare(
      `INSERT OR IGNORE INTO user_profile_interests (user_id, interest_id, source, restriction_type)
       VALUES (?, ?, ?, ?)`
    );
    for (const item of payload.interests) {
      const intId = resolveOrCreateInterestId(db, item.categorySlug, item.normalizedValue);
      if (intId) {
        ins.run(userId, intId, item.source || "self_service", item.restrictionType ?? null);
      }
    }
  }

  if (Array.isArray(payload.dietary_restrictions)) {
    db.prepare("DELETE FROM user_profile_dietary_restrictions WHERE user_id = ?").run(userId);
    const seen = new Set<string>();
    const insDiet = db.prepare(
      `INSERT OR IGNORE INTO user_profile_dietary_restrictions
       (user_id, restriction_label, restriction_category, source)
       VALUES (?, ?, ?, 'self_service')`
    );
    for (const item of payload.dietary_restrictions) {
      const label = (typeof item === "string" ? item : item.label).trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      const category =
        typeof item === "string"
          ? inferDietaryCategory(label)
          : item.category || inferDietaryCategory(label);
      insDiet.run(userId, label, category);
    }
  }

  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(
    finalNickname || finalFullName,
    userId
  );

  syncUserSelfProfileToLinkedFriends(db, userId);
}

export function linkFriendBetweenUsers(
  db: DatabaseSync,
  ownerUserId: number,
  targetUserId: number
): number {
  if (ownerUserId === targetUserId) {
    throw new Error("Cannot link a user to themselves");
  }
  ensureUserSelfProfile(db, targetUserId);

  const existing = db
    .prepare("SELECT id FROM friends WHERE user_id = ? AND linked_user_id = ?")
    .get(ownerUserId, targetUserId) as { id: number } | undefined;

  if (existing) {
    syncLinkedFriendFromUser(db, existing.id, targetUserId);
    return existing.id;
  }

  const targetProfile = db
    .prepare(
      `SELECT full_name, nickname, birthday, contact_info,
              COALESCE(religion, 'ไม่ระบุ') AS religion,
              COALESCE(can_eat, '') AS can_eat,
              COALESCE(cannot_eat, '') AS cannot_eat,
              avatar_color
       FROM user_profiles WHERE user_id = ?`
    )
    .get(targetUserId) as
    | {
        full_name: string;
        nickname: string;
        birthday: string | null;
        contact_info: string | null;
        religion: string;
        can_eat: string;
        cannot_eat: string;
        avatar_color: string;
      }
    | undefined;

  const nick = targetProfile?.nickname || targetProfile?.full_name || "เพื่อน";
  const full = targetProfile?.full_name || nick;

  const res = db
    .prepare(
      `INSERT INTO friends
       (user_id, linked_user_id, full_name, nickname, birthday, contact_info,
        personal_notes, religion, can_eat, cannot_eat, avatar_color, consent_given, joined_via_invite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    )
    .run(
      ownerUserId,
      targetUserId,
      full,
      nick,
      targetProfile?.birthday ?? null,
      targetProfile?.contact_info ?? null,
      "เชื่อมต่อจากบัญชีผู้ใช้ CHUAN-DI โดยตรง (ซิงก์อัตโนมัติ)",
      targetProfile?.religion || "ไม่ระบุ",
      targetProfile?.can_eat || "",
      targetProfile?.cannot_eat || "",
      targetProfile?.avatar_color || "#D69DAE"
    );

  const newFriendId = Number(res.lastInsertRowid);
  syncLinkedFriendFromUser(db, newFriendId, targetUserId);
  return newFriendId;
}

function seedDefaultSelfProfileInterests(
  db: DatabaseSync,
  userId: number,
  items: Array<{ cat: string; val: string; restrictionType?: "allergy" | "dislike" | null }>
) {
  const ins = db.prepare(
    `INSERT OR IGNORE INTO user_profile_interests (user_id, interest_id, source, restriction_type)
     VALUES (?, ?, 'self_service', ?)`
  );
  for (const item of items) {
    const intId = resolveOrCreateInterestId(db, item.cat, item.val);
    if (intId) ins.run(userId, intId, item.restrictionType ?? null);
  }
}

function runSelfProfileAndLinksMigration(db: DatabaseSync) {
  const applied = db
    .prepare("SELECT name FROM app_migrations WHERE name = 'self_profile_and_friend_links_v1'")
    .get() as { name: string } | undefined;
  if (applied) return;

  // 1) Fix self-linked bug (e.g. demo user accidentally linked to Alice friend row #329)
  const selfLinkedRows = db
    .prepare("SELECT id FROM friends WHERE linked_user_id IS NOT NULL AND linked_user_id = user_id")
    .all() as Array<{ id: number }>;
  if (selfLinkedRows.length > 0) {
    db.prepare(
      "UPDATE friends SET linked_user_id = NULL WHERE linked_user_id IS NOT NULL AND linked_user_id = user_id"
    ).run();
    for (const row of selfLinkedRows) {
      db.prepare(
        `UPDATE registration_invitations
         SET status = 'active', accepted_friend_id = NULL, accepted_at = NULL
         WHERE accepted_friend_id = ?`
      ).run(row.id);
    }
  }

  // 2) Ensure user_profiles exists for every existing user
  const allUsers = db.prepare("SELECT id, email FROM users").all() as Array<{
    id: number;
    email: string;
  }>;
  for (const u of allUsers) {
    ensureUserSelfProfile(db, u.id);
  }

  // 3) Populate rich self-profile defaults for demo organizer ("แพรว") if blank
  const demoUser = db
    .prepare("SELECT id FROM users WHERE email = 'demo@chuan-di.app'")
    .get() as { id: number } | undefined;
  if (demoUser) {
    const cnt = db
      .prepare("SELECT COUNT(*) as cnt FROM user_profile_interests WHERE user_id = ?")
      .get(demoUser.id) as { cnt: number };
    if (cnt.cnt === 0) {
      db.prepare(
        `UPDATE user_profiles
         SET full_name = 'แพรว พัชรินทร์', nickname = 'แพรว', birthday = '1999-05-14',
             contact_info = 'LINE: praew.cd', religion = 'พุทธ',
             can_eat = 'อาหารญี่ปุ่น, ชาบู, กาแฟ, ของหวาน, หมูกระทะ',
             cannot_eat = 'ไม่ชอบอาหารเผ็ดมาก',
             avatar_color = '#D69DAE',
             updated_at = datetime('now', 'localtime')
         WHERE user_id = ?`
      ).run(demoUser.id);
      seedDefaultSelfProfileInterests(db, demoUser.id, [
        { cat: "food_preferences", val: "อาหารญี่ปุ่น" },
        { cat: "food_preferences", val: "ชาบู" },
        { cat: "food_preferences", val: "กาแฟ" },
        { cat: "food_preferences", val: "ของหวาน" },
        { cat: "disliked_food", val: "อาหารเผ็ด", restrictionType: "dislike" },
        { cat: "hobbies", val: "ถ่ายรูป" },
        { cat: "hobbies", val: "ดูหนัง" },
        { cat: "travel_interests", val: "คาเฟ่" },
        { cat: "travel_interests", val: "ทะเล" },
        { cat: "lifestyle", val: "สายคาเฟ่" },
      ]);
    }
  }

  // 4) Seed sample profile for bow@gmail.com if present so account-based friend testing works nicely
  const bowUser = db
    .prepare("SELECT id FROM users WHERE email = 'bow@gmail.com'")
    .get() as { id: number } | undefined;
  if (bowUser) {
    const cnt = db
      .prepare("SELECT COUNT(*) as cnt FROM user_profile_interests WHERE user_id = ?")
      .get(bowUser.id) as { cnt: number };
    if (cnt.cnt === 0) {
      db.prepare(
        `UPDATE user_profiles
         SET full_name = 'โบว์ ศศิธร', nickname = 'โบว์', birthday = '2000-02-20',
             contact_info = 'LINE: bow.ss', religion = 'พุทธ',
             can_eat = 'ชาบู, คาเฟ่, ชานมไข่มุก, ของหวาน',
             cannot_eat = 'งดแอลกอฮอล์',
             avatar_color = '#B4A6C2',
             updated_at = datetime('now', 'localtime')
         WHERE user_id = ?`
      ).run(bowUser.id);
      seedDefaultSelfProfileInterests(db, bowUser.id, [
        { cat: "food_preferences", val: "ชาบู" },
        { cat: "food_preferences", val: "ชานมไข่มุก" },
        { cat: "food_preferences", val: "ของหวาน" },
        { cat: "hobbies", val: "ดูหนัง" },
        { cat: "hobbies", val: "อ่านหนังสือ" },
        { cat: "travel_interests", val: "คาเฟ่" },
        { cat: "lifestyle", val: "สายคาเฟ่" },
      ]);
      db.prepare(
        `INSERT OR IGNORE INTO user_profile_dietary_restrictions (user_id, restriction_label, restriction_category, source)
         VALUES (?, 'ไม่ดื่มแอลกอฮอล์', 'alcohol_free', 'self_service')`
      ).run(bowUser.id);
    }
  }

  db.prepare(
    "INSERT OR IGNORE INTO app_migrations (name) VALUES ('self_profile_and_friend_links_v1')"
  ).run();
}

export function getDb(): DatabaseSync {
  if (!global.__chuanDiDb) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const db = new DatabaseSync(DB_PATH);
    initSchema(db);
    global.__chuanDiDb = db;
  }

  if (!global.__chuanDiSeeded) {
    global.__chuanDiSeeded = true;
    ensureDemoSeeded(global.__chuanDiDb);
    ensureDemoCalendarV2Backfill(global.__chuanDiDb);
  }

  return global.__chuanDiDb;
}

export function ensureInterestId(
  db: DatabaseSync,
  categorySlug: CategorySlug,
  normalizedValue: string
): number {
  const catRow = db
    .prepare("SELECT id FROM interest_categories WHERE slug = ?")
    .get(categorySlug) as { id: number } | undefined;

  if (!catRow) {
    throw new Error(`Unknown interest category: ${categorySlug}`);
  }

  const cleanVal = normalizedValue.trim();
  const existing = db
    .prepare("SELECT id FROM interests WHERE category_id = ? AND normalized_value = ?")
    .get(catRow.id, cleanVal) as { id: number } | undefined;

  if (existing) return existing.id;

  const res = db
    .prepare("INSERT INTO interests (category_id, normalized_value) VALUES (?, ?)")
    .run(catRow.id, cleanVal);
  return Number(res.lastInsertRowid);
}

export function upsertFriendInterest(
  db: DatabaseSync,
  params: {
    friendId: number;
    categorySlug: CategorySlug;
    normalizedValue: string;
    rawValue?: string;
    source?: string;
    textInputId?: number | null;
    confidence?: number;
    restrictionType?: string | null;
    preserveExisting?: boolean;
  }
) {
  const interestId = ensureInterestId(db, params.categorySlug, params.normalizedValue);
  if (params.preserveExisting) {
    const existing = db
      .prepare("SELECT id FROM friend_interests WHERE friend_id = ? AND interest_id = ? AND confirmed = 1")
      .get(params.friendId, interestId);
    if (existing) {
      return { inserted: false, skippedExisting: true };
    }
  }

  db.prepare(`
    INSERT INTO friend_interests (friend_id, interest_id, raw_value, source, text_input_id, confidence, confirmed, restriction_type)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(friend_id, interest_id) DO UPDATE SET
      raw_value = excluded.raw_value,
      source = excluded.source,
      text_input_id = COALESCE(excluded.text_input_id, friend_interests.text_input_id),
      confidence = excluded.confidence,
      restriction_type = COALESCE(excluded.restriction_type, friend_interests.restriction_type),
      updated_at = datetime('now', 'localtime')
  `).run(
    params.friendId,
    interestId,
    params.rawValue || params.normalizedValue,
    params.source || "manual",
    params.textInputId ?? null,
    params.confidence ?? 1.0,
    params.restrictionType ?? null
  );
  return { inserted: true, skippedExisting: false };
}

export function getFriendsWithInterests(userId: number): FriendRecord[] {
  const db = getDb();
  const friends = db
    .prepare(
      `SELECT f.id, f.user_id, f.linked_user_id, u_linked.email AS linked_user_email,
              f.full_name, f.nickname, f.birthday, f.contact_info, f.personal_notes,
              COALESCE(f.religion, 'ไม่ระบุ') AS religion,
              COALESCE(f.can_eat, '') AS can_eat,
              COALESCE(f.cannot_eat, '') AS cannot_eat,
              f.avatar_color, f.consent_given, f.joined_via_invite, f.created_at, f.updated_at
       FROM friends f
       LEFT JOIN users u_linked ON u_linked.id = f.linked_user_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC, f.id DESC`
    )
    .all(userId) as unknown as Omit<FriendRecord, "interests">[];

  const interestsRows = db
    .prepare(
      `SELECT fi.id, fi.friend_id, fi.interest_id, ic.slug AS category_slug,
              ic.name_th AS category_name_th, i.normalized_value, fi.raw_value,
              fi.source, fi.text_input_id, fi.confidence, fi.confirmed, fi.restriction_type, fi.created_at
       FROM friend_interests fi
       JOIN interests i ON i.id = fi.interest_id
       JOIN interest_categories ic ON ic.id = i.category_id
       JOIN friends f ON f.id = fi.friend_id
       WHERE f.user_id = ?
       ORDER BY fi.id ASC`
    )
    .all(userId) as unknown as (FriendInterestItem & { friend_id: number })[];

  const byFriend = new Map<number, FriendInterestItem[]>();
  for (const row of interestsRows) {
    const list = byFriend.get(row.friend_id) || [];
    list.push({
      id: row.id,
      interest_id: row.interest_id,
      category_slug: row.category_slug,
      category_name_th: row.category_name_th,
      normalized_value: row.normalized_value,
      raw_value: row.raw_value,
      source: row.source,
      text_input_id: row.text_input_id,
      confidence: row.confidence,
      confirmed: row.confirmed,
      restriction_type: row.restriction_type ?? null,
      created_at: row.created_at,
    });
    byFriend.set(row.friend_id, list);
  }

  const dietaryRows = db
    .prepare(
      `SELECT fdr.id, fdr.friend_id, fdr.restriction_label, fdr.restriction_category,
              fdr.source, fdr.text_input_id, fdr.created_at
       FROM friend_dietary_restrictions fdr
       JOIN friends f ON f.id = fdr.friend_id
       WHERE f.user_id = ?
       ORDER BY fdr.id ASC`
    )
    .all(userId) as unknown as FriendDietaryRestrictionItem[];

  const byFriendDietary = new Map<number, FriendDietaryRestrictionItem[]>();
  for (const row of dietaryRows) {
    const list = byFriendDietary.get(row.friend_id) || [];
    list.push({
      id: row.id,
      friend_id: row.friend_id,
      restriction_label: row.restriction_label,
      restriction_category: row.restriction_category,
      source: row.source,
      text_input_id: row.text_input_id ?? null,
      created_at: row.created_at,
    });
    byFriendDietary.set(row.friend_id, list);
  }

  return friends.map((f) => ({
    ...f,
    interests: byFriend.get(f.id) || [],
    dietary_restrictions: byFriendDietary.get(f.id) || [],
  }));
}

export function ensureDemoSeeded(db: DatabaseSync) {
  const demoEmail = "demo@chuan-di.app";
  const existing = db
    .prepare("SELECT id, name FROM users WHERE email = ?")
    .get(demoEmail) as { id: number; name: string } | undefined;

  if (existing) {
    if (existing.name.includes("(")) {
      db.prepare("UPDATE users SET name = 'แพรว' WHERE id = ?").run(existing.id);
    }
    // Check if user has zero friends (only seed if completely empty)
    const countRow = db
      .prepare("SELECT COUNT(*) as cnt FROM friends WHERE user_id = ?")
      .get(existing.id) as { cnt: number };
    if (countRow.cnt > 0) {
      // Backfill Phase 5 dietary/religion/allergy metadata once on untouched pre-Phase 5 demo DB
      const needsBackfill = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM friends WHERE user_id = ? AND religion = 'ไม่ระบุ' AND can_eat = '' AND cannot_eat = ''"
        )
        .get(existing.id) as { cnt: number };
      if (needsBackfill.cnt >= 15) {
        const upd = db.prepare(
          "UPDATE friends SET religion = ?, can_eat = ?, cannot_eat = ? WHERE user_id = ? AND nickname = ? AND religion = 'ไม่ระบุ'"
        );
        for (const f of DEMO_FRIENDS) {
          upd.run(f.religion, f.can_eat, f.cannot_eat, existing.id, f.nickname);
          const fRow = db
            .prepare("SELECT id FROM friends WHERE user_id = ? AND nickname = ?")
            .get(existing.id, f.nickname) as { id: number } | undefined;
          if (fRow) {
            for (const a of f.allergies || []) {
              upsertFriendInterest(db, {
                friendId: fRow.id,
                categorySlug: "disliked_food",
                normalizedValue: a,
                source: "seed",
                restrictionType: "allergy",
              });
            }
          }
        }
      }
      ensureDemoThaiNicknames(db, existing.id);
      ensureDemoCalendarSeeded(db, existing.id);
      return;
    }
    seedDemoDataForUser(db, existing.id);
    ensureDemoCalendarSeeded(db, existing.id);
    return;
  }

  const hash = bcrypt.hashSync("ChuanDiDemo123", 10);
  const res = db
    .prepare("INSERT INTO users (name, email, password_hash, bio) VALUES (?, ?, ?, ?)")
    .run(
      "แพรว",
      demoEmail,
      hash,
      "ผู้จัดกิจกรรมและรวบรวมข้อมูลความชอบของกลุ่มเพื่อน"
    );
  const userId = Number(res.lastInsertRowid);
  seedDemoDataForUser(db, userId);
  ensureDemoCalendarSeeded(db, userId);
}

function ensureDemoThaiNicknames(db: DatabaseSync, userId: number) {
  const applied = db
    .prepare("SELECT name FROM app_migrations WHERE name = 'thai_demo_nicknames_v1'")
    .get() as { name: string } | undefined;
  if (applied) return;

  db.prepare("UPDATE friends SET nickname = 'อลิส' WHERE user_id = ? AND nickname = 'Alice'").run(
    userId
  );
  db.prepare("UPDATE friends SET nickname = 'บ็อบ' WHERE user_id = ? AND nickname = 'Bob'").run(
    userId
  );
  db.prepare(
    `UPDATE extracted_data
     SET detected_friend_name = 'อลิส'
     WHERE detected_friend_name = 'Alice'
       AND friend_id IN (SELECT id FROM friends WHERE user_id = ?)`
  ).run(userId);
  db.prepare(
    `UPDATE extracted_data
     SET detected_friend_name = 'บ็อบ'
     WHERE detected_friend_name = 'Bob'
       AND friend_id IN (SELECT id FROM friends WHERE user_id = ?)`
  ).run(userId);
  db.prepare(
    `UPDATE registration_invitations
     SET target_friend_name = 'อลิส',
         label = 'ลิงก์ให้อลิสอัปเดตความชอบด้วยตัวเอง'
     WHERE user_id = ? AND target_friend_name = 'Alice'`
  ).run(userId);
  db.prepare(
    `UPDATE text_inputs
     SET raw_text = replace(replace(raw_text, 'Alice', 'อลิส'), 'Bob', 'บ็อบ')
     WHERE user_id = ? AND (raw_text LIKE '%Alice%' OR raw_text LIKE '%Bob%')`
  ).run(userId);

  db.prepare("INSERT OR IGNORE INTO app_migrations (name) VALUES ('thai_demo_nicknames_v1')").run();
}

function getBangkokDateOffset(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value || 2026);
  const m = Number(parts.find((p) => p.type === "month")?.value || 11);
  const d = Number(parts.find((p) => p.type === "day")?.value || 13);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

function ensureDemoCalendarSeeded(db: DatabaseSync, userId: number) {
  const applied = db
    .prepare("SELECT name FROM app_migrations WHERE name = 'calendar_demo_seed_v1'")
    .get() as { name: string } | undefined;
  if (applied) return;

  // Organizer ("แพรว") recurring & specific date availability (only if user has no entries yet)
  const selfCount = db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM user_weekly_availability WHERE user_id = ?) + (SELECT COUNT(*) FROM user_date_availability WHERE user_id = ?) as cnt"
    )
    .get(userId, userId) as { cnt: number };

  if (selfCount.cnt === 0) {
    const insUserWeekly = db.prepare(`
      INSERT OR IGNORE INTO user_weekly_availability (user_id, weekday, status, start_time, end_time, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insUserWeekly.run(userId, 5, "available", "18:00", "22:00", "ว่างเย็นวันศุกร์หลังเลิกงาน");
    insUserWeekly.run(userId, 6, "available", "10:00", "21:00", "ว่างทุกวันเสาร์");
    insUserWeekly.run(userId, 0, "available", "10:00", "19:00", "ว่างทุกวันอาทิตย์");

    const insUserDate = db.prepare(`
      INSERT OR IGNORE INTO user_date_availability (user_id, avail_date, status, start_time, end_time, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insUserDate.run(userId, getBangkokDateOffset(3), "unavailable", "08:00", "22:00", "ติดประชุมตลอดวัน");
    insUserDate.run(userId, getBangkokDateOffset(4), "available", "18:30", "21:30", "นัดทานข้าวเย็นได้");
  }

  seedDemoFriendCalendarSchedules(db, userId);

  db.prepare("INSERT OR IGNORE INTO app_migrations (name) VALUES ('calendar_demo_seed_v1')").run();
}

/**
 * Seeds simulated shared calendar schedules for 14 of 22 demo friends (~64%)
 * so Smart Calendar immediately demonstrates realistic matching while keeping 8
 * friends unshared ('ยังไม่ทราบ') per privacy Rule #9.
 */
export function seedDemoFriendCalendarSchedules(db: DatabaseSync, userId: number) {
  const friends = db
    .prepare("SELECT id, nickname FROM friends WHERE user_id = ?")
    .all(userId) as Array<{ id: number; nickname: string }>;
  const byNick = new Map<string, number>();
  for (const f of friends) byNick.set(f.nickname, f.id);

  const upsertPerm = db.prepare(`
    INSERT OR IGNORE INTO friend_calendar_permissions (friend_id, user_id, is_shared, share_source, granted_at)
    VALUES (?, ?, 1, 'invite_consent', datetime('now', 'localtime'))
  `);
  const insFriendWeekly = db.prepare(`
    INSERT OR IGNORE INTO friend_weekly_availability (friend_id, weekday, status, start_time, end_time, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insFriendDate = db.prepare(`
    INSERT OR IGNORE INTO friend_date_availability (friend_id, avail_date, status, start_time, end_time, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sharedSchedules: Array<{
    nick: string;
    weekly: Array<[number, "available" | "unavailable", string, string, string]>;
    overrides?: Array<[number, "available" | "unavailable", string, string, string]>;
  }> = [
    {
      nick: "อลิส",
      weekly: [
        [5, "available", "18:00", "22:00", "ว่างหลังเลิกงานวันศุกร์"],
        [6, "available", "10:00", "21:00", "ว่างทุกวันเสาร์"],
        [0, "available", "12:00", "20:00", "ว่างวันอาทิตย์ช่วงบ่าย-เย็น"],
      ],
      overrides: [[4, "available", "18:00", "21:30", "ว่างเย็นวันอังคารนี้"]],
    },
    {
      nick: "บ็อบ",
      weekly: [
        [5, "available", "18:30", "22:00", "ว่างเย็นวันศุกร์"],
        [6, "available", "09:00", "18:30", "ว่างวันเสาร์ถึงเย็น"],
        [0, "available", "09:00", "17:30", "ว่างวันอาทิตย์กลางวัน"],
      ],
      overrides: [[2, "unavailable", "08:00", "22:00", "ติดธุระครอบครัว"]],
    },
    {
      nick: "มิ้นท์",
      weekly: [
        [5, "available", "18:00", "21:30", "ว่างเย็นวันศุกร์"],
        [6, "available", "13:00", "21:00", "ว่างเสาร์บ่าย-ค่ำ"],
        [0, "available", "13:00", "20:00", "ว่างอาทิตย์บ่าย-ค่ำ"],
      ],
      overrides: [[4, "available", "19:00", "22:00", "หลัง 19:00 น. ไปได้"]],
    },
    {
      nick: "เจมส์",
      weekly: [
        [5, "unavailable", "18:00", "22:00", "ติดงานค่ำวันศุกร์"],
        [6, "available", "11:00", "22:00", "ว่างทุกวันเสาร์"],
        [0, "available", "11:00", "20:00", "ว่างทุกวันอาทิตย์"],
      ],
    },
    {
      nick: "พลอย",
      weekly: [
        [5, "available", "18:30", "21:30", "ว่างเย็นวันศุกร์"],
        [6, "available", "09:30", "19:30", "ว่างทุกวันเสาร์"],
        [0, "available", "10:00", "18:00", "ว่างทุกวันอาทิตย์"],
      ],
    },
    {
      nick: "เต้",
      weekly: [
        [5, "available", "18:00", "22:00", "ว่างวันศุกร์เย็น"],
        [6, "available", "08:00", "22:00", "ว่างเต็มวันเสาร์"],
      ],
    },
    {
      nick: "น้ำ",
      weekly: [
        [5, "unavailable", "08:00", "22:00", "ติดเรียนพิเศษวันศุกร์"],
        [6, "available", "13:00", "21:00", "ว่างเสาร์บ่าย-ค่ำ"],
        [0, "available", "14:00", "20:00", "ว่างอาทิตย์บ่าย-ค่ำ"],
      ],
    },
    {
      nick: "กันต์",
      weekly: [
        [5, "available", "18:00", "22:00", "ว่างเย็นวันศุกร์"],
        [6, "available", "10:00", "22:00", "ว่างทุกวันเสาร์"],
        [0, "available", "10:00", "21:00", "ว่างทุกวันอาทิตย์"],
      ],
    },
    {
      nick: "ข้าวฟ่าง",
      weekly: [
        [6, "available", "10:00", "17:00", "ว่างเสาร์ช่วงเช้า-บ่าย"],
        [0, "available", "10:00", "17:00", "ว่างอาทิตย์ช่วงเช้า-บ่าย"],
      ],
    },
    {
      nick: "โอม",
      weekly: [
        [3, "available", "18:30", "21:30", "ว่างเย็นวันพุธ"],
        [5, "available", "18:30", "22:00", "ว่างเย็นวันศุกร์"],
        [6, "available", "10:00", "21:00", "ว่างทุกวันเสาร์"],
      ],
      overrides: [[5, "unavailable", "08:00", "18:00", "ติดเข้าเวรช่วงกลางวัน"]],
    },
    {
      nick: "แบม",
      weekly: [
        [4, "available", "18:00", "21:30", "ว่างหลังเลิกงานวันพฤหัสบดี"],
        [6, "available", "11:00", "20:00", "ว่างวันเสาร์"],
        [0, "available", "12:00", "19:30", "ว่างวันอาทิตย์"],
      ],
      overrides: [[4, "available", "18:30", "21:30", "ว่างนัดคาเฟ่หรือทานข้าวเย็น"]],
    },
    {
      nick: "ฟ้า",
      weekly: [
        [5, "available", "18:00", "22:00", "ว่างเย็นวันศุกร์"],
        [6, "available", "09:00", "21:00", "ว่างทั้งวันเสาร์"],
        [0, "available", "10:00", "20:00", "ว่างวันอาทิตย์"],
      ],
    },
    {
      nick: "ปอนด์",
      weekly: [
        [5, "available", "19:00", "22:00", "ว่างค่ำวันศุกร์"],
        [6, "available", "13:00", "22:00", "ว่างเสาร์บ่าย-ค่ำ"],
        [0, "available", "13:00", "21:00", "ว่างอาทิตย์บ่าย-ค่ำ"],
      ],
      overrides: [[1, "unavailable", "08:00", "22:00", "ติดธุระทั้งวัน"]],
    },
    {
      nick: "แพร",
      weekly: [
        [5, "available", "18:30", "21:30", "ว่างเย็นวันศุกร์"],
        [6, "available", "12:00", "21:00", "ว่างวันเสาร์"],
        [0, "available", "11:00", "18:30", "ว่างวันอาทิตย์"],
      ],
    },
  ];

  for (const spec of sharedSchedules) {
    const fid = byNick.get(spec.nick);
    if (!fid) continue;
    upsertPerm.run(fid, userId);
    for (const [weekday, status, start, end, note] of spec.weekly) {
      insFriendWeekly.run(fid, weekday, status, start, end, note);
    }
    for (const [offset, status, start, end, note] of spec.overrides || []) {
      insFriendDate.run(fid, getBangkokDateOffset(offset), status, start, end, note);
    }
  }
}

function ensureDemoCalendarV2Backfill(db: DatabaseSync) {
  const migrated = db
    .prepare("SELECT name FROM app_migrations WHERE name = 'calendar_demo_seed_v2'")
    .get();
  if (migrated) return;

  const demoUser = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(DEMO_ACCOUNT_EMAIL) as { id: number } | undefined;

  if (demoUser) {
    seedDemoFriendCalendarSchedules(db, demoUser.id);
  }

  db.prepare("INSERT OR IGNORE INTO app_migrations (name) VALUES ('calendar_demo_seed_v2')").run();
}

interface SeedFriendDef {
  full_name: string;
  nickname: string;
  birthday: string;
  contact_info: string;
  personal_notes: string;
  religion: string;
  can_eat: string;
  cannot_eat: string;
  avatar_color: string;
  food: string[];
  allergies?: string[];
  dislikes: string[];
  hobbies: string[];
  travel: string[];
  lifestyle: string[];
  other: string[];
}

const DEMO_FRIENDS: SeedFriendDef[] = [
  {
    full_name: "อลิสา วงศ์สวัสดิ์",
    nickname: "อลิส",
    birthday: "1999-04-12",
    contact_info: "LINE: alice.ws",
    personal_notes: "เพื่อนสมัยมหาลัย ชอบปิ้งย่างและถ่ายรูปมาก แพ้กุ้งและอาหารทะเล",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, ชาบู, หมูกระทะ, ของหวาน",
    cannot_eat: "งดกุ้งและอาหารทะเลทุกชนิด เนื่องจากแพ้อาหารทะเล",
    avatar_color: "#D69DAE",
    food: ["หมูกระทะ", "ชาบู"],
    allergies: ["กุ้ง", "อาหารทะเล"],
    dislikes: [],
    hobbies: ["ถ่ายรูป", "ดูหนัง"],
    travel: ["ทะเล", "คาเฟ่"],
    lifestyle: ["สายคาเฟ่"],
    other: ["ดนตรี"],
  },
  {
    full_name: "บดินทร์ พิพัฒน์",
    nickname: "บ็อบ",
    birthday: "1998-08-23",
    contact_info: "LINE: bob.dev",
    personal_notes: "ชื่นชอบกาแฟเป็นพิเศษ สามารถร่วมรับประทานอาหารได้ทุกประเภท",
    religion: "คริสต์",
    can_eat: "รับประทานได้ทุกอย่าง ทั้งหมู ไก่ เนื้อ อาหารทะเล และกาแฟ",
    cannot_eat: "ไม่ทานทุเรียน",
    avatar_color: "#C4B49A",
    food: ["กาแฟ", "หมูกระทะ"],
    dislikes: ["ทุเรียน"],
    hobbies: ["บอร์ดเกม", "อ่านหนังสือ"],
    travel: ["คาเฟ่", "ท่องเที่ยว"],
    lifestyle: ["สายชิล"],
    other: ["เกม"],
  },
  {
    full_name: "มินตรา สุขใจ",
    nickname: "มิ้นท์",
    birthday: "2000-01-19",
    contact_info: "IG: @mint.sj",
    personal_notes: "รับประทานอาหารเผ็ดได้น้อย และมีประวัติแพ้ถั่วลิสง",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, ชาบูน้ำใส, ของหวาน",
    cannot_eat: "งดถั่วลิสงเนื่องจากแพ้ และเลี่ยงอาหารรสเผ็ดจัด",
    avatar_color: "#B4A6C2",
    food: ["หมูกระทะ", "ชาบู", "ของหวาน"],
    allergies: ["ถั่วลิสง"],
    dislikes: ["อาหารเผ็ด"],
    hobbies: ["ทำขนม", "ดูหนัง"],
    travel: ["คาเฟ่", "ทะเล"],
    lifestyle: ["สายคาเฟ่", "รักสัตว์"],
    other: ["K-Pop"],
  },
  {
    full_name: "เจตน์สฤษฎิ์ รัตนชัย",
    nickname: "เจมส์",
    birthday: "1997-11-05",
    contact_info: "LINE: james_rc",
    personal_notes: "ชื่นชอบการเล่นบอร์ดเกม มีบอร์ดเกมสะสมหลายชุด",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, พิซซ่า, อาหารทะเล",
    cannot_eat: "ไม่กินผักชี",
    avatar_color: "#9CB8A6",
    food: ["หมูกระทะ", "พิซซ่า"],
    dislikes: ["ผักชี"],
    hobbies: ["บอร์ดเกม", "วิ่งออกกำลังกาย"],
    travel: ["ภูเขา", "แคมป์ปิ้ง"],
    lifestyle: ["สายชิล"],
    other: ["เกม"],
  },
  {
    full_name: "พลอยไพลิน เจริญพร",
    nickname: "พลอย",
    birthday: "2001-03-28",
    contact_info: "IG: @ploy.jp",
    personal_notes: "นับถือศาสนาฮินดู งดเนื้อวัวโดยเด็ดขาด ชอบถ่ายรูปฟิล์มและคาเฟ่",
    religion: "ฮินดู",
    can_eat: "ไก่, หมู, อาหารทะเล, ผัก, ส้มตำ, ชาบู, ของหวาน",
    cannot_eat: "งดเนื้อวัว ตามหลักศาสนาฮินดู",
    avatar_color: "#D69DAE",
    food: ["ส้มตำ", "ชานมไข่มุก", "ชาบู"],
    dislikes: ["เนื้อวัว"],
    hobbies: ["ถ่ายรูป", "ทำขนม"],
    travel: ["คาเฟ่", "ทะเล"],
    lifestyle: ["สายคาเฟ่"],
    other: ["ศิลปะ"],
  },
  {
    full_name: "เตชินท์ มั่นคง",
    nickname: "เต้",
    birthday: "1999-07-14",
    contact_info: "LINE: tae.mk",
    personal_notes: "มีรถยนต์ส่วนตัวสำหรับร่วมเดินทาง ชอบแคมป์ปิ้งและปิ้งย่าง",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, อาหารเกาหลี",
    cannot_eat: "ไม่ชอบอาหารทะเลและอาหารกลิ่นคาว",
    avatar_color: "#C4B49A",
    food: ["หมูกระทะ", "อาหารเกาหลี"],
    dislikes: ["อาหารทะเล"],
    hobbies: ["บอร์ดเกม", "ถ่ายรูป"],
    travel: ["ภูเขา", "แคมป์ปิ้ง"],
    lifestyle: ["สายปาร์ตี้"],
    other: ["ดนตรี"],
  },
  {
    full_name: "น้ำฝน ศิริวัฒน์",
    nickname: "น้ำ",
    birthday: "2000-09-02",
    contact_info: "LINE: namfon.s",
    personal_notes: "แพ้นมวัวและแลคโตส ไม่รับประทานอาหารเผ็ด ชอบชมภาพยนตร์",
    religion: "พุทธ",
    can_eat: "อาหารญี่ปุ่น, ซูชิ, ชาบู, ไก่, หมู, เมนูนมโอ๊ตและถั่วเหลือง",
    cannot_eat: "งดนมวัวและวิปครีมเนื่องจากแพ้แลคโตส และเลี่ยงอาหารเผ็ด",
    avatar_color: "#9BA8B4",
    food: ["อาหารญี่ปุ่น", "ซูชิ", "ชาบู"],
    allergies: ["นมวัว"],
    dislikes: ["อาหารเผ็ด"],
    hobbies: ["ดูหนัง", "อ่านหนังสือ"],
    travel: ["คาเฟ่", "ปิกนิก"],
    lifestyle: ["รักสัตว์"],
    other: ["ดนตรี"],
  },
  {
    full_name: "กันตภณ ธีระกุล",
    nickname: "กันต์",
    birthday: "1998-05-17",
    contact_info: "LINE: gun.tk",
    personal_notes: "ชื่นชอบการนัดรับประทานหมูกระทะวันศุกร์",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, อาหารทะเล, ส้มตำ",
    cannot_eat: "ไม่ชอบกลิ่นทุเรียน",
    avatar_color: "#D69DAE",
    food: ["หมูกระทะ", "ส้มตำ", "อาหารเกาหลี"],
    dislikes: ["ทุเรียน"],
    hobbies: ["ดูหนัง", "วิ่งออกกำลังกาย"],
    travel: ["ทะเล", "ท่องเที่ยว"],
    lifestyle: ["สายปาร์ตี้"],
    other: ["เกม"],
  },
  {
    full_name: "ข้าวฟ่าง อรุณรุ่ง",
    nickname: "ข้าวฟ่าง",
    birthday: "2001-12-09",
    contact_info: "IG: @khaofang",
    personal_notes: "นับถือศาสนาอิสลาม รับประทานเฉพาะร้านฮาลาลหรืองดหมู",
    religion: "อิสลาม",
    can_eat: "อาหารฮาลาล, ไก่, เนื้อวัวฮาลาล, อาหารทะเล, พิซซ่าหน้าไก่, เบเกอรี่ไร้เจลาตินหมู",
    cannot_eat: "งดหมูเด็ดขาด ตามหลักศาสนาอิสลาม งดแอลกอฮอล์ ไม่กินเผ็ดและผักชี",
    avatar_color: "#B4A6C2",
    food: ["ของหวาน", "ชานมไข่มุก", "พิซซ่า"],
    dislikes: ["อาหารเผ็ด", "ผักชี", "เนื้อหมู"],
    hobbies: ["ทำขนม", "อ่านหนังสือ"],
    travel: ["คาเฟ่", "ปิกนิก"],
    lifestyle: ["สายคาเฟ่", "รักสัตว์"],
    other: ["ศิลปะ"],
  },
  {
    full_name: "โอม ชนาธิป",
    nickname: "โอม",
    birthday: "1999-02-21",
    contact_info: "LINE: ohm.ct",
    personal_notes: "ชอบกิจกรรมกลางแจ้ง ปิกนิก และเที่ยวทะเล",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, อาหารทะเล",
    cannot_eat: "ไม่กินผักชี",
    avatar_color: "#C4B49A",
    food: ["หมูกระทะ", "อาหารทะเล"],
    dislikes: ["ผักชี"],
    hobbies: ["วิ่งออกกำลังกาย", "ถ่ายรูป"],
    travel: ["ทะเล", "แคมป์ปิ้ง"],
    lifestyle: ["สายชิล"],
    other: ["ดนตรี"],
  },
  {
    full_name: "แบม จิราพร",
    nickname: "แบม",
    birthday: "2000-06-30",
    contact_info: "IG: @bam.jr",
    personal_notes: "แพ้ปูและอาหารทะเล ชอบไปคาเฟ่และชมภาพยนตร์",
    religion: "คริสต์",
    can_eat: "อาหารเกาหลี, ไก่ทอด, หมูย่าง, ของหวาน, ชานม",
    cannot_eat: "งดปูและอาหารทะเล เนื่องจากมีประวัติแพ้อาหาร",
    avatar_color: "#D69DAE",
    food: ["อาหารเกาหลี", "ชานมไข่มุก"],
    allergies: ["ปู", "อาหารทะเล"],
    dislikes: [],
    hobbies: ["ดูหนัง", "ถ่ายรูป"],
    travel: ["คาเฟ่", "เที่ยวต่างประเทศ"],
    lifestyle: ["สายคาเฟ่"],
    other: ["K-Pop"],
  },
  {
    full_name: "พีท ภควัต",
    nickname: "พีท",
    birthday: "1998-10-11",
    contact_info: "LINE: peat.pw",
    personal_notes: "ชอบเล่นบอร์ดเกมแนววางแผน ชอบพิซซ่าและหมูกระทะ",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, พิซซ่า, กาแฟ",
    cannot_eat: "ไม่กินทุเรียน",
    avatar_color: "#9CB8A6",
    food: ["หมูกระทะ", "พิซซ่า", "กาแฟ"],
    dislikes: ["ทุเรียน"],
    hobbies: ["บอร์ดเกม", "ดูหนัง"],
    travel: ["ภูเขา", "ท่องเที่ยว"],
    lifestyle: ["สายชิล"],
    other: ["เกม"],
  },
  {
    full_name: "ฟ้าใส พงศ์พันธ์",
    nickname: "ฟ้า",
    birthday: "2001-01-25",
    contact_info: "LINE: fahsai.p",
    personal_notes: "นับถือศาสนาอิสลาม ชอบเที่ยวทะเลและอาหารอีสานฮาลาล",
    religion: "อิสลาม",
    can_eat: "อาหารฮาลาล, อาหารทะเล, ไก่ย่าง, เนื้อย่างฮาลาล, ส้มตำ, ของหวาน",
    cannot_eat: "งดหมูเด็ดขาด ตามหลักศาสนาอิสลาม และงดแอลกอฮอล์",
    avatar_color: "#9BA8B4",
    food: ["อาหารทะเล", "ส้มตำ", "ของหวาน"],
    dislikes: ["เนื้อหมู"],
    hobbies: ["ถ่ายรูป", "อ่านหนังสือ"],
    travel: ["ทะเล", "คาเฟ่"],
    lifestyle: ["สายชิล", "รักสัตว์"],
    other: ["ศิลปะ"],
  },
  {
    full_name: "ปอนด์ กิตติพงษ์",
    nickname: "ปอนด์",
    birthday: "1997-09-18",
    contact_info: "LINE: pond.kp",
    personal_notes: "ทำงานสาย UX แพ้ถั่วลิสงรุนแรง ชอบคาเฟ่บรรยากาศสงบและบอร์ดเกม",
    religion: "คริสต์",
    can_eat: "กาแฟ, อาหารญี่ปุ่น, ปลาแซลมอน, หมู, ไก่",
    cannot_eat: "งดถั่วลิสงและน้ำมันถั่วลิสงทุกชนิด เนื่องจากแพ้รุนแรง และเลี่ยงอาหารเผ็ด",
    avatar_color: "#B4A6C2",
    food: ["กาแฟ", "อาหารญี่ปุ่น"],
    allergies: ["ถั่วลิสง"],
    dislikes: ["อาหารเผ็ด"],
    hobbies: ["บอร์ดเกม", "อ่านหนังสือ"],
    travel: ["คาเฟ่", "เที่ยวต่างประเทศ"],
    lifestyle: ["สายคาเฟ่"],
    other: ["ศิลปะ"],
  },
  {
    full_name: "เจนนิษฐ์ วรโชติ",
    nickname: "เจน",
    birthday: "2000-04-04",
    contact_info: "IG: @jane.wc",
    personal_notes: "แพ้หอยและปลาหมึก ชอบอาหารญี่ปุ่นและชาบู ไม่กินผักชี",
    religion: "พุทธ",
    can_eat: "ชาบูหมู, ชาบูเนื้อ, ซูชิแซลมอน, ไก่, ของหวาน",
    cannot_eat: "งดหอยและปลาหมึกเนื่องจากแพ้อาหาร และไม่ใส่ผักชี",
    avatar_color: "#D69DAE",
    food: ["ชาบู", "ซูชิ", "อาหารญี่ปุ่น"],
    allergies: ["หอย", "ปลาหมึก"],
    dislikes: ["ผักชี"],
    hobbies: ["ดูหนัง", "ทำขนม"],
    travel: ["เที่ยวต่างประเทศ", "คาเฟ่"],
    lifestyle: ["สายคาเฟ่"],
    other: ["K-Pop"],
  },
  {
    full_name: "มาร์ค ธนกฤต",
    nickname: "มาร์ค",
    birthday: "1999-12-16",
    contact_info: "LINE: mark.tk",
    personal_notes: "ชอบร่วมสังสรรค์หมูกระทะกับเพื่อน",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, ส้มตำ",
    cannot_eat: "ไม่ชอบอาหารทะเล",
    avatar_color: "#C4B49A",
    food: ["หมูกระทะ", "ส้มตำ"],
    dislikes: ["อาหารทะเล"],
    hobbies: ["วิ่งออกกำลังกาย", "บอร์ดเกม"],
    travel: ["ทะเล", "ภูเขา"],
    lifestyle: ["สายปาร์ตี้"],
    other: ["ดนตรี"],
  },
  {
    full_name: "อิงอร ลีลาวดี",
    nickname: "อิง",
    birthday: "2001-07-08",
    contact_info: "IG: @ing.ll",
    personal_notes: "รับประทานมังสวิรัติ งดเนื้อสัตว์ใหญ่ เมื่อไปชาบูต้องเลือกหม้อผักแยก",
    religion: "พุทธ",
    can_eat: "ผัก, เห็ด, เต้าหู้, ชาบูหม้อผักมังสวิรัติ, ของหวาน, กาแฟ",
    cannot_eat: "งดเนื้อสัตว์ใหญ่ ทานมังสวิรัติ และไม่ทานทุเรียน",
    avatar_color: "#9CB8A6",
    food: ["ของหวาน", "กาแฟ", "ชาบู"],
    dislikes: ["ทุเรียน", "เนื้อวัว"],
    hobbies: ["ถ่ายรูป", "ทำขนม"],
    travel: ["ปิกนิก", "คาเฟ่"],
    lifestyle: ["รักสัตว์", "สายชิล"],
    other: ["ศิลปะ"],
  },
  {
    full_name: "บอส ศุภณัฐ",
    nickname: "บอส",
    birthday: "1998-03-03",
    contact_info: "LINE: boss.sn",
    personal_notes: "ชอบอาหารเกาหลีและดูภาพยนตร์แอ็กชัน",
    religion: "พุทธ",
    can_eat: "หมู, ไก่, เนื้อ, อาหารเกาหลี, อาหารทะเล",
    cannot_eat: "ไม่กินผักชี",
    avatar_color: "#9BA8B4",
    food: ["อาหารเกาหลี", "หมูกระทะ"],
    dislikes: ["ผักชี"],
    hobbies: ["ดูหนัง", "เกม"],
    travel: ["ท่องเที่ยว", "ภูเขา"],
    lifestyle: ["สายปาร์ตี้"],
    other: ["เกม"],
  },
  {
    full_name: "เมย์ พิชชา",
    nickname: "เมย์",
    birthday: "2000-10-27",
    contact_info: "LINE: may.pc",
    personal_notes: "งดรับประทานเนื้อวัว ชอบอาหารญี่ปุ่นและคาเฟ่",
    religion: "พุทธ",
    can_eat: "ปลาแซลมอน, ซูชิ, ชาบูหมูและไก่, ชานมไข่มุก, ของหวาน",
    cannot_eat: "งดเนื้อวัวตามความเชื่อส่วนบุคคล",
    avatar_color: "#D69DAE",
    food: ["ซูชิ", "อาหารญี่ปุ่น", "ชานมไข่มุก"],
    dislikes: ["เนื้อวัว"],
    hobbies: ["อ่านหนังสือ", "ถ่ายรูป"],
    travel: ["คาเฟ่", "เที่ยวต่างประเทศ"],
    lifestyle: ["สายคาเฟ่"],
    other: ["ดนตรี"],
  },
  {
    full_name: "ซัน อาทิตย์",
    nickname: "ซัน",
    birthday: "1999-06-14",
    contact_info: "LINE: sun.at",
    personal_notes: "นับถือศาสนาอิสลาม ชอบเที่ยวทะเลและวิ่งมาราธอน",
    religion: "อิสลาม",
    can_eat: "อาหารฮาลาล, อาหารทะเล, ไก่ย่าง, เนื้อวัวฮาลาล, ส้มตำ",
    cannot_eat: "งดหมูเด็ดขาด ตามหลักศาสนาอิสลาม งดแอลกอฮอล์ และเลี่ยงเผ็ดมาก",
    avatar_color: "#C4B49A",
    food: ["อาหารทะเล", "ส้มตำ"],
    dislikes: ["เนื้อหมู", "อาหารเผ็ด"],
    hobbies: ["วิ่งออกกำลังกาย", "ดูหนัง"],
    travel: ["ทะเล", "ปิกนิก"],
    lifestyle: ["สายชิล"],
    other: ["ดนตรี"],
  },
  {
    full_name: "แพรวา กมลชนก",
    nickname: "แพร",
    birthday: "2001-08-09",
    contact_info: "IG: @praewa.km",
    personal_notes: "แพ้อัลมอนด์และถั่วเปลือกแข็ง ชอบเล่นบอร์ดเกมและทานชาบู",
    religion: "พุทธ",
    can_eat: "ชาบูหมูและเนื้อ, ไก่, อาหารทะเล, ของหวานไร้ถั่ว",
    cannot_eat: "งดอัลมอนด์และถั่วเปลือกแข็งเนื่องจากแพ้อาหาร และไม่ชอบทุเรียน",
    avatar_color: "#B4A6C2",
    food: ["ชาบู", "ของหวาน"],
    allergies: ["อัลมอนด์"],
    dislikes: ["ทุเรียน"],
    hobbies: ["บอร์ดเกม", "ทำขนม"],
    travel: ["คาเฟ่", "ปิกนิก"],
    lifestyle: ["รักสัตว์"],
    other: ["K-Pop"],
  },
  {
    full_name: "นนท์ ธีรภัทร",
    nickname: "นนท์",
    birthday: "1998-02-11",
    contact_info: "LINE: non.tp",
    personal_notes: "ชอบกิจกรรมแคมป์ปิ้งและดื่มกาแฟดริป",
    religion: "คริสต์",
    can_eat: "พิซซ่า, ไก่, หมู, เนื้อ, อาหารทะเล, กาแฟดริป",
    cannot_eat: "ไม่กินผักชี",
    avatar_color: "#9CB8A6",
    food: ["กาแฟ", "พิซซ่า"],
    dislikes: ["ผักชี"],
    hobbies: ["ถ่ายรูป", "บอร์ดเกม"],
    travel: ["ภูเขา", "แคมป์ปิ้ง"],
    lifestyle: ["สายชิล"],
    other: ["ดนตรี"],
  },
];

export function resetDemoDataForUser(userId: number) {
  const db = getDb();
  const targetUser = db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(userId) as { id: number; email: string } | undefined;

  if (!targetUser || targetUser.email !== DEMO_ACCOUNT_EMAIL) {
    throw new Error(
      "ฟังก์ชันรีเซ็ตข้อมูลเดโมอนุญาตเฉพาะบัญชีเดโม demo@chuan-di.app เท่านั้น เพื่อปกป้องข้อมูลผู้ใช้งานจริง"
    );
  }

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      "UPDATE users SET name = 'แพรว', bio = 'ผู้จัดกิจกรรมและรวบรวมข้อมูลความชอบของกลุ่มเพื่อน' WHERE id = ?"
    ).run(userId);
    db.prepare("DELETE FROM saved_segments WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM registration_invitations WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM activities WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM text_inputs WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM friends WHERE user_id = ?").run(userId);
    seedDemoDataForUser(db, userId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function seedDemoDataForUser(db: DatabaseSync, userId: number) {
  const friendIdsByNick = new Map<string, number>();

  const insertFriend = db.prepare(`
    INSERT INTO friends (user_id, full_name, nickname, birthday, contact_info, personal_notes, religion, can_eat, cannot_eat, avatar_color, consent_given, joined_via_invite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `);

  for (const f of DEMO_FRIENDS) {
    const res = insertFriend.run(
      userId,
      f.full_name,
      f.nickname,
      f.birthday,
      f.contact_info,
      f.personal_notes,
      f.religion,
      f.can_eat,
      f.cannot_eat,
      f.avatar_color
    );
    const fid = Number(res.lastInsertRowid);
    friendIdsByNick.set(f.nickname, fid);

    for (const v of f.food)
      upsertFriendInterest(db, { friendId: fid, categorySlug: "food_preferences", normalizedValue: v, source: "seed" });
    for (const v of f.allergies || [])
      upsertFriendInterest(db, {
        friendId: fid,
        categorySlug: "disliked_food",
        normalizedValue: v,
        source: "seed",
        restrictionType: "allergy",
      });
    for (const v of f.dislikes)
      upsertFriendInterest(db, {
        friendId: fid,
        categorySlug: "disliked_food",
        normalizedValue: v,
        source: "seed",
        restrictionType: "dislike",
      });
    for (const v of f.hobbies)
      upsertFriendInterest(db, { friendId: fid, categorySlug: "hobbies", normalizedValue: v, source: "seed" });
    for (const v of f.travel)
      upsertFriendInterest(db, { friendId: fid, categorySlug: "travel_interests", normalizedValue: v, source: "seed" });
    for (const v of f.lifestyle)
      upsertFriendInterest(db, { friendId: fid, categorySlug: "lifestyle", normalizedValue: v, source: "seed" });
    for (const v of f.other)
      upsertFriendInterest(db, { friendId: fid, categorySlug: "other_interests", normalizedValue: v, source: "seed" });

    const dietaryLabels = extractDietaryLabelsFromFriendFields({
      religion: f.religion,
      canEat: f.can_eat,
      cannotEat: f.cannot_eat,
      personalNotes: f.personal_notes,
      allergyValues: f.allergies || [],
    });
    for (const label of dietaryLabels) {
      upsertFriendDietaryRestriction(db, {
        friendId: fid,
        label,
        source: "seed",
      });
    }
  }

  // Seed sample Text Input + Extracted Data traceability
  const sampleText =
    "เพื่อนเราชื่อ อลิส ชอบกินหมูกระทะกับชาบู ไม่ชอบอาหารทะเล ชอบเที่ยวทะเลและถ่ายรูป ส่วน บ็อบ ชอบกาแฟ ชอบไปคาเฟ่ และชอบเดินทาง";
  const textRes = db
    .prepare(
      "INSERT INTO text_inputs (user_id, raw_text, source_label, extraction_mode) VALUES (?, ?, ?, ?)"
    )
    .run(userId, sampleText, "แชทกลุ่ม & โน้ตส่วนตัว", "rule_based_fallback");
  const textInputId = Number(textRes.lastInsertRowid);

  const extractedRows: Array<[string, CategorySlug, string, string]> = [
    ["อลิส", "food_preferences", "หมูกระทะ", "หมูกระทะ"],
    ["อลิส", "food_preferences", "ชาบู", "ชาบู"],
    ["อลิส", "disliked_food", "อาหารทะเล", "อาหารทะเล"],
    ["อลิส", "travel_interests", "เที่ยวทะเล", "ทะเล"],
    ["อลิส", "hobbies", "ถ่ายรูป", "ถ่ายรูป"],
    ["บ็อบ", "food_preferences", "กาแฟ", "กาแฟ"],
    ["บ็อบ", "travel_interests", "ไปคาเฟ่", "คาเฟ่"],
    ["บ็อบ", "travel_interests", "เดินทาง", "ท่องเที่ยว"],
  ];

  const insertExtracted = db.prepare(`
    INSERT INTO extracted_data (text_input_id, friend_id, detected_friend_name, category_slug, raw_value, normalized_value, confirmation_status)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
  `);
  for (const [nick, cat, rawVal, normVal] of extractedRows) {
    const fid = friendIdsByNick.get(nick) ?? null;
    insertExtracted.run(textInputId, fid, nick, cat, rawVal, normVal);
  }

  // Seed 6 realistic activities with RSVPs
  const insertActivity = db.prepare(`
    INSERT INTO activities (user_id, title, description, category, activity_date, start_time, end_time, location, target_interests_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInvite = db.prepare(`
    INSERT INTO activity_invitations (activity_id, friend_id, rsvp_status, decline_reason, response_note, invite_token, responded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const activitiesSeed = [
    {
      title: "หมูกระทะวันศุกร์",
      description: "นัดหมายรับประทานหมูกระทะร่วมกันหลังเลิกงานสำหรับกลุ่มเพื่อนที่ชื่นชอบปิ้งย่าง",
      category: "อาหารและสังสรรค์",
      activity_date: "2026-11-20",
      start_time: "18:30",
      end_time: "21:30",
      location: "ร้านเจ้าเนื้อทอง หมูกระทะ ย่านอารีย์",
      tags: ["หมูกระทะ"],
      invites: [
        ["อลิส", "going", null, "ยืนยันเข้าร่วม สามารถสำรองโต๊ะได้เลย"],
        ["บ็อบ", "going", null, "รับทราบ เจอกันเวลา 18:30 น."],
        ["มิ้นท์", "going", null, "ยินดีเข้าร่วมค่ะ"],
        ["เจมส์", "not_going", "ติดธุระ", "ติดงานครอบครัววันศุกร์นี้"],
        ["เต้", "going", null, "สามารถขับรถไปรับได้"],
        ["กันต์", "going", null, "ตกลงเข้าร่วม"],
        ["โอม", "pending", null, null],
        ["พีท", "pending", null, null],
        ["มาร์ค", "not_going", "ไม่ว่าง", "มีนัดลูกค้าช่วงเย็น"],
      ] as Array<[string, string, string | null, string | null]>,
    },
    {
      title: "Café Hopping ย่านอารีย์",
      description: "นัดหมายเยี่ยมชมร้านกาแฟ ถ่ายภาพ และรับประทานเบเกอรี 2 แห่งในย่านอารีย์",
      category: "คาเฟ่และไลฟ์สไตล์",
      activity_date: "2026-11-22",
      start_time: "13:00",
      end_time: "16:30",
      location: "Ari Soi 1 - 4 จุดนัดพบ BTS อารีย์ ทางออก 3",
      tags: ["คาเฟ่", "กาแฟ", "ถ่ายรูป"],
      invites: [
        ["บ็อบ", "going", null, "สนใจทดลองร้านเปิดใหม่พอดี"],
        ["พลอย", "going", null, "เตรียมกล้องฟิล์มไปด้วย"],
        ["ข้าวฟ่าง", "going", null, "เข้าร่วมได้ค่ะ อยากชิมเมนูเบเกอรี"],
        ["แบม", "going", null, "พบกันที่สถานี BTS อารีย์"],
        ["ปอนด์", "pending", null, null],
        ["อิง", "not_going", "ไม่สะดวกเดินทาง", "วันอาทิตย์อยู่ต่างจังหวัด"],
        ["เมย์", "going", null, "รับทราบค่ะ"],
      ] as Array<[string, string, string | null, string | null]>,
    },
    {
      title: "ทริปทะเลบางแสน 1 วัน",
      description: "เดินทางท่องเที่ยวชายทะเล พักผ่อนริมหาด ถ่ายภาพ และแวะคาเฟ่ริมทะเล",
      category: "ท่องเที่ยว",
      activity_date: "2026-11-28",
      start_time: "08:30",
      end_time: "19:30",
      location: "หาดวอนนภา - บางแสน จ.ชลบุรี",
      tags: ["ทะเล", "ถ่ายรูป"],
      invites: [
        ["อลิส", "going", null, "สะดวกเข้าร่วม ขอร้านที่มีตัวเลือกอาหารที่ไม่ใช่อาหารทะเล"],
        ["มิ้นท์", "pending", null, null],
        ["พลอย", "going", null, "สนใจไปถ่ายภาพทิวทัศน์ริมทะเล"],
        ["กันต์", "going", null, "สามารถร่วมหารค่าน้ำมันได้"],
        ["ฟ้า", "going", null, "ยินดีร่วมเดินทาง"],
        ["ซัน", "not_going", "ติดธุระ", "มีตารางซ้อมวิ่งช่วงเช้า"],
      ] as Array<[string, string, string | null, string | null]>,
    },
    {
      title: "Board Game Day คลายเครียด",
      description: "นัดหมายเล่นบอร์ดเกม Avalon, Splendor, Catan พร้อมสั่งพิซซ่าร่วมกัน",
      category: "งานอดิเรกและเกม",
      activity_date: "2026-11-29",
      start_time: "14:00",
      end_time: "19:00",
      location: "Board Game Cafe สยามสแควร์",
      tags: ["บอร์ดเกม", "พิซซ่า"],
      invites: [
        ["เจมส์", "going", null, "จะนำภาคเสริมของเกมไปด้วย"],
        ["บ็อบ", "going", null, "เข้าร่วมเล่นด้วย"],
        ["พีท", "going", null, "สนใจเล่นเกม Catan"],
        ["ปอนด์", "pending", null, null],
        ["แพร", "going", null, "สามารถช่วยสำรองห้องส่วนตัวให้ได้"],
        ["นนท์", "not_going", "ไม่ว่าง", "ติดทริปแคมป์ปิ้งช่วงวันหยุด"],
      ] as Array<[string, string, string | null, string | null]>,
    },
    {
      title: "Movie Night ดูหนังด้วยกัน",
      description: "นัดชมภาพยนตร์รอบค่ำและรับประทานชาบูร่วมกันหลังจบภาพยนตร์",
      category: "ภาพยนตร์และบันเทิง",
      activity_date: "2026-12-05",
      start_time: "17:30",
      end_time: "21:00",
      location: "SF World Cinema เซ็นทรัลเวิลด์",
      tags: ["ดูหนัง", "ชาบู"],
      invites: [
        ["อลิส", "going", null, "ยินดีเข้าร่วมชมด้วย"],
        ["น้ำ", "going", null, "แนะนำให้เลือกที่นั่งแถวกลาง"],
        ["เจน", "pending", null, null],
        ["แบม", "going", null, "เข้าร่วมด้วยค่ะ"],
        ["บอส", "not_going", "ไม่สนใจกิจกรรมนี้", "รับชมภาพยนตร์เรื่องนี้เรียบร้อยแล้ว"],
      ] as Array<[string, string, string | null, string | null]>,
    },
    {
      title: "ปิกนิกชิล ๆ สวนลุมพินี",
      description: "นัดพักผ่อน วาดภาพ อ่านหนังสือ และรับประทานของว่างยามเย็นในสวนสาธารณะ",
      category: "คาเฟ่และไลฟ์สไตล์",
      activity_date: "2026-12-12",
      start_time: "16:00",
      end_time: "18:30",
      location: "สวนลุมพินี บริเวณลานตะวันยิ้ม",
      tags: ["ปิกนิก", "ของหวาน"],
      invites: [
        ["ข้าวฟ่าง", "going", null, "จะเตรียมคุกกี้ไปแบ่งให้ทุกคน"],
        ["อิง", "going", null, "จะนำเสื่อปิกนิกไปเผื่อด้วยค่ะ"],
        ["น้ำ", "pending", null, null],
        ["แพร", "going", null, "ยืนยันเข้าร่วมค่ะ"],
      ] as Array<[string, string, string | null, string | null]>,
    },
  ];

  activitiesSeed.forEach((act, idx) => {
    const actRes = insertActivity.run(
      userId,
      act.title,
      act.description,
      act.category,
      act.activity_date,
      act.start_time,
      act.end_time,
      act.location,
      JSON.stringify(act.tags),
      "upcoming"
    );
    const actId = Number(actRes.lastInsertRowid);

    act.invites.forEach(([nick, status, reason, note], jdx) => {
      const fid = friendIdsByNick.get(nick);
      if (!fid) return;
      const token = `demo-rsvp-${userId}-${idx + 1}-${jdx + 1}`;
      const respondedAt = status === "pending" ? null : "2026-11-12 19:30:00";
      insertInvite.run(actId, fid, status, reason, note, token, respondedAt);
    });
  });

  // Seed 2 registration / preference-update links
  const aliceId = friendIdsByNick.get("อลิส") ?? null;
  db.prepare(`
    INSERT INTO registration_invitations (user_id, invite_token, label, target_friend_name, prefill_friend_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    `demo-join-new-${userId}`,
    "ลิงก์ชวนเพื่อนใหม่เข้ากลุ่ม CHUAN-DI",
    null,
    null,
    "active"
  );
  db.prepare(`
    INSERT INTO registration_invitations (user_id, invite_token, label, target_friend_name, prefill_friend_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    `demo-update-alice-${userId}`,
    "ลิงก์ให้อลิสอัปเดตความชอบด้วยตัวเอง",
    "อลิส",
    aliceId,
    "active"
  );

  // Seed default saved segments for demo exploration
  const insertSegment = db.prepare(`
    INSERT INTO saved_segments (
      user_id, name, description, include_interests_json, exclude_interests_json, category_filter, match_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSegment.run(
    userId,
    "กลุ่มเพื่อนหมูกระทะ",
    "เพื่อนที่ชื่นชอบหมูกระทะ เหมาะสำหรับนัดหมายสังสรรค์วันศุกร์",
    JSON.stringify(["หมูกระทะ"]),
    JSON.stringify([]),
    "",
    "all"
  );
  insertSegment.run(
    userId,
    "กลุ่มหมูกระทะ · ยกเว้นอาหารทะเล",
    "คัดเฉพาะผู้ที่ชื่นชอบหมูกระทะและหลีกเลี่ยงอาหารทะเล",
    JSON.stringify(["หมูกระทะ"]),
    JSON.stringify(["อาหารทะเล"]),
    "",
    "all"
  );
  insertSegment.run(
    userId,
    "กลุ่มคาเฟ่และถ่ายรูป",
    "กลุ่มเพื่อนที่ชื่นชอบคาเฟ่ กาแฟ หรือการถ่ายภาพ",
    JSON.stringify(["คาเฟ่", "ถ่ายรูป"]),
    JSON.stringify([]),
    "",
    "any"
  );
  insertSegment.run(
    userId,
    "กลุ่มท่องเที่ยวทะเล",
    "เพื่อนที่สนใจการเดินทางท่องเที่ยวทะเลและชายหาด",
    JSON.stringify(["ทะเล"]),
    JSON.stringify([]),
    "",
    "all"
  );

  // Restore simulated shared friend calendars whenever demo friends are seeded or reset
  seedDemoFriendCalendarSchedules(db, userId);
}
