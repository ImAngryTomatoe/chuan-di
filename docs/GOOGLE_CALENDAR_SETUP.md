# คู่มือตั้งค่า Google Calendar OAuth 2.0 สำหรับ CHUAN-DI

CHUAN-DI ใช้ **Google OAuth 2.0 (Authorization Code Flow + PKCE)** ร่วมกับ **Google Calendar API v3** จริง เพื่อดึงเฉพาะข้อมูลรายชื่อปฏิทินและช่วงเวลาว่าง/ไม่ว่าง (Free/Busy) โดยไม่ขอสิทธิ์อ่านชื่อนัดหมาย รายละเอียด หรือรายชื่อผู้เข้าร่วมประชุม

---

## 1. ขอบเขตสิทธิ์ (Scopes) ที่ระบบขอใช้งาน

ระบบขอเพียง 2 Scopes ที่จำเป็นที่สุดเท่านั้น (Principle of Least Privilege):
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly` — แสดงรายชื่อปฏิทินของผู้ใช้เพื่อให้เลือกได้ว่าต้องการแชร์สถานะจากปฏิทินใดบ้าง
- `https://www.googleapis.com/auth/calendar.freebusy` — อ่านเฉพาะช่วงเวลาว่าง/ไม่ว่าง (`freeBusy.query`) โดยไม่เข้าถึงหัวข้อหรือรายละเอียดของอีเวนต์ส่วนตัว

---

## 2. ขั้นตอนตั้งค่าใน Google Cloud Console

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) และสร้างโปรเจกต์ใหม่ (หรือเลือกโปรเจกต์เดิม)
2. ไปที่ **APIs & Services > Library** ค้นหา **Google Calendar API** แล้วกด **Enable**
3. ไปที่ **APIs & Services > OAuth consent screen**:
   - เลือก User Type เป็น **External** (หรือ Internal หากใช้ Google Workspace ภายในองค์กร)
   - กรอกชื่อแอป (เช่น `CHUAN-DI`), User support email และ Developer contact email
   - ในส่วน **Scopes** เพิ่ม 2 Scopes ด้านบน (`calendar.calendarlist.readonly` และ `calendar.freebusy`)
   - หากแอปยังอยู่ในโหมด **Testing** ให้เพิ่มอีเมลบัญชี Google ที่ต้องการใช้ทดสอบลงใน **Test users** (ทั้งบัญชีของผู้จัดและเพื่อนที่จะใช้ทดสอบ)
4. ไปที่ **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Name: `CHUAN-DI Web`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (สำหรับเครื่องพัฒนา)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/google-calendar/callback`
     - *(หาก Deploy จริง ให้เพิ่ม `https://your-domain.com/api/google-calendar/callback`)*
5. คัดลอก **Client ID** และ **Client Secret** ที่ได้

---

## 3. ตั้งค่าตัวแปรสภาพแวดล้อม (.env.local)

คัดลอก `.env.example` เป็น `.env.local` (หากยังไม่มี) แล้วกรอกค่า:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=replace-with-a-long-random-secret-at-least-32-chars
```

จากนั้นรีสตาร์ทเซิร์ฟเวอร์ (`npm run dev` หรือ `npm run build` แล้ว `npm run start`)

---

## 4. ความปลอดภัยและความเป็นส่วนตัว

- **PKCE + Single-use OAuth State:** ป้องกันการโจมตีแบบ CSRF และ Replay attack ด้วย `state` แบบใช้ครั้งเดียวที่ผูกกับบัญชีผู้ใช้งานและ HTTP-only Signed Cookie
- **Encrypted Tokens at Rest:** `access_token` และ `refresh_token` ถูกเข้ารหัสแบบ AES-256-GCM ก่อนจัดเก็บใน SQLite ฝั่งเซิร์ฟเวอร์ และ **ไม่ถูกส่งไปยัง Frontend**
- **Free/Busy Only:** ระบบจัดเก็บเฉพาะช่วงเวลาที่ไม่ว่าง (`bangkok_date`, `start_time`, `end_time`) ไม่เก็บชื่อประชุมหรือรายละเอียดส่วนตัว
- **Per-Organizer Sharing Control:** ผู้ใช้แต่ละคนต้องเชื่อมต่อบัญชี Google ของตนเอง และเลือกเปิด/ปิดการแชร์เวลาว่างให้ผู้จัดแต่ละรายได้เป็นรายบุคคล
