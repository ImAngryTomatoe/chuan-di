"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Menu,
  Search,
  Settings,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { MascotAvatar } from "./MascotAvatar";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  bio: string | null;
}

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface QuickFriendItem {
  id: number;
  nickname: string;
  full_name: string;
  avatar_color: string;
}

interface AppContextValue {
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  refreshUser: async () => {},
  notify: () => {},
});

export function useApp() {
  return useContext(AppContext);
}

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "flow" | "more";
  step?: string;
}> = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard, group: "flow", step: "1" },
  { href: "/my-profile", label: "โปรไฟล์ฉัน", icon: UserCheck, group: "flow", step: "2" },
  { href: "/friends", label: "เพื่อนของฉัน", icon: Users, group: "flow", step: "3" },
  { href: "/calendar", label: "วันว่างตรงกัน", icon: CalendarDays, group: "flow", step: "4" },
  { href: "/activities", label: "กิจกรรม & คำชวน", icon: CalendarHeart, group: "flow", step: "5" },
  { href: "/invitations", label: "คำชวน & ตอบรับ", icon: MailCheck, group: "more" },
  { href: "/settings", label: "ตั้งค่า", icon: Settings, group: "more" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Quick Command Palette (Ctrl+K)
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteFriends, setPaletteFriends] = useState<QuickFriendItem[]>([]);

  const notify = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(async () => {
      const q = paletteQuery.trim();
      const res = await fetch(`/api/friends?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setPaletteFriends((d.friends || []).slice(0, 6));
      }
    }, 120);
    return () => clearTimeout(t);
  }, [paletteOpen, paletteQuery]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F6] gap-4">
        <MascotAvatar pose="curious" size="lg" float />
        <p className="text-sm font-medium text-[#6E666A]">
          กำลังเตรียมข้อมูลระบบ...
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppContext.Provider value={{ user, refreshUser, notify }}>
      <div className="min-h-screen flex bg-[#F8F7F6] text-[#1F1A1C] overflow-x-clip">
        {/* Skip Navigation for Keyboard Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#B3486B] focus:text-white focus:text-sm focus:font-semibold"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>

        {/* Mobile Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#1F1A1C]/35 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          aria-label="เมนูหลัก"
          className={`fixed lg:sticky top-0 left-0 z-50 h-screen shrink-0 bg-white border-r border-[#EAE6E8] flex flex-col transition-all duration-300 ${
            collapsed ? "lg:w-20" : "lg:w-64"
          } ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}`}
        >
          {/* Logo Header */}
          <div className="p-4 flex items-center justify-between border-b border-[#EFECEF]">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
            >
              <MascotAvatar pose="welcome" size="xs" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="font-bold text-base tracking-tight text-[#1F1A1C]">
                    CHUAN-DI
                  </div>
                  <p className="text-[11px] font-medium text-[#6E666A] truncate">
                    รู้ใจเพื่อน ชวนไปด้วยกัน
                  </p>
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
              className="hidden lg:flex p-1.5 rounded-xl text-[#6E666A] hover:bg-[#F4F2F3] hover:text-[#1F1A1C] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="ปิดเมนู"
              className="lg:hidden p-1.5 rounded-xl text-[#6E666A] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {(["flow", "more"] as const).map((groupKey) => {
              const items = NAV_ITEMS.filter((item) => item.group === groupKey);
              return (
                <div key={groupKey} className="space-y-1">
                  {!collapsed && (
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9E8B93]">
                      {groupKey === "flow" ? "ขั้นตอนใช้งาน" : "เพิ่มเติม"}
                    </p>
                  )}
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none ${
                          active
                            ? "bg-[#F9F1F4] text-[#993858] font-semibold"
                            : "text-[#544D51] hover:bg-[#F4F2F3] hover:text-[#1F1A1C]"
                        } ${collapsed ? "justify-center px-2" : ""}`}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? "text-[#B3486B]" : "text-[#7A7276]"
                          }`}
                        />
                        {!collapsed && (
                          <span className="text-sm leading-tight truncate flex-1">{item.label}</span>
                        )}
                        {!collapsed && item.step && (
                          <span
                            className={`text-[10px] font-bold w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 ${
                              active
                                ? "bg-[#B3486B] text-white"
                                : "bg-[#F4F2F3] text-[#7A7276]"
                            }`}
                          >
                            {item.step}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Compact Footer & User */}
          <div className="p-3 border-t border-[#EFECEF] space-y-2">

            <div className="flex items-center justify-between gap-2 px-2 py-1">
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1F1A1C] truncate">{user.name}</div>
                  <div className="text-[11px] text-[#6E666A] truncate">{user.email}</div>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="ออกจากระบบ"
                className="p-2 rounded-xl text-[#6E666A] hover:bg-[#FDF3F2] hover:text-[#A3322E] transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 w-full">
          {/* Mobile Header */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EAE6E8] px-4 py-3 flex items-center justify-between lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="เปิดเมนู"
              className="p-2 rounded-xl bg-[#F4F2F3] text-[#1F1A1C] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="font-bold text-base text-[#1F1A1C]">CHUAN-DI</span>
            </Link>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="ค้นหาด่วน"
              className="p-2 rounded-xl bg-[#FAF9F8] border border-[#EAE6E8] text-[#544D51] cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </header>

          {/* Desktop Top Header */}
          <header className="hidden lg:flex sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#EAE6E8] px-8 py-3 items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#FAF9F8] hover:bg-[#F4F2F3] border border-[#EAE6E8] text-xs text-[#6E666A] transition-colors cursor-pointer w-72 justify-start focus-visible:ring-2 focus-visible:ring-[#B3486B] focus-visible:outline-none"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#857B80]" />
                <span>ค้นหาเพื่อนหรือคำสั่งด่วน...</span>
              </span>
            </button>

            <div className="flex items-center gap-2.5">
              <Link
                href="/friends?add=1"
                className="px-3.5 py-2 rounded-xl bg-[#FFE4EC]/60 border border-[#F7C5D6] hover:border-[#F47FA5] text-xs font-semibold text-[#8F2849] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                แอดเพื่อน
              </Link>
              <Link
                href="/activities/new"
                className="px-3.5 py-2 rounded-xl bg-[#E15B87] hover:bg-[#C84572] text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F47FA5] focus-visible:outline-none"
              >
                สร้างกิจกรรมใหม่
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-full bg-[#FAF9F8] border border-[#EAE6E8] hover:border-[#C2597C] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#1F1A1C] text-white text-xs font-semibold flex items-center justify-center">
                  {user.name.slice(0, 1)}
                </div>
                <div className="text-xs leading-tight">
                  <div className="font-semibold text-[#1F1A1C]">{user.name}</div>
                  <div className="text-[10px] text-[#6E666A]">{user.email}</div>
                </div>
              </Link>
            </div>
          </header>

          <main
            id="main-content"
            className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0"
          >
            {children}
          </main>
        </div>

        {/* Quick Command Palette Modal */}
        {paletteOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาด่วน"
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-[#1F1A1C]/40 backdrop-blur-xs p-4"
            onClick={() => setPaletteOpen(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#EAE6E8] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EFECEF]">
                <Search className="w-4 h-4 text-[#B3486B]" />
                <input
                  type="text"
                  autoFocus
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อเพื่อน ความชอบ เช่น หมูกระทะ หรือเลือกคำสั่ง..."
                  className="flex-1 text-sm text-[#1F1A1C] placeholder:text-[#857B80] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPaletteOpen(false)}
                  className="p-1 rounded-lg text-[#6E666A] hover:bg-[#F4F2F3] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#6E666A] uppercase">
                    คำสั่งด่วน
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: "/my-profile", label: "โปรไฟล์ฉัน", icon: UserCheck },
                      { href: "/friends?add=1", label: "แอดเพื่อนในแอป", icon: UserPlus },
                      { href: "/friends", label: "รายชื่อเพื่อนทั้งหมด", icon: Users },
                      { href: "/activities/new", label: "สร้างกิจกรรมใหม่", icon: CalendarHeart },
                    ].map((act) => {
                      const AIcon = act.icon;
                      return (
                        <button
                          key={act.href}
                          type="button"
                          onClick={() => {
                            setPaletteOpen(false);
                            router.push(act.href);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F8] hover:bg-[#F9F1F4] border border-[#EAE6E8] text-xs font-semibold text-[#1F1A1C] transition-colors cursor-pointer text-left"
                        >
                          <AIcon className="w-3.5 h-3.5 text-[#B3486B]" />
                          <span>{act.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#6E666A] uppercase">
                    เพื่อนที่ค้นพบ · {paletteFriends.length} คน
                  </div>
                  {paletteFriends.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-[#6E666A]">
                      ไม่พบรายชื่อเพื่อนที่ตรงกับคำค้นหา
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {paletteFriends.map((pf) => (
                        <button
                          key={pf.id}
                          type="button"
                          onClick={() => {
                            setPaletteOpen(false);
                            router.push(`/friends/${pf.id}`);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FAF9F8] transition-colors cursor-pointer text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold text-white"
                            style={{ backgroundColor: pf.avatar_color }}
                          >
                            {pf.nickname.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[#1F1A1C]">{pf.nickname}</div>
                            <div className="text-[11px] text-[#6E666A]">{pf.full_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Stack */}
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-lg border flex items-center gap-3 text-sm font-medium ${
                t.type === "error"
                  ? "bg-[#FDF3F2] border-[#EED2D0] text-[#9A332E]"
                  : t.type === "info"
                  ? "bg-[#F4F3F5] border-[#DFE0E6] text-[#1F1A1C]"
                  : "bg-white border-[#EAE6E8] text-[#1F1A1C]"
              }`}
            >
              <MascotAvatar pose={t.type === "error" ? "curious" : "happy"} size="xs" />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                aria-label="ปิดการแจ้งเตือน"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppContext.Provider>
  );
}
