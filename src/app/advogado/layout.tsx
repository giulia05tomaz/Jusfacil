"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader2 } from "lucide-react";
import { DevModeBanner } from "@/components/dev/DevModeBanner";
import { UI_DEV_MODE } from "@/lib/devMode";

export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const immersiveSupport = pathname === "/advogado/suporte";

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push(UI_DEV_MODE ? "/" : "/login");
    } else if (!loading && profile?.role !== "LAWYER") {
      router.push(profile?.role === "ADMIN" ? "/admin" : "/app");
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-jus-petroleum animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Carregando Portal do Advogado...</p>
      </div>
    );
  }

  if (profile?.role === "LAWYER" && profile.lawyerStatus !== "APPROVED" && pathname !== "/advogado/perfil" && pathname !== "/advogado") {
    const isPending = profile.lawyerStatus === "PENDING";
    const isSuspended = profile.lawyerStatus === "SUSPENDED";
    const title = isPending
      ? "Seu cadastro profissional está em análise."
      : isSuspended
      ? "Seu acesso profissional está suspenso."
      : "Seu cadastro profissional não foi aprovado.";
    const subtitle = isPending
      ? "Você poderá visualizar casos após a aprovação do seu cadastro."
      : "Entre em contato com o suporte ou aguarde atualização cadastral.";

    return (
      <div className="min-h-screen w-full min-w-0 max-w-full bg-[#F1F1F1] flex flex-col pb-24 md:pb-0">
        <div className="hidden lg:block">
          <Navbar />
        </div>
        <main className="flex-1 min-w-0 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full rounded-[18px] bg-white p-8 text-center shadow-card border border-slate-100 space-y-4">
            <h1 className="text-xl font-bold text-[#002B43]">{title}</h1>
            <p className="text-sm text-[#6E7580] leading-relaxed">{subtitle}</p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/advogado/perfil"
                className="inline-flex items-center justify-center rounded-[14px] bg-[#002B43] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003A58] transition-colors"
              >
                Ver meu perfil
              </Link>
              <Link
                href="/advogado"
                className="inline-flex items-center justify-center rounded-[14px] bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Voltar à Home
              </Link>
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className={`${immersiveSupport ? "h-dvh overflow-hidden pb-0" : "min-h-screen pb-24 md:pb-0"} w-full min-w-0 max-w-full bg-[#F1F1F1] flex flex-col`}>
      <div className="hidden lg:block">
        <Navbar />
      </div>
      <DevModeBanner />
      <main className="flex-1 min-h-0 min-w-0 max-w-[1180px] w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      <MobileNav />
    </div>
  );
}
