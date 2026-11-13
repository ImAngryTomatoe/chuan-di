import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_ACCOUNT_EMAIL, resetDemoDataForUser } from "@/lib/db";

export async function POST() {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.email !== DEMO_ACCOUNT_EMAIL) {
    return NextResponse.json(
      {
        error:
          "ฟังก์ชันรีเซ็ตข้อมูลเดโมใช้ได้เฉพาะบัญชีเดโม demo@chuan-di.app เท่านั้น เพื่อปกป้องข้อมูลผู้ใช้งานจริง",
      },
      { status: 403 }
    );
  }

  resetDemoDataForUser(user.id);
  return NextResponse.json({
    ok: true,
    message: "รีเซ็ตข้อมูลเดโม เพื่อน 22 คน กิจกรรม 6 รายการ และกลุ่มที่บันทึก เรียบร้อยแล้ว",
  });
}
