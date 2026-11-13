import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const WORKSPACE = process.cwd();
const LIVE_BASE_URL = process.env.CHUAN_DI_BASE_URL || "http://localhost:3000";

function logStep(name) {
  console.log(`\n[PASS/RUN] ${name}`);
}

class CookieClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.cookies = new Map();
  }

  captureSetCookies(res) {
    const raw =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
    for (const entry of raw) {
      const firstPart = String(entry).split(";")[0];
      const eqIdx = firstPart.indexOf("=");
      if (eqIdx <= 0) continue;
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();
      if (!val || /max-age=0/i.test(entry)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
  }

  cookieHeader() {
    if (this.cookies.size === 0) return "";
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async request(urlPath, opts = {}) {
    const headers = new Headers(opts.headers || {});
    const cookieStr = this.cookieHeader();
    if (cookieStr) headers.set("Cookie", cookieStr);
    if (opts.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      method: opts.method || "GET",
      headers,
      body:
        opts.body === undefined
          ? undefined
          : typeof opts.body === "string"
          ? opts.body
          : JSON.stringify(opts.body),
      redirect: opts.redirect || "manual",
    });
    this.captureSetCookies(res);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, headers: res.headers, text, json };
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

function getBangkokDateOffset(offsetDays) {
  const now = new Date();
  const bkkNow = new Date(now.getTime() + 7 * 3600 * 1000);
  const y = bkkNow.getUTCFullYear();
  const m = bkkNow.getUTCMonth();
  const d = bkkNow.getUTCDate() + offsetDays;
  const target = new Date(Date.UTC(y, m, d));
  return target.toISOString().slice(0, 10);
}

function bangkokIso(dateStr, hhmm) {
  return `${dateStr}T${hhmm}:00+07:00`;
}

function assertNoTokenLeak(obj, label) {
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  assert.ok(!s.includes("access_token"), `${label}: must never contain access_token`);
  assert.ok(!s.includes("refresh_token"), `${label}: must never contain refresh_token`);
  assert.ok(!s.includes("stub_access_"), `${label}: must never leak stub Google access token`);
  assert.ok(!s.includes("stub_refresh_"), `${label}: must never leak stub Google refresh token`);
}

function startGoogleStubServer(targetDate) {
  const tokenToAccount = new Map();
  const refreshToAccount = new Map();
  const revokedTokens = [];
  const eventsEndpointCalls = [];
  const expiredAccessTokens = new Set();

  // Per simulated Google user schedules (UTC / +07:00)
  const accountConfigs = new Map([
    [
      "friend1",
      {
        email: "friend1.gcal@gmail.com",
        calendars: [
          {
            id: "friend1.gcal@gmail.com",
            summary: "ปฏิทินส่วนตัว Friend 1",
            primary: true,
            accessRole: "owner",
            backgroundColor: "#4285F4",
            timeZone: "Asia/Bangkok",
          },
          {
            id: "friend1_work@group.calendar.google.com",
            summary: "งานประจำ Friend 1",
            primary: false,
            accessRole: "reader",
            backgroundColor: "#0B8043",
            timeZone: "Asia/Bangkok",
          },
        ],
        busyByCalendar: {
          "friend1.gcal@gmail.com": [
            { start: bangkokIso(targetDate, "12:00"), end: bangkokIso(targetDate, "13:00") },
          ],
          "friend1_work@group.calendar.google.com": [
            { start: bangkokIso(targetDate, "08:00"), end: bangkokIso(targetDate, "12:00") },
          ],
        },
      },
    ],
    [
      "friend2",
      {
        email: "friend2.gcal@gmail.com",
        calendars: [
          {
            id: "friend2.gcal@gmail.com",
            summary: "Friend 2 Calendar",
            primary: true,
            accessRole: "owner",
            backgroundColor: "#8E24AA",
            timeZone: "Asia/Bangkok",
          },
        ],
        busyByCalendar: {
          // 14:00-16:00 Asia/Bangkok expressed in UTC (07:00Z-09:00Z)
          "friend2.gcal@gmail.com": [
            {
              start: new Date(Date.parse(bangkokIso(targetDate, "14:00"))).toISOString(),
              end: new Date(Date.parse(bangkokIso(targetDate, "16:00"))).toISOString(),
            },
          ],
        },
      },
    ],
    [
      "friend3",
      {
        email: "friend3.gcal@gmail.com",
        calendars: [
          {
            id: "friend3.gcal@gmail.com",
            summary: "Friend 3 Calendar",
            primary: true,
            accessRole: "owner",
            backgroundColor: "#E67C73",
            timeZone: "Asia/Bangkok",
          },
        ],
        busyByCalendar: {
          "friend3.gcal@gmail.com": [
            { start: bangkokIso(targetDate, "08:00"), end: bangkokIso(targetDate, "10:00") },
          ],
        },
      },
    ],
    [
      "friend4",
      {
        email: "friend4.gcal@gmail.com",
        calendars: [
          {
            id: "friend4.gcal@gmail.com",
            summary: "Friend 4 Private Calendar",
            primary: true,
            accessRole: "owner",
            backgroundColor: "#33B679",
            timeZone: "Asia/Bangkok",
          },
        ],
        busyByCalendar: {
          "friend4.gcal@gmail.com": [],
        },
      },
    ],
  ]);

  let seq = 0;

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const reqUrl = new URL(req.url || "/", "http://127.0.0.1");

      // Strict privacy guard: no code may call /events
      if (reqUrl.pathname.includes("/events")) {
        eventsEndpointCalls.push(reqUrl.pathname);
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Forbidden: events endpoint must not be called" } }));
        return;
      }

      if (req.method === "POST" && reqUrl.pathname === "/token") {
        const params = new URLSearchParams(rawBody);
        const grantType = params.get("grant_type");
        if (grantType === "authorization_code") {
          const code = params.get("code") || "";
          // code format: authcode_<accountKey>_<sha256B64urlChallenge>
          const parts = code.split("::");
          const accountKey = parts[1] || "friend1";
          const expectedChallenge = parts[2] || "";
          const codeVerifier = params.get("code_verifier") || "";
          const computedChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");
          if (!expectedChallenge || computedChallenge !== expectedChallenge) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_grant", error_description: "PKCE mismatch" }));
            return;
          }
          const accessToken = `stub_access_${accountKey}_${++seq}`;
          const refreshToken = `stub_refresh_${accountKey}_${seq}`;
          tokenToAccount.set(accessToken, accountKey);
          refreshToAccount.set(refreshToken, accountKey);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: accessToken,
              expires_in: 3600,
              refresh_token: refreshToken,
              scope:
                "https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.freebusy",
              token_type: "Bearer",
            })
          );
          return;
        }

        if (grantType === "refresh_token") {
          const rt = params.get("refresh_token") || "";
          const accountKey = refreshToAccount.get(rt);
          if (!accountKey || revokedTokens.includes(rt)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          const nextAccess = `stub_access_${accountKey}_rotated_${++seq}`;
          tokenToAccount.set(nextAccess, accountKey);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: nextAccess,
              expires_in: 3600,
              token_type: "Bearer",
            })
          );
          return;
        }
      }

      if (req.method === "POST" && reqUrl.pathname === "/revoke") {
        const params = new URLSearchParams(rawBody);
        const token = params.get("token") || "";
        revokedTokens.push(token);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
        return;
      }

      const authHeader = req.headers.authorization || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const accountKey = tokenToAccount.get(bearer);

      if (!accountKey || expiredAccessTokens.has(bearer) || revokedTokens.includes(bearer)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }));
        return;
      }

      const cfg = accountConfigs.get(accountKey);
      if (!cfg) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Account not found" } }));
        return;
      }

      if (req.method === "GET" && reqUrl.pathname === "/calendar/v3/users/me/calendarList") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ kind: "calendar#calendarList", items: cfg.calendars }));
        return;
      }

      if (req.method === "POST" && reqUrl.pathname === "/calendar/v3/freeBusy") {
        const payload = JSON.parse(rawBody || "{}");
        const items = Array.isArray(payload.items) ? payload.items : [];
        const calendars = {};
        for (const item of items) {
          const calId = item.id;
          calendars[calId] = {
            busy: cfg.busyByCalendar[calId] || [],
          };
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            kind: "calendar#freeBusy",
            timeMin: payload.timeMin,
            timeMax: payload.timeMax,
            calendars,
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });
  });

  return {
    server,
    revokedTokens,
    eventsEndpointCalls,
    expireLatestTokenFor(accountKey) {
      for (const [tok, key] of tokenToAccount.entries()) {
        if (key === accountKey) expiredAccessTokens.add(tok);
      }
    },
    setBusyFor(accountKey, calId, blocks) {
      const cfg = accountConfigs.get(accountKey);
      if (cfg) cfg.busyByCalendar[calId] = blocks;
    },
    async listen() {
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const addr = server.address();
      return addr.port;
    },
  };
}

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function runLiveUnconfiguredChecks() {
  logStep("1. Verify unauthenticated guards & unconfigured behavior on live server");
  const anon = new CookieClient(LIVE_BASE_URL);

  for (const [method, endpoint] of [
    ["GET", "/api/google-calendar/status"],
    ["GET", "/api/google-calendar/connect"],
    ["POST", "/api/google-calendar/sync"],
    ["PUT", "/api/google-calendar/calendars"],
    ["POST", "/api/google-calendar/disconnect"],
    ["PATCH", "/api/google-calendar/sharing"],
  ]) {
    const res = await anon.request(endpoint, { method });
    assert.equal(res.status, 401, `Anonymous ${method} ${endpoint} must return 401`);
  }

  const demo = new CookieClient(LIVE_BASE_URL);
  const loginRes = await demo.request("/api/auth/login", {
    method: "POST",
    body: { email: "demo@chuan-di.app", password: "ChuanDiDemo123" },
  });
  assert.equal(loginRes.status, 200, "Demo user login must succeed");

  const statusRes = await demo.request("/api/google-calendar/status");
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.json.connected, false, "Must never report connected before real OAuth");
  assert.equal(statusRes.json.syncStatus, "disconnected");
  assertNoTokenLeak(statusRes.json, "live /api/google-calendar/status");

  if (!statusRes.json.configured) {
    const connectRes = await demo.request("/api/google-calendar/connect?mode=json");
    assert.equal(connectRes.status, 503, "Unconfigured OAuth must return 503 instead of faking success");
    assert.equal(connectRes.json.connected, false);
    assert.equal(connectRes.json.code, "OAUTH_NOT_CONFIGURED");
  }

  const syncDisconnected = await demo.request("/api/google-calendar/sync", { method: "POST" });
  assert.equal(syncDisconnected.status, 400, "Sync when disconnected must return 400");
}

async function runFullOAuthProtocolE2E() {
  logStep("2. Boot isolated Next.js test server + real HTTP Google OAuth/Calendar stub");
  const targetDate = getBangkokDateOffset(2); // 2 days from Bangkok today (within 7d & 14d & 31d sync window)
  const stub = startGoogleStubServer(targetDate);
  const stubPort = await stub.listen();
  const appPort = await getFreePort();
  const tempDbPath = path.join(os.tmpdir(), `chuan-di-gcal-test-${process.pid}-${Date.now()}.db`);

  const nextBin = path.join(WORKSPACE, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(appPort), "-H", "127.0.0.1"], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      NODE_ENV: "production",
      CHUAN_DI_DB_PATH: tempDbPath,
      GOOGLE_CLIENT_ID: "chuandi-test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "chuandi-test-secret",
      GOOGLE_REDIRECT_URI: `http://127.0.0.1:${appPort}/api/google-calendar/callback`,
      GOOGLE_TOKEN_ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      GOOGLE_OAUTH_AUTH_URL: `http://127.0.0.1:${stubPort}/o/oauth2/v2/auth`,
      GOOGLE_OAUTH_TOKEN_URL: `http://127.0.0.1:${stubPort}/token`,
      GOOGLE_OAUTH_REVOKE_URL: `http://127.0.0.1:${stubPort}/revoke`,
      GOOGLE_CALENDAR_API_BASE: `http://127.0.0.1:${stubPort}/calendar/v3`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
  });

  const appUrl = `http://127.0.0.1:${appPort}`;

  try {
    await waitForServer(`${appUrl}/api/auth/me`, 25000);

    // 3. Register organizer + 4 friends as separate independent accounts
    logStep("3. Register organizer and 4 friend accounts + link via public invite flow");
    const org = new CookieClient(appUrl);
    const orgReg = await org.request("/api/auth/register", {
      method: "POST",
      body: { name: "มิกซ์ผู้จัด", email: "org@chuandi.test", password: "Password123!" },
    });
    assert.ok([200, 201].includes(orgReg.status), `Expected 200/201 register, got ${orgReg.status}`);

    const friendsUsers = [];
    const createdFriendIds = [];
    for (let i = 1; i <= 4; i++) {
      const client = new CookieClient(appUrl);
      const regRes = await client.request("/api/auth/register", {
        method: "POST",
        body: {
          name: `เพื่อนทดสอบ ${i}`,
          email: `friend${i}@chuandi.test`,
          password: "Password123!",
        },
      });
      assert.ok([200, 201].includes(regRes.status), `Expected 200/201 register, got ${regRes.status}`);
      friendsUsers.push(client);

      const fRes = await org.request("/api/friends", {
        method: "POST",
        body: {
          full_name: `เพื่อนทดสอบคนที่ ${i}`,
          nickname: `บี${i}`,
        },
      });
      assert.ok([200, 201].includes(fRes.status), `Expected 200/201 friend create, got ${fRes.status}`);
      const friendId = fRes.json.friend.id;
      createdFriendIds.push(friendId);

      // Generate registration invite link & have friend accept it personally
      const invRes = await org.request("/api/invitations/register", {
        method: "POST",
        body: { prefill_friend_id: friendId },
      });
      assert.ok([200, 201].includes(invRes.status), `Expected 200/201 invite, got ${invRes.status}`);
      const token = invRes.json.invitation.invite_token;

      const submitRes = await client.request(`/api/public/invite/${token}`, {
        method: "POST",
        body: {
          nickname: `บี${i}`,
          full_name: `เพื่อนทดสอบคนที่ ${i}`,
          consent_given: true,
        },
      });
      assert.equal(submitRes.status, 200);

      // Privacy default check: sharing is explicitly opted-in by the friend user themselves
      if (i <= 3) {
        const shareRes = await client.request("/api/google-calendar/sharing", {
          method: "PATCH",
          body: { friendId, isShared: true },
        });
        assert.equal(shareRes.status, 200);
      }
    }

    const [f1Client, f2Client, f3Client, f4Client] = friendsUsers;
    const [f1Id, f2Id, f3Id, f4Id] = createdFriendIds;

    // Give Friend 1 a manual weekly rule on target weekday too (to test fallback after disconnect!)
    const targetWeekday = new Date(`${targetDate}T12:00:00+07:00`).getUTCDay();
    assert.equal(
      (await f1Client.request("/api/calendar/availability", {
        method: "POST",
        body: {
          kind: "weekly",
          weekday: targetWeekday,
          status: "available",
          start_time: "19:00",
          end_time: "22:00",
          note: "กฎเวลาว่างด้วยตนเองของบี1",
        },
      })).status,
      200
    );

    // 4. Test OAuth denial, tampered state, and missing CSRF cookie
    logStep("4. Verify OAuth least-privilege scopes, denial, CSRF mismatch, and replay prevention");
    const badConnect = await f1Client.request("/api/google-calendar/connect?mode=json&redirect=/settings");
    assert.equal(badConnect.status, 200);
    const firstAuthUrl = new URL(badConnect.json.authUrl);
    const firstScope = firstAuthUrl.searchParams.get("scope") || "";
    assert.ok(firstScope.includes("calendar.calendarlist.readonly"));
    assert.ok(firstScope.includes("calendar.freebusy"));
    assert.ok(!firstScope.includes("calendar.events"), "Must NOT request event details scope");
    assert.equal(firstAuthUrl.searchParams.get("access_type"), "offline");
    assert.equal(firstAuthUrl.searchParams.get("code_challenge_method"), "S256");

    // Denial case
    const deniedRes = await f1Client.request(
      `/api/google-calendar/callback?error=access_denied&state=${encodeURIComponent(
        firstAuthUrl.searchParams.get("state") || ""
      )}`
    );
    assert.ok([302, 307].includes(deniedRes.status));
    assert.ok((deniedRes.headers.get("location") || "").includes("gcal=denied"));
    assert.equal((await f1Client.request("/api/google-calendar/status")).json.connected, false);

    // Tampered CSRF state
    const tamperedRes = await f1Client.request(
      `/api/google-calendar/callback?code=fake&state=tampered_state_123`
    );
    assert.ok([302, 307].includes(tamperedRes.status));
    assert.ok((tamperedRes.headers.get("location") || "").includes("gcal=error"));
    assert.equal((await f1Client.request("/api/google-calendar/status")).json.connected, false);

    // 5. Each friend connects their OWN Google Calendar via full PKCE callback
    logStep("5. Connect 4 friends independently via OAuth 2.0 PKCE + verify encrypted DB storage");
    async function connectAccountViaOAuth(client, accountKey) {
      const cRes = await client.request("/api/google-calendar/connect?mode=json&redirect=/settings");
      assert.equal(cRes.status, 200);
      const authUrl = new URL(cRes.json.authUrl);
      const state = authUrl.searchParams.get("state");
      const challenge = authUrl.searchParams.get("code_challenge");
      const code = `authcode::${accountKey}::${challenge}`;
      const cbRes = await client.request(
        `/api/google-calendar/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      );
      assert.ok([302, 307].includes(cbRes.status), `${accountKey} callback should redirect cleanly`);
      assert.ok(
        (cbRes.headers.get("location") || "").includes("gcal=connected"),
        `Expected gcal=connected for ${accountKey}`
      );
      return { state, code };
    }

    const f1Callback = await connectAccountViaOAuth(f1Client, "friend1");
    await connectAccountViaOAuth(f2Client, "friend2");
    await connectAccountViaOAuth(f3Client, "friend3");
    await connectAccountViaOAuth(f4Client, "friend4"); // Connected for self, but NOT shared with organizer!

    // Replay of already-used OAuth state must fail
    const replayRes = await f1Client.request(
      `/api/google-calendar/callback?code=${encodeURIComponent(f1Callback.code)}&state=${encodeURIComponent(f1Callback.state)}`
    );
    assert.ok([302, 307].includes(replayRes.status));
    assert.ok((replayRes.headers.get("location") || "").includes("gcal=error"));

    // Verify encrypted DB storage & zero token leak in API response
    const inspectDb = new DatabaseSync(tempDbPath);
    const connRows = inspectDb
      .prepare("SELECT user_id, google_email, access_token_enc, refresh_token_enc FROM google_calendar_connections")
      .all();
    assert.equal(connRows.length, 4);
    for (const row of connRows) {
      assert.ok(row.access_token_enc.startsWith("v1:"), "Access token must be AES-256-GCM encrypted");
      assert.ok(!row.access_token_enc.includes("stub_access_"), "Plaintext token must not exist in DB");
      assert.ok(row.refresh_token_enc.startsWith("v1:"), "Refresh token must be AES-256-GCM encrypted");
    }
    inspectDb.close();

    // Verify zero token leaks in status API + verify calendar list for Friend 1
    const f1Status = await f1Client.request("/api/google-calendar/status");
    assert.equal(f1Status.status, 200);
    assert.equal(f1Status.json.connected, true);
    assert.equal(f1Status.json.googleEmail, "friend1.gcal@gmail.com");
    assert.equal(f1Status.json.calendars.length, 2);
    assertNoTokenLeak(f1Status.json, "Friend 1 status");

    // 6. Select both calendars for Friend 1 and re-sync
    logStep("6. Select multiple calendars for Friend 1 and sync Free/Busy");
    const putCalRes = await f1Client.request("/api/google-calendar/calendars", {
      method: "PUT",
      body: {
        calendarIds: [
          "friend1.gcal@gmail.com",
          "friend1_work@group.calendar.google.com",
        ],
      },
    });
    assert.equal(putCalRes.status, 200);
    assert.equal(putCalRes.json.status.selectedCount, 2);

    // 7. Smart Calendar 3-friend intersection + Unshared = unknown enforcement
    logStep("7. Test 3-friend Smart Calendar intersection & unshared='ยังไม่มีข้อมูล'");
    const match3Res = await org.request("/api/calendar/match", {
      method: "POST",
      body: {
        friendIds: [f1Id, f2Id, f3Id],
        dateFilter: "custom",
        customStart: targetDate,
        customEnd: targetDate,
        timeFilter: "all",
        includeSelf: false,
      },
    });
    assert.equal(match3Res.status, 200);
    assertNoTokenLeak(match3Res.json, "Organizer match3");
    const day3 = match3Res.json.gridDays.find((d) => d.date === targetDate);
    assert.ok(day3, "Target date should exist in gridDays");
    assert.equal(day3.availableCount, 3, "All 3 Google-connected shared friends should match");
    assert.equal(day3.allSelectedAvailable, true);
    assert.equal(day3.overlapStartTime, "16:00", "Common overlap after 12-13, 14-16, 08-10 busy must start at 16:00");
    assert.equal(day3.overlapEndTime, "22:00");

    // Add Friend 4 (Google connected for self, NOT shared with organizer)
    const match4Res = await org.request("/api/calendar/match", {
      method: "POST",
      body: {
        friendIds: [f1Id, f2Id, f3Id, f4Id],
        dateFilter: "custom",
        customStart: targetDate,
        customEnd: targetDate,
        timeFilter: "all",
        includeSelf: false,
      },
    });
    assert.equal(match4Res.status, 200);
    const day4 = match4Res.json.gridDays.find((d) => d.date === targetDate);
    assert.equal(day4.unknownCount, 1, "Unshared Friend 4 must be counted in unknownCount");
    assert.equal(day4.unknownFriends[0].id, f4Id);
    assert.equal(day4.unknownFriends[0].status, "unknown");
    assert.equal(day4.allSelectedAvailable, false, "Must never assume unshared friend is available");

    // 8. Privacy sharing toggle isolation & effect
    logStep("8. Verify per-organizer sharing toggle authorization & immediate privacy protection");
    const forbiddenToggle = await org.request("/api/google-calendar/sharing", {
      method: "PATCH",
      body: { friendId: f3Id, isShared: false },
    });
    assert.equal(forbiddenToggle.status, 403, "Organizer must not be allowed to modify friend's sharing permission");

    const f3Revoke = await f3Client.request("/api/google-calendar/sharing", {
      method: "PATCH",
      body: { friendId: f3Id, isShared: false },
    });
    assert.equal(f3Revoke.status, 200);

    const matchAfterRevoke = await org.request("/api/calendar/match", {
      method: "POST",
      body: {
        friendIds: [f1Id, f2Id, f3Id],
        dateFilter: "custom",
        customStart: targetDate,
        customEnd: targetDate,
        timeFilter: "all",
        includeSelf: false,
      },
    });
    const dayRevoked = matchAfterRevoke.json.gridDays.find((d) => d.date === targetDate);
    assert.equal(dayRevoked.unknownCount, 1);
    assert.equal(dayRevoked.unknownFriends[0].id, f3Id, "Friend 3 must become unknown immediately after disabling sharing");

    // Re-enable Friend 3 sharing
    assert.equal(
      (await f3Client.request("/api/google-calendar/sharing", {
        method: "PATCH",
        body: { friendId: f3Id, isShared: true },
      })).status,
      200
    );

    // 9. Refresh sync + forced token expiration -> automatic refresh_token rotation
    logStep("9. Test token rotation on 401 + refresh sync updates Smart Calendar");
    stub.setBusyFor("friend2", "friend2.gcal@gmail.com", [
      { start: bangkokIso(targetDate, "14:00"), end: bangkokIso(targetDate, "18:00") },
    ]);
    stub.expireLatestTokenFor("friend2");
    const syncF2 = await f2Client.request("/api/google-calendar/sync", { method: "POST" });
    assert.equal(syncF2.status, 200, "Expired access token must automatically refresh via refresh_token");

    const matchAfterSync = await org.request("/api/calendar/match", {
      method: "POST",
      body: {
        friendIds: [f1Id, f2Id, f3Id],
        dateFilter: "custom",
        customStart: targetDate,
        customEnd: targetDate,
        timeFilter: "all",
        includeSelf: false,
      },
    });
    const dayUpdated = matchAfterSync.json.gridDays.find((d) => d.date === targetDate);
    assert.equal(dayUpdated.overlapStartTime, "18:00", "Updated busy 14-18 should shift best overlap to 18:00-22:00");

    // 10. Activity Recommendation availability integration
    logStep("10. Test activity recommendation calendar availability integration");
    const recRes = await org.request("/api/activities/recommend", {
      method: "POST",
      body: {
        title: "หมูกระทะเย็น",
        category: "อาหารและสังสรรค์",
        activity_date: targetDate,
        start_time: "18:00",
        end_time: "21:00",
      },
    });
    assert.equal(recRes.status, 200);
    const byId = new Map(recRes.json.recommendations.map((r) => [r.id, r]));
    assert.equal(byId.get(f1Id).availability_status, "available");
    assert.equal(byId.get(f2Id).availability_status, "available");
    assert.equal(byId.get(f3Id).availability_status, "available");
    assert.equal(byId.get(f4Id).availability_status, "unknown");

    // 11. Disconnect Friend 1 & verify manual availability continues working cleanly
    logStep("11. Disconnect Google Calendar and verify token revocation + manual fallback");
    const discRes = await f1Client.request("/api/google-calendar/disconnect", { method: "POST" });
    assert.equal(discRes.status, 200);
    assert.equal(discRes.json.disconnected, true);
    assert.equal(discRes.json.status.connected, false);
    assert.ok(stub.revokedTokens.length >= 1, "Google revoke endpoint must have been called");

    const checkDbAfterDisc = new DatabaseSync(tempDbPath);
    const remConn = checkDbAfterDisc
      .prepare("SELECT COUNT(*) as cnt FROM google_calendar_connections WHERE user_id = (SELECT id FROM users WHERE email = 'friend1@chuandi.test')")
      .get();
    const remBusy = checkDbAfterDisc
      .prepare("SELECT COUNT(*) as cnt FROM google_freebusy_blocks WHERE user_id = (SELECT id FROM users WHERE email = 'friend1@chuandi.test')")
      .get();
    assert.equal(remConn.cnt, 0);
    assert.equal(remBusy.cnt, 0);
    checkDbAfterDisc.close();

    // Friend 1 should now use manual rule (19:00-22:00) cleanly!
    const matchAfterDisc = await org.request("/api/calendar/match", {
      method: "POST",
      body: {
        friendIds: [f1Id, f2Id, f3Id],
        dateFilter: "custom",
        customStart: targetDate,
        customEnd: targetDate,
        timeFilter: "all",
        includeSelf: false,
      },
    });
    const dayManual = matchAfterDisc.json.gridDays.find((d) => d.date === targetDate);
    assert.equal(dayManual.overlapStartTime, "19:00", "Manual weekly rule 19:00-22:00 must kick in after Google disconnect");
    assert.equal(dayManual.overlapEndTime, "22:00");
    assert.equal(stub.eventsEndpointCalls.length, 0, "Events API must NEVER be called");

    console.log("\nALL PART 2 GOOGLE CALENDAR TESTS PASSED!");
  } finally {
    child.kill("SIGTERM");
    stub.server.close();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // ignore Windows lock cleanup race
      }
    }
    if (fs.existsSync(`${tempDbPath}-wal`)) {
      try {
        fs.unlinkSync(`${tempDbPath}-wal`);
      } catch {}
    }
    if (fs.existsSync(`${tempDbPath}-shm`)) {
      try {
        fs.unlinkSync(`${tempDbPath}-shm`);
      } catch {}
    }
    if (stderrBuf.trim()) {
      console.error("[Ephemeral Server stderr excerpt]:\n", stderrBuf.slice(0, 800));
    }
  }
}

async function main() {
  await runLiveUnconfiguredChecks();
  await runFullOAuthProtocolE2E();
}

main().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
