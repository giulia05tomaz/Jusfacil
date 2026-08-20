"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader2 } from "lucide-react";
import { DevModeBanner } from "@/components/dev/DevModeBanner";
import { UI_DEV_MODE } from "@/lib/devMode";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const immersiveChat = pathname.startsWith("/app/jurisbot/");

  useEffect(() => {
    if (!loading && !user && !profile) {
      router.push(UI_DEV_MODE ? "/" : "/login");
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-jus-petroleum animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Carregando JusFácil...</p>
      </div>
    );
  }

  return (
    <div className={`${immersiveChat ? "h-dvh overflow-hidden pb-0" : "min-h-screen pb-24 md:pb-0"} w-full min-w-0 max-w-full bg-slate-50 flex flex-col`}>
      <div className="hidden lg:block">
        <Navbar />
      </div>
      <DevModeBanner />
      <main className="flex-1 min-h-0 min-w-0 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      <MobileNav />
    </div>
  );
}
