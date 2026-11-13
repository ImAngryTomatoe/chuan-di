"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";

function SegmentsRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const interest = searchParams.get("interest");
    const exclude = searchParams.get("exclude");
    const qs = new URLSearchParams();
    if (interest) qs.set("interest", interest);
    else if (exclude) qs.set("q", exclude);
    const target = qs.toString() ? `/friends?${qs.toString()}` : "/friends";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <AppShell>
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6E666A]">
        กำลังนำทางไปยังหน้ารายชื่อเพื่อน...
      </div>
    </AppShell>
  );
}

export default function SegmentsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6E666A]">
            กำลังนำทางไปยังหน้ารายชื่อเพื่อน...
          </div>
        </AppShell>
      }
    >
      <SegmentsRedirectInner />
    </Suspense>
  );
}
