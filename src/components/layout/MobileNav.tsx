"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Home, LayoutDashboard, Bot, User, Headphones } from "lucide-react";

export const MobileNav: React.FC = () => {
  const rawPathname = usePathname();
  const pathname = rawPathname || "";
  const { profile } = useAuth();

  if (pathname.startsWith("/app/jurisbot") || pathname === "/advogado/suporte") return null;

  const isLawyer = profile?.role === "LAWYER";

  if (isLawyer) {
    const isHome = pathname === "/advogado" || pathname === "/advogado/casos";
    const isDashboard = pathname === "/advogado/dashboard";
    const isSupport = pathname === "/advogado/suporte";
    const isProfile = pathname === "/advogado/perfil";

    return (
      <nav
        aria-label="Navegação móvel do advogado"
        className="safe-area-bottom md:hidden fixed bottom-0 left-0 right-0 z-40 grid w-full max-w-full grid-cols-4 items-center border-t border-slate-200/90 bg-white px-1 pt-2 shadow-card-lg"
      >
        <Link
          href="/advogado"
          className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
            isHome
              ? "text-jus-petroleum font-bold scale-105"
              : "text-jus-darkgray hover:text-jus-petroleum font-normal"
          }`}
        >
          <Home className={`w-5 h-5 ${isHome ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
          <span className="text-[11px] mt-1">Home</span>
        </Link>

        <Link
          href="/advogado/dashboard"
          className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
            isDashboard
              ? "text-jus-petroleum font-bold scale-105"
              : "text-jus-darkgray hover:text-jus-petroleum font-normal"
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${isDashboard ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
          <span className="text-[11px] mt-1">Dashboard</span>
        </Link>

        <Link
          href="/advogado/suporte"
          className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
            isSupport
              ? "text-jus-petroleum font-bold scale-105"
              : "text-jus-darkgray hover:text-jus-petroleum font-normal"
          }`}
        >
          <Headphones className={`w-5 h-5 ${isSupport ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
          <span className="text-[11px] mt-1">Suporte</span>
        </Link>

        <Link
          href="/advogado/perfil"
          className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
            isProfile
              ? "text-jus-petroleum font-bold scale-105"
              : "text-jus-darkgray hover:text-jus-petroleum font-normal"
          }`}
        >
          <User className={`w-5 h-5 ${isProfile ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
          <span className="text-[11px] mt-1">Perfil</span>
        </Link>
      </nav>
    );
  }

  const isHome = pathname === "/app";
  const isDashboard = pathname === "/app/dashboard";
  const isChatBot = pathname.startsWith("/app/jurisbot") || pathname === "/app/processos/novo";
  const isProfile = pathname === "/app/perfil";

  return (
    <nav
      aria-label="Navegação móvel do cidadão"
      className="safe-area-bottom md:hidden fixed bottom-0 left-0 right-0 z-40 grid w-full max-w-full grid-cols-4 items-center border-t border-slate-200/90 bg-white px-1 pt-2 shadow-card-lg"
    >
      <Link
        href="/app"
        className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
          isHome
            ? "text-jus-petroleum font-bold scale-105"
            : "text-jus-darkgray hover:text-jus-petroleum font-normal"
        }`}
      >
        <Home className={`w-5 h-5 ${isHome ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
        <span className="text-[11px] mt-1">Home</span>
      </Link>

      <Link
        href="/app/dashboard"
        className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
          isDashboard
            ? "text-jus-petroleum font-bold scale-105"
            : "text-jus-darkgray hover:text-jus-petroleum font-normal"
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${isDashboard ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
        <span className="text-[11px] mt-1">Dashboard</span>
      </Link>

      <Link
        href="/app/jurisbot"
        className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
          isChatBot
            ? "text-jus-caramel font-bold scale-105"
            : "text-jus-darkgray hover:text-jus-petroleum font-normal"
        }`}
      >
        <div className="w-7 h-7 rounded-full bg-jus-petroleum text-white flex items-center justify-center shadow-sm">
          <Bot className="w-4 h-4" />
        </div>
        <span className="text-[11px] mt-1">Chat Bot</span>
      </Link>

      <Link
        href="/app/perfil"
        className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-1 transition-all ${
          isProfile
            ? "text-jus-petroleum font-bold scale-105"
            : "text-jus-darkgray hover:text-jus-petroleum font-normal"
        }`}
      >
        <User className={`w-5 h-5 ${isProfile ? "stroke-[2.5px]" : "stroke-[1.75px]"}`} />
        <span className="text-[11px] mt-1">Perfil</span>
      </Link>
    </nav>
  );
};
