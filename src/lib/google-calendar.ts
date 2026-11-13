import crypto from "node:crypto";
import { getDb } from "./db";
import { addDaysBangkok, getBangkokToday } from "./calendar";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export const GCAL_PKCE_COOKIE = "chuan_di_gcal_oauth";
export const GCAL_SYNC_DAYS_AHEAD = 31;
export const GCAL_STALE_REFRESH_MINUTES = 10;

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export class GoogleCalendarError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "GCAL_ERROR") {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
    this.code = code;
  }
}

export function getGoogleOAuthEndpoints() {
  return {
    authUrl: process.env.GOOGLE_OAUTH_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: process.env.GOOGLE_OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token",
    revokeUrl: process.env.GOOGLE_OAUTH_REVOKE_URL || "https://oauth2.googleapis.com/revoke",
    calendarApiBase: (process.env.GOOGLE_CALENDAR_API_BASE || "https://www.googleapis.com/calendar/v3").replace(/\/+$/, ""),
  };
}

export function getGoogleOAuthConfig(requestOrigin?: string) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const envRedirect = (process.env.GOOGLE_REDIRECT_URI || "").trim();
  const baseOrigin = (requestOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const redirectUri = envRedirect || `${baseOrigin}/api/google-calendar/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const cfg = getGoogleOAuthConfig();
  return cfg.configured;
}

function getTokenEncryptionKey(): Buffer {
  const configuredKey = (process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "").trim();
  if (configuredKey) {
    if (/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
      return Buffer.from(configuredKey, "hex");
    }
    try {
      const b64 = Buffer.from(configuredKey, "base64");
      if (b64.length === 32) return b64;
    } catch {
      // fall through to sha256 derivation
    }
    return crypto.createHash("sha256").update(configuredKey).digest();
  }
  const fallbackSecret = process.env.JWT_SECRET || "chuan-di-dev-secret-2026";
  return crypto.createHash("sha256").update(`${fallbackSecret}::google-calendar-aes-256-gcm`).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new GoogleCalendarError("รูปแบบ Token ที่เข้ารหัสไม่ถูกต้อง", 500, "INVALID_CIPHER");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getTokenEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function getStateHmacSecret(): string {
  return `${process.env.JWT_SECRET || "chuan-di-dev-secret-2026"}::gcal-oauth-state`;
}

export function signOAuthBindingCookie(state: string, userId: number): string {
  const sig = crypto
    .createHmac("sha256", getStateHmacSecret())
    .update(`${state}:${userId}`)
    .digest("base64url");
  return `${state}.${userId}.${sig}`;
}

export function verifyOAuthBindingCookie(
  cookieValue: string | undefined,
  expectedState: string,
  expectedUserId: number
): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [cookieState, cookieUserIdStr, cookieSig] = parts;
  if (cookieState !== expectedState || Number(cookieUserIdStr) !== expectedUserId) {
    return false;
  }
  const expectedSig = crypto
    .createHmac("sha256", getStateHmacSecret())
    .update(`${expectedState}:${expectedUserId}`)
    .digest("base64url");
  const a = Buffer.from(cookieSig);
  const b = Buffer.from(expectedSig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generatePkcePair() {
  const state = crypto.randomBytes(24).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function sanitizeRedirectPath(input?: string | null): string {
  const trimmed = (input || "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/settings";
  }
  return trimmed;
}

export function buildGoogleAuthUrl(params: {
  state: string;
  codeChallenge: string;
  requestOrigin?: string;
  loginHint?: string;
}): string {
  const cfg = getGoogleOAuthConfig(params.requestOrigin);
  if (!cfg.configured) {
    throw new GoogleCalendarError(
      "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET บนเซิร์ฟเวอร์",
      503,
      "OAUTH_NOT_CONFIGURED"
    );
  }
  const { authUrl } = getGoogleOAuthEndpoints();
  const url = new URL(authUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) {
    url.searchParams.set("login_hint", params.loginHint);
  }
  return url.toString();
}

export function createOAuthStateAndUrl(params: {
  userId: number;
  redirectPath?: string;
  requestOrigin?: string;
  loginHint?: string;
}) {
  const cfg = getGoogleOAuthConfig(params.requestOrigin);
  if (!cfg.configured) {
    throw new GoogleCalendarError(
      "ยังไม่ได้ตั้งค่า Google OAuth Credentials กรุณาดูคู่มือใน docs/GOOGLE_CALENDAR_SETUP.md",
      503,
      "OAUTH_NOT_CONFIGURED"
    );
  }

  const db = getDb();
  const nowIso = new Date().toISOString();
  db.prepare("DELETE FROM google_oauth_states WHERE expires_at <= ?").run(nowIso);

  const { state, codeVerifier, codeChallenge } = generatePkcePair();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const redirectPath = sanitizeRedirectPath(params.redirectPath);

  db.prepare(`
    INSERT INTO google_oauth_states (state, user_id, code_verifier, redirect_path, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(state, params.userId, codeVerifier, redirectPath, expiresAt);

  const authUrl = buildGoogleAuthUrl({
    state,
    codeChallenge,
    requestOrigin: params.requestOrigin,
    loginHint: params.loginHint,
  });

  return {
    state,
    authUrl,
    redirectPath,
    cookieValue: signOAuthBindingCookie(state, params.userId),
  };
}

export function consumeOAuthState(params: { state: string; userId: number }) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT state, user_id, code_verifier, redirect_path, expires_at FROM google_oauth_states WHERE state = ?"
    )
    .get(params.state) as
    | {
        state: string;
        user_id: number;
        code_verifier: string;
        redirect_path: string;
        expires_at: string;
      }
    | undefined;

  if (!row) {
    throw new GoogleCalendarError(
      "รหัสยืนยัน OAuth (state) ไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาเริ่มเชื่อมต่อใหม่",
      400,
      "INVALID_STATE"
    );
  }

  // Delete immediately so every state is strictly single-use
  db.prepare("DELETE FROM google_oauth_states WHERE state = ?").run(params.state);

  if (row.user_id !== params.userId) {
    throw new GoogleCalendarError(
      "บัญชีผู้ใช้งานที่ตอบกลับไม่ตรงกับผู้เริ่มคำขอเชื่อมต่อ",
      403,
      "STATE_USER_MISMATCH"
    );
  }

  const expiresMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    throw new GoogleCalendarError(
      "คำขอเชื่อมต่อ Google Calendar หมดอายุแล้ว กรุณาลองใหม่อีกครั้ง",
      400,
      "EXPIRED_STATE"
    );
  }

  return {
    codeVerifier: row.code_verifier,
    redirectPath: sanitizeRedirectPath(row.redirect_path),
  };
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export interface GoogleCalendarSourceItem {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  backgroundColor: string | null;
  timeZone: string | null;
}

export interface BangkokBusyDayBlock {
  calendarId: string;
  startUtc: string;
  endUtc: string;
  bangkokDate: string;
  startTime: string;
  endTime: string;
}

async function parseGoogleJsonError(res: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      error?: string | { message?: string };
    };
    if (body.error_description) return body.error_description;
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error === "object" && body.error.message) {
      return body.error.message;
    }
  } catch {
    // ignore non-json body
  }
  return fallbackMessage;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  requestOrigin?: string;
  fetchFn?: typeof fetch;
}): Promise<GoogleTokenResponse> {
  const cfg = getGoogleOAuthConfig(params.requestOrigin);
  if (!cfg.configured) {
    throw new GoogleCalendarError("ยังไม่ได้ตั้งค่า Google OAuth Credentials", 503, "OAUTH_NOT_CONFIGURED");
  }
  const { tokenUrl } = getGoogleOAuthEndpoints();
  const fetcher = params.fetchFn || fetch;

  const form = new URLSearchParams({
    code: params.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
  });

  const res = await fetcher(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await parseGoogleJsonError(res, "แลกเปลี่ยน Google OAuth Token ไม่สำเร็จ");
    throw new GoogleCalendarError(detail, 502, "TOKEN_EXCHANGE_FAILED");
  }

  const data = (await res.json()) as Partial<GoogleTokenResponse>;
  if (!data.access_token) {
    throw new GoogleCalendarError("Google ไม่ได้ส่ง access_token กลับมา", 502, "MISSING_ACCESS_TOKEN");
  }

  return {
    access_token: data.access_token,
    expires_in: Number(data.expires_in) || 3600,
    refresh_token: data.refresh_token,
    scope: data.scope || GOOGLE_CALENDAR_SCOPES.join(" "),
    token_type: data.token_type || "Bearer",
  };
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  fetchFn: typeof fetch = fetch,
  requestOrigin?: string
): Promise<GoogleTokenResponse> {
  const cfg = getGoogleOAuthConfig(requestOrigin);
  if (!cfg.configured) {
    throw new GoogleCalendarError("ยังไม่ได้ตั้งค่า Google OAuth Credentials", 503, "OAUTH_NOT_CONFIGURED");
  }
  const { tokenUrl } = getGoogleOAuthEndpoints();
  const form = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchFn(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await parseGoogleJsonError(res, "ไม่สามารถต่ออายุสิทธิ์ Google Calendar ได้");
    throw new GoogleCalendarError(detail, 401, "TOKEN_REFRESH_FAILED");
  }

  const data = (await res.json()) as Partial<GoogleTokenResponse>;
  if (!data.access_token) {
    throw new GoogleCalendarError("Google ไม่ได้ส่ง access_token ใหม่กลับมา", 502, "MISSING_ACCESS_TOKEN");
  }

  return {
    access_token: data.access_token,
    expires_in: Number(data.expires_in) || 3600,
    refresh_token: data.refresh_token,
    scope: data.scope,
    token_type: data.token_type || "Bearer",
  };
}

export async function revokeGoogleToken(
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  if (!token) return false;
  const { revokeUrl } = getGoogleOAuthEndpoints();
  try {
    const form = new URLSearchParams({ token });
    const res = await fetchFn(revokeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchGoogleCalendarList(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<GoogleCalendarSourceItem[]> {
  const { calendarApiBase } = getGoogleOAuthEndpoints();
  const url = `${calendarApiBase}/users/me/calendarList?minAccessRole=freeBusyReader&showHidden=false`;

  const res = await fetchFn(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await parseGoogleJsonError(res, "ไม่สามารถดึงรายการปฏิทินจาก Google Calendar ได้");
    throw new GoogleCalendarError(detail, res.status === 401 ? 401 : 502, "CALENDAR_LIST_FAILED");
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      summaryOverride?: string;
      primary?: boolean;
      accessRole?: string;
      backgroundColor?: string;
      timeZone?: string;
    }>;
  };

  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((item): item is typeof item & { id: string } => typeof item.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      summary: (item.summaryOverride || item.summary || item.id).trim(),
      primary: Boolean(item.primary),
      accessRole: item.accessRole || "reader",
      backgroundColor: item.backgroundColor || null,
      timeZone: item.timeZone || null,
    }));
}

export async function fetchGoogleFreeBusy(params: {
  accessToken: string;
  calendarIds: string[];
  timeMin: string;
  timeMax: string;
  timeZone?: string;
  fetchFn?: typeof fetch;
}): Promise<{
  calendars: Record<string, Array<{ start: string; end: string }>>;
  errors: Array<{ calendarId: string; reason: string }>;
}> {
  if (params.calendarIds.length === 0) {
    return { calendars: {}, errors: [] };
  }

  const { calendarApiBase } = getGoogleOAuthEndpoints();
  const fetcher = params.fetchFn || fetch;
  const res = await fetcher(`${calendarApiBase}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      timeZone: params.timeZone || "Asia/Bangkok",
      items: params.calendarIds.map((id) => ({ id })),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await parseGoogleJsonError(res, "ไม่สามารถดึงข้อมูล Free/Busy จาก Google Calendar ได้");
    throw new GoogleCalendarError(detail, res.status === 401 ? 401 : 502, "FREEBUSY_FAILED");
  }

  const data = (await res.json()) as {
    calendars?: Record<
      string,
      {
        busy?: Array<{ start?: string; end?: string }>;
        errors?: Array<{ reason?: string }>;
      }
    >;
  };

  const calendars: Record<string, Array<{ start: string; end: string }>> = {};
  const errors: Array<{ calendarId: string; reason: string }> = [];

  for (const calId of params.calendarIds) {
    const entry = data.calendars?.[calId];
    if (entry?.errors && entry.errors.length > 0) {
      errors.push({
        calendarId: calId,
        reason: entry.errors.map((e) => e.reason || "unknown").join(", "),
      });
    }
    const busyList = Array.isArray(entry?.busy) ? entry.busy : [];
    calendars[calId] = busyList
      .filter(
        (b): b is { start: string; end: string } =>
          typeof b.start === "string" && typeof b.end === "string"
      )
      .map((b) => ({ start: b.start, end: b.end }));
  }

  return { calendars, errors };
}

function formatMinuteOfDay(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(mins)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function bangkokDayStartUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - BANGKOK_OFFSET_MS;
}

/**
 * Splits a UTC/ISO busy interval cleanly across Asia/Bangkok (UTC+07:00) calendar days
 * within [windowStartDate, windowEndDate]. Only busy intervals are stored — never event titles.
 */
export function splitIsoIntervalToBangkokDays(params: {
  calendarId: string;
  startIso: string;
  endIso: string;
  windowStartDate: string;
  windowEndDate: string;
}): BangkokBusyDayBlock[] {
  const startMs = Date.parse(params.startIso);
  const endMs = Date.parse(params.endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const minWindowMs = bangkokDayStartUtcMs(params.windowStartDate);
  const maxWindowMs = bangkokDayStartUtcMs(addDaysBangkok(params.windowEndDate, 1));
  const clampedStart = Math.max(startMs, minWindowMs);
  const clampedEnd = Math.min(endMs, maxWindowMs);
  if (clampedEnd <= clampedStart) return [];

  const blocks: BangkokBusyDayBlock[] = [];
  let cursorDate = params.windowStartDate;
  while (cursorDate <= params.windowEndDate) {
    const dayStartMs = bangkokDayStartUtcMs(cursorDate);
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const segStart = Math.max(clampedStart, dayStartMs);
    const segEnd = Math.min(clampedEnd, dayEndMs);

    if (segEnd > segStart) {
      const startMin = Math.floor((segStart - dayStartMs) / 60000);
      const endMin = Math.ceil((segEnd - dayStartMs) / 60000);
      if (endMin > startMin) {
        blocks.push({
          calendarId: params.calendarId,
          startUtc: params.startIso,
          endUtc: params.endIso,
          bangkokDate: cursorDate,
          startTime: formatMinuteOfDay(startMin),
          endTime: formatMinuteOfDay(endMin),
        });
      }
    }

    cursorDate = addDaysBangkok(cursorDate, 1);
  }

  return blocks;
}

function deriveGoogleEmailFromCalendars(calendars: GoogleCalendarSourceItem[]): string | null {
  const primary = calendars.find((c) => c.primary);
  if (primary?.id && primary.id.includes("@")) return primary.id;
  if (primary?.summary && primary.summary.includes("@")) return primary.summary;
  const emailCal = calendars.find((c) => c.id.includes("@") && !c.id.endsWith("group.calendar.google.com"));
  return emailCal?.id || primary?.summary || null;
}

function upsertCalendarSourcesForUser(userId: number, calendars: GoogleCalendarSourceItem[]) {
  const db = getDb();
  const existingRows = db
    .prepare("SELECT calendar_id, is_selected FROM google_calendar_sources WHERE user_id = ?")
    .all(userId) as Array<{ calendar_id: string; is_selected: number }>;
  const existingMap = new Map(existingRows.map((r) => [r.calendar_id, r.is_selected === 1]));
  const hasAnyExisting = existingRows.length > 0;

  const upsert = db.prepare(`
    INSERT INTO google_calendar_sources (
      user_id, calendar_id, summary, is_primary, access_role, background_color, time_zone, is_selected, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(user_id, calendar_id) DO UPDATE SET
      summary = excluded.summary,
      is_primary = excluded.is_primary,
      access_role = excluded.access_role,
      background_color = excluded.background_color,
      time_zone = excluded.time_zone,
      is_selected = excluded.is_selected,
      updated_at = datetime('now', 'localtime')
  `);

  const seenIds = new Set<string>();
  const primaryOrFirstId = calendars.find((c) => c.primary)?.id || calendars[0]?.id;

  for (const cal of calendars) {
    seenIds.add(cal.id);
    const shouldSelect = hasAnyExisting
      ? existingMap.get(cal.id) ?? false
      : cal.id === primaryOrFirstId;

    upsert.run(
      userId,
      cal.id,
      cal.summary,
      cal.primary ? 1 : 0,
      cal.accessRole,
      cal.backgroundColor,
      cal.timeZone,
      shouldSelect ? 1 : 0
    );
  }

  for (const oldRow of existingRows) {
    if (!seenIds.has(oldRow.calendar_id)) {
      db.prepare("DELETE FROM google_calendar_sources WHERE user_id = ? AND calendar_id = ?").run(
        userId,
        oldRow.calendar_id
      );
    }
  }
}

async function getValidAccessTokenForUser(
  userId: number,
  fetchFn: typeof fetch = fetch,
  requestOrigin?: string,
  forceRefresh = false
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const db = getDb();
  const conn = db
    .prepare(
      `SELECT user_id, access_token_enc, refresh_token_enc, token_expires_at
       FROM google_calendar_connections WHERE user_id = ?`
    )
    .get(userId) as
    | {
        user_id: number;
        access_token_enc: string;
        refresh_token_enc: string | null;
        token_expires_at: string;
      }
    | undefined;

  if (!conn) {
    throw new GoogleCalendarError("ยังไม่ได้เชื่อมต่อ Google Calendar", 400, "NOT_CONNECTED");
  }

  const accessToken = decryptSecret(conn.access_token_enc);
  const refreshToken = conn.refresh_token_enc ? decryptSecret(conn.refresh_token_enc) : null;
  const expiresAtMs = Date.parse(conn.token_expires_at);
  const needsRefresh = forceRefresh || !Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() < 60_000;

  if (!needsRefresh) {
    return { accessToken, refreshToken };
  }

  if (!refreshToken) {
    if (!forceRefresh && Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
      return { accessToken, refreshToken: null };
    }
    const msg = "สิทธิ์เชื่อมต่อ Google Calendar หมดอายุ กรุณาเชื่อมต่อใหม่อีกครั้ง";
    db.prepare(
      "UPDATE google_calendar_connections SET sync_status = 'error', sync_error = ?, updated_at = datetime('now', 'localtime') WHERE user_id = ?"
    ).run(msg, userId);
    throw new GoogleCalendarError(msg, 401, "TOKEN_EXPIRED");
  }

  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken, fetchFn, requestOrigin);
    const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const nextRefreshEnc = refreshed.refresh_token
      ? encryptSecret(refreshed.refresh_token)
      : conn.refresh_token_enc;

    db.prepare(`
      UPDATE google_calendar_connections
      SET access_token_enc = ?,
          refresh_token_enc = ?,
          token_expires_at = ?,
          sync_status = 'connected',
          sync_error = NULL,
          updated_at = datetime('now', 'localtime')
      WHERE user_id = ?
    `).run(encryptSecret(refreshed.access_token), nextRefreshEnc, nextExpiresAt, userId);

    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || refreshToken,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ไม่สามารถต่ออายุสิทธิ์ Google Calendar ได้";
    db.prepare(
      "UPDATE google_calendar_connections SET sync_status = 'error', sync_error = ?, updated_at = datetime('now', 'localtime') WHERE user_id = ?"
    ).run(msg, userId);
    throw err;
  }
}

export async function completeGoogleOAuthCallback(params: {
  userId: number;
  code: string;
  state: string;
  requestOrigin?: string;
  fetchFn?: typeof fetch;
}) {
  const fetcher = params.fetchFn || fetch;
  const { redirectPath, codeVerifier } = consumeOAuthState({
    state: params.state,
    userId: params.userId,
  });

  const tokens = await exchangeCodeForTokens({
    code: params.code,
    codeVerifier,
    requestOrigin: params.requestOrigin,
    fetchFn: fetcher,
  });

  const calendars = await fetchGoogleCalendarList(tokens.access_token, fetcher);
  const googleEmail = deriveGoogleEmailFromCalendars(calendars);

  const db = getDb();
  const existing = db
    .prepare("SELECT refresh_token_enc FROM google_calendar_connections WHERE user_id = ?")
    .get(params.userId) as { refresh_token_enc: string | null } | undefined;

  const refreshEnc = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existing?.refresh_token_enc || null;

  const expiresAtIso = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO google_calendar_connections (
        user_id, google_email, scope, access_token_enc, refresh_token_enc,
        token_expires_at, sync_status, sync_error, connected_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'connected', NULL, datetime('now', 'localtime'), datetime('now', 'localtime'))
      ON CONFLICT(user_id) DO UPDATE SET
        google_email = COALESCE(excluded.google_email, google_calendar_connections.google_email),
        scope = excluded.scope,
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = COALESCE(excluded.refresh_token_enc, google_calendar_connections.refresh_token_enc),
        token_expires_at = excluded.token_expires_at,
        sync_status = 'connected',
        sync_error = NULL,
        updated_at = datetime('now', 'localtime')
    `).run(
      params.userId,
      googleEmail,
      tokens.scope || GOOGLE_CALENDAR_SCOPES.join(" "),
      encryptSecret(tokens.access_token),
      refreshEnc,
      expiresAtIso
    );

    upsertCalendarSourcesForUser(params.userId, calendars);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  let syncWarning: string | null = null;
  try {
    await syncUserGoogleCalendar({
      userId: params.userId,
      fetchFn: fetcher,
      requestOrigin: params.requestOrigin,
      refreshCalendarList: false,
    });
  } catch (err) {
    syncWarning = err instanceof Error ? err.message : "ซิงก์ Free/Busy เบื้องต้นไม่สำเร็จ";
  }

  return {
    redirectPath,
    googleEmail,
    calendarsCount: calendars.length,
    syncWarning,
  };
}

export async function syncUserGoogleCalendar(params: {
  userId: number;
  fetchFn?: typeof fetch;
  requestOrigin?: string;
  daysAhead?: number;
  refreshCalendarList?: boolean;
}) {
  const fetcher = params.fetchFn || fetch;
  const db = getDb();
  const daysAhead = params.daysAhead ?? GCAL_SYNC_DAYS_AHEAD;

  let { accessToken } = await getValidAccessTokenForUser(params.userId, fetcher, params.requestOrigin);

  if (params.refreshCalendarList !== false) {
    let calendars: GoogleCalendarSourceItem[];
    try {
      calendars = await fetchGoogleCalendarList(accessToken, fetcher);
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.status === 401) {
        const refreshed = await getValidAccessTokenForUser(
          params.userId,
          fetcher,
          params.requestOrigin,
          true
        );
        accessToken = refreshed.accessToken;
        calendars = await fetchGoogleCalendarList(accessToken, fetcher);
      } else {
        throw err;
      }
    }

    const email = deriveGoogleEmailFromCalendars(calendars);
    db.exec("BEGIN");
    try {
      upsertCalendarSourcesForUser(params.userId, calendars);
      if (email) {
        db.prepare(
          "UPDATE google_calendar_connections SET google_email = COALESCE(?, google_email) WHERE user_id = ?"
        ).run(email, params.userId);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  const selectedSources = db
    .prepare(
      "SELECT calendar_id FROM google_calendar_sources WHERE user_id = ? AND is_selected = 1 ORDER BY is_primary DESC, id ASC"
    )
    .all(params.userId) as Array<{ calendar_id: string }>;

  const selectedIds = selectedSources.map((s) => s.calendar_id);
  const windowStartDate = getBangkokToday();
  const windowEndDate = addDaysBangkok(windowStartDate, daysAhead);

  if (selectedIds.length === 0) {
    const syncedAt = new Date().toISOString();
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM google_freebusy_blocks WHERE user_id = ?").run(params.userId);
      db.prepare(`
        UPDATE google_calendar_connections
        SET sync_status = 'connected',
            sync_error = NULL,
            last_synced_at = ?,
            sync_window_start = ?,
            sync_window_end = ?,
            updated_at = datetime('now', 'localtime')
        WHERE user_id = ?
      `).run(syncedAt, windowStartDate, windowEndDate, params.userId);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return {
      selectedCalendars: 0,
      busyBlocksCount: 0,
      syncWindowStart: windowStartDate,
      syncWindowEnd: windowEndDate,
      lastSyncedAt: syncedAt,
      calendarErrors: [] as Array<{ calendarId: string; reason: string }>,
    };
  }

  const timeMin = `${windowStartDate}T00:00:00+07:00`;
  const timeMax = `${addDaysBangkok(windowEndDate, 1)}T00:00:00+07:00`;

  let freeBusy;
  try {
    freeBusy = await fetchGoogleFreeBusy({
      accessToken,
      calendarIds: selectedIds,
      timeMin,
      timeMax,
      timeZone: "Asia/Bangkok",
      fetchFn: fetcher,
    });
  } catch (err) {
    if (err instanceof GoogleCalendarError && err.status === 401) {
      const refreshed = await getValidAccessTokenForUser(
        params.userId,
        fetcher,
        params.requestOrigin,
        true
      );
      accessToken = refreshed.accessToken;
      freeBusy = await fetchGoogleFreeBusy({
        accessToken,
        calendarIds: selectedIds,
        timeMin,
        timeMax,
        timeZone: "Asia/Bangkok",
        fetchFn: fetcher,
      });
    } else {
      const msg = err instanceof Error ? err.message : "ซิงก์ Free/Busy ไม่สำเร็จ";
      db.prepare(
        "UPDATE google_calendar_connections SET sync_status = 'error', sync_error = ?, updated_at = datetime('now', 'localtime') WHERE user_id = ?"
      ).run(msg, params.userId);
      throw err;
    }
  }

  const dayBlocks: BangkokBusyDayBlock[] = [];
  for (const calId of selectedIds) {
    const busyItems = freeBusy.calendars[calId] || [];
    for (const item of busyItems) {
      const split = splitIsoIntervalToBangkokDays({
        calendarId: calId,
        startIso: item.start,
        endIso: item.end,
        windowStartDate,
        windowEndDate,
      });
      dayBlocks.push(...split);
    }
  }

  const syncedAt = new Date().toISOString();
  const errorSummary =
    freeBusy.errors.length > 0
      ? `บางปฏิทินไม่สามารถอ่าน Free/Busy ได้ (${freeBusy.errors.map((e) => e.reason).join(", ")})`
      : null;

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM google_freebusy_blocks WHERE user_id = ?").run(params.userId);
    const insertBlock = db.prepare(`
      INSERT INTO google_freebusy_blocks (
        user_id, calendar_id, start_utc, end_utc, bangkok_date, start_time, end_time, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const block of dayBlocks) {
      insertBlock.run(
        params.userId,
        block.calendarId,
        block.startUtc,
        block.endUtc,
        block.bangkokDate,
        block.startTime,
        block.endTime,
        syncedAt
      );
    }

    db.prepare(`
      UPDATE google_calendar_connections
      SET sync_status = 'connected',
          sync_error = ?,
          last_synced_at = ?,
          sync_window_start = ?,
          sync_window_end = ?,
          updated_at = datetime('now', 'localtime')
      WHERE user_id = ?
    `).run(errorSummary, syncedAt, windowStartDate, windowEndDate, params.userId);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    selectedCalendars: selectedIds.length,
    busyBlocksCount: dayBlocks.length,
    syncWindowStart: windowStartDate,
    syncWindowEnd: windowEndDate,
    lastSyncedAt: syncedAt,
    calendarErrors: freeBusy.errors,
  };
}

export async function updateSelectedGoogleCalendars(params: {
  userId: number;
  calendarIds: string[];
  fetchFn?: typeof fetch;
  requestOrigin?: string;
}) {
  const db = getDb();
  const conn = db
    .prepare("SELECT user_id FROM google_calendar_connections WHERE user_id = ?")
    .get(params.userId);
  if (!conn) {
    throw new GoogleCalendarError("ยังไม่ได้เชื่อมต่อ Google Calendar", 400, "NOT_CONNECTED");
  }

  const wanted = new Set(params.calendarIds.map((id) => id.trim()).filter(Boolean));
  const userSources = db
    .prepare("SELECT calendar_id FROM google_calendar_sources WHERE user_id = ?")
    .all(params.userId) as Array<{ calendar_id: string }>;

  const updateStmt = db.prepare(
    "UPDATE google_calendar_sources SET is_selected = ?, updated_at = datetime('now', 'localtime') WHERE user_id = ? AND calendar_id = ?"
  );

  db.exec("BEGIN");
  try {
    for (const src of userSources) {
      updateStmt.run(wanted.has(src.calendar_id) ? 1 : 0, params.userId, src.calendar_id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return syncUserGoogleCalendar({
    userId: params.userId,
    fetchFn: params.fetchFn,
    requestOrigin: params.requestOrigin,
    refreshCalendarList: false,
  });
}

export async function disconnectUserGoogleCalendar(params: {
  userId: number;
  fetchFn?: typeof fetch;
}) {
  const db = getDb();
  const fetcher = params.fetchFn || fetch;
  const conn = db
    .prepare("SELECT access_token_enc, refresh_token_enc FROM google_calendar_connections WHERE user_id = ?")
    .get(params.userId) as { access_token_enc: string; refresh_token_enc: string | null } | undefined;

  let revokedWithGoogle = false;
  if (conn) {
    try {
      const tokenToRevoke = conn.refresh_token_enc
        ? decryptSecret(conn.refresh_token_enc)
        : decryptSecret(conn.access_token_enc);
      revokedWithGoogle = await revokeGoogleToken(tokenToRevoke, fetcher);
    } catch {
      revokedWithGoogle = false;
    }
  }

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM google_freebusy_blocks WHERE user_id = ?").run(params.userId);
    db.prepare("DELETE FROM google_calendar_sources WHERE user_id = ?").run(params.userId);
    db.prepare("DELETE FROM google_calendar_connections WHERE user_id = ?").run(params.userId);
    db.prepare("DELETE FROM google_oauth_states WHERE user_id = ?").run(params.userId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    disconnected: true,
    revokedWithGoogle,
  };
}

export interface SharingTargetItem {
  friendId: number;
  ownerUserId: number;
  ownerName: string;
  nicknameWithOwner: string;
  isShared: boolean;
  shareSource: string;
  grantedAt: string | null;
}

export function getSharingTargetsForUser(userId: number): SharingTargetItem[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT
        f.id AS friend_id,
        f.user_id AS owner_user_id,
        u.name AS owner_name,
        f.nickname AS nickname_with_owner,
        COALESCE(p.is_shared, 0) AS is_shared,
        COALESCE(p.share_source, 'none') AS share_source,
        p.granted_at
      FROM friends f
      JOIN users u ON u.id = f.user_id
      LEFT JOIN friend_calendar_permissions p ON p.friend_id = f.id
      WHERE f.linked_user_id = ?
      ORDER BY u.name ASC, f.id ASC
    `)
    .all(userId) as Array<{
    friend_id: number;
    owner_user_id: number;
    owner_name: string;
    nickname_with_owner: string;
    is_shared: number;
    share_source: string;
    granted_at: string | null;
  }>;

  return rows.map((r) => ({
    friendId: r.friend_id,
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name,
    nicknameWithOwner: r.nickname_with_owner,
    isShared: r.is_shared === 1,
    shareSource: r.share_source,
    grantedAt: r.granted_at,
  }));
}

export function updateSharingTargetForUser(params: {
  currentUserId: number;
  friendId: number;
  isShared: boolean;
}) {
  const db = getDb();
  const friendRow = db
    .prepare("SELECT id, user_id, linked_user_id FROM friends WHERE id = ?")
    .get(params.friendId) as { id: number; user_id: number; linked_user_id: number | null } | undefined;

  if (!friendRow) {
    throw new GoogleCalendarError("ไม่พบข้อมูลเพื่อนรายการนี้", 404, "FRIEND_NOT_FOUND");
  }

  if (friendRow.linked_user_id !== params.currentUserId) {
    throw new GoogleCalendarError(
      "คุณไม่มีสิทธิ์แก้ไขการแชร์ปฏิทินของรายการเพื่อนนี้",
      403,
      "FORBIDDEN_SHARING_TARGET"
    );
  }

  const gcalConnected = Boolean(
    db.prepare("SELECT user_id FROM google_calendar_connections WHERE user_id = ?").get(params.currentUserId)
  );

  const shareSource = params.isShared
    ? gcalConnected
      ? "google_calendar"
      : "manual_profile"
    : "revoked";

  db.prepare(`
    INSERT INTO friend_calendar_permissions (friend_id, user_id, is_shared, share_source, granted_at)
    VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END)
    ON CONFLICT(friend_id) DO UPDATE SET
      user_id = excluded.user_id,
      is_shared = excluded.is_shared,
      share_source = excluded.share_source,
      granted_at = CASE WHEN excluded.is_shared = 1 THEN datetime('now', 'localtime') ELSE NULL END
  `).run(friendRow.id, friendRow.user_id, params.isShared ? 1 : 0, shareSource, params.isShared ? 1 : 0);

  return {
    friendId: friendRow.id,
    isShared: params.isShared,
    shareSource,
  };
}

export function getGoogleCalendarPublicStatus(userId: number, requestOrigin?: string) {
  const db = getDb();
  const cfg = getGoogleOAuthConfig(requestOrigin);

  const conn = db
    .prepare(`
      SELECT
        google_email, sync_status, sync_error, last_synced_at,
        sync_window_start, sync_window_end, connected_at
      FROM google_calendar_connections
      WHERE user_id = ?
    `)
    .get(userId) as
    | {
        google_email: string | null;
        sync_status: "connected" | "error";
        sync_error: string | null;
        last_synced_at: string | null;
        sync_window_start: string | null;
        sync_window_end: string | null;
        connected_at: string;
      }
    | undefined;

  const sources = conn
    ? (db
        .prepare(`
          SELECT calendar_id, summary, is_primary, access_role, background_color, time_zone, is_selected
          FROM google_calendar_sources
          WHERE user_id = ?
          ORDER BY is_primary DESC, summary ASC
        `)
        .all(userId) as Array<{
        calendar_id: string;
        summary: string;
        is_primary: number;
        access_role: string;
        background_color: string | null;
        time_zone: string | null;
        is_selected: number;
      }>)
    : [];

  const calendars = sources.map((s) => ({
    calendarId: s.calendar_id,
    summary: s.summary,
    isPrimary: s.is_primary === 1,
    accessRole: s.access_role,
    backgroundColor: s.background_color,
    timeZone: s.time_zone,
    isSelected: s.is_selected === 1,
  }));

  const sharingTargets = getSharingTargetsForUser(userId);

  return {
    configured: cfg.configured,
    connected: Boolean(conn),
    googleEmail: conn?.google_email || null,
    syncStatus: conn ? conn.sync_status : ("disconnected" as const),
    syncError: conn?.sync_error || null,
    lastSyncedAt: conn?.last_synced_at || null,
    syncWindowStart: conn?.sync_window_start || null,
    syncWindowEnd: conn?.sync_window_end || null,
    connectedAt: conn?.connected_at || null,
    selectedCount: calendars.filter((c) => c.isSelected).length,
    calendars,
    sharingTargets,
  };
}

export async function refreshStaleSharedFriendsGoogleCalendars(params: {
  organizerUserId: number;
  friendIds?: number[];
  maxAgeMinutes?: number;
  fetchFn?: typeof fetch;
}) {
  if (!isGoogleOAuthConfigured()) return { refreshedUserIds: [] as number[] };

  const db = getDb();
  const maxAgeMs = (params.maxAgeMinutes ?? GCAL_STALE_REFRESH_MINUTES) * 60_000;
  const candidateUserIds = new Set<number>();

  const selfConn = db
    .prepare("SELECT user_id, last_synced_at FROM google_calendar_connections WHERE user_id = ?")
    .get(params.organizerUserId) as { user_id: number; last_synced_at: string | null } | undefined;

  if (selfConn) {
    const lastMs = selfConn.last_synced_at ? Date.parse(selfConn.last_synced_at) : 0;
    if (!Number.isFinite(lastMs) || Date.now() - lastMs > maxAgeMs) {
      candidateUserIds.add(selfConn.user_id);
    }
  }

  const sharedFriends = db
    .prepare(`
      SELECT DISTINCT f.linked_user_id, gc.last_synced_at
      FROM friends f
      JOIN friend_calendar_permissions p ON p.friend_id = f.id AND p.is_shared = 1
      JOIN google_calendar_connections gc ON gc.user_id = f.linked_user_id
      WHERE f.user_id = ? AND f.linked_user_id IS NOT NULL
    `)
    .all(params.organizerUserId) as Array<{ linked_user_id: number; last_synced_at: string | null }>;

  for (const row of sharedFriends) {
    const lastMs = row.last_synced_at ? Date.parse(row.last_synced_at) : 0;
    if (!Number.isFinite(lastMs) || Date.now() - lastMs > maxAgeMs) {
      candidateUserIds.add(row.linked_user_id);
    }
  }

  const refreshedUserIds: number[] = [];
  for (const uid of Array.from(candidateUserIds)) {
    try {
      await syncUserGoogleCalendar({
        userId: uid,
        fetchFn: params.fetchFn,
        refreshCalendarList: false,
      });
      refreshedUserIds.push(uid);
    } catch {
      // Keep cached blocks on transient error
    }
  }

  return { refreshedUserIds };
}
