"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, UserRound, FlaskConical, Archive, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/firebase/authContext";
import { UI_DEV_MODE } from "@/lib/devMode";
import { resetDevStore } from "@/lib/dev/mockStore";

export default function Home() {
  const router = useRouter();
  const { enterDevMode, profile } = useAuth();

  useEffect(() => {
    if (!UI_DEV_MODE) router.replace("/login");
  }, [router]);

  if (!UI_DEV_MODE) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm font-medium">Carregando JusFácil...</p>
      </div>
    );
  }

  const enter = async (role: "CITIZEN" | "LAWYER") => {
    await enterDevMode(role);
    router.push(role === "LAWYER" ? "/advogado" : "/app");
  };

  const reset = () => {
    resetDevStore();
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-[#EEF1F4] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,43,67,0.12)]">
          <div className="bg-[#002B43] px-6 py-8 text-white sm:px-10">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
                <Image src="/img/Logo.png" alt="JusFácil" width={52} height={60} className="object-contain" priority />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-[#E9C89E]">
                  <FlaskConical className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">Modo visual de desenvolvimento</span>
                </div>
                <h1 className="font-serif text-3xl font-bold tracking-wide sm:text-4xl">JUSFÁCIL</h1>
                <p className="mt-1 text-sm text-slate-200">Navegue pelo produto sem Firebase e sem consumir OpenAI.</p>
              </div>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-10">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>Ambiente isolado.</strong> Tudo que aparecer nas telas abaixo é dado de demonstração salvo apenas no navegador. O login real continua preservado e pode ser reativado depois.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void enter("CITIZEN")}
                className="group rounded-[20px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#002B43] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08A4E]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#002B43] text-white">
                  <UserRound className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-[#002B43]">Entrar como Cidadão</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6E7580]">Teste Home, Dashboard, casos, notificações, perfil, JurisBot, minutas e evidências.</p>
              </button>

              <button
                type="button"
                onClick={() => void enter("LAWYER")}
                className="group rounded-[20px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C08A4E] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08A4E]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C08A4E] text-white">
                  <Scale className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-[#002B43]">Entrar como Advogado</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6E7580]">Teste casos atribuídos, Dashboard, suporte, perfil e o wizard de atualização.</p>
              </button>
            </div>

            {profile && (
              <p className="text-center text-xs text-slate-500">Perfil selecionado nesta sessão: <strong>{profile.fullName}</strong>.</p>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Archive className="h-4 w-4" />
                Ver login original arquivado
              </Link>
              <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-[#002B43] hover:underline">
                <RotateCcw className="h-4 w-4" />
                Restaurar dados de demonstração
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
