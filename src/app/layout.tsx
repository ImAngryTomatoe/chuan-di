import type { Metadata } from "next";
import { Noto_Sans_Thai, Quicksand } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-quicksand",
});

export const metadata: Metadata = {
  title: "CHUAN-DI — ระบบจัดการข้อมูลเพื่อนและวางแผนกิจกรรม",
  description:
    "แพลตฟอร์มรวบรวม จัดหมวดหมู่ สกัดความชอบ ข้อจำกัดด้านอาหาร และช่วยวางแผนชวนเพื่อนทำกิจกรรมอย่างเหมาะสม",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoThai.variable} ${quicksand.variable}`}>
      <body className="font-sans antialiased bg-[#F8F7F6] text-[#1F1A1C] min-h-screen">
        {children}
      </body>
    </html>
  );
}
