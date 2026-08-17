"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Loader2 } from "lucide-react";

export default function LawyerLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.push("/login");
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

  if (profile?.role === "LAWYER" && profile.lawyerStatus !== "APPROVED" && pathname !== "/advogado/perfil") {
    const label = profile.lawyerStatus === "PENDING" ? "Cadastro em análise" : profile.lawyerStatus === "SUSPENDED" ? "Acesso suspenso" : "Cadastro não aprovado";
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-jus-petroleum">{label}</h1><p className="mt-3 text-sm text-slate-600">Enquanto seu status não for aprovado, casos, mensagens, evidências e minutas permanecem bloqueados.</p><Link href="/advogado/perfil" className="mt-5 inline-block rounded-xl bg-jus-petroleum px-4 py-2 text-sm font-semibold text-white">Ver meu perfil e status</Link></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16 md:pb-0">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      <MobileNav />
    </div>
  );
}
