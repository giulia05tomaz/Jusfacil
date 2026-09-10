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

  const isLawyer = profile?.role === "LAWYER";

  if (isLawyer) {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex justify-around items-center">
        <Link
          href="/advogado/casos"
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            pathname === "/advogado/casos" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Home</span>
        </Link>

        <Link
          href="/advogado/atualizacoes"
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            pathname === "/advogado/atualizacoes" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Dashboard</span>
        </Link>

        <Link
          href="/app/suporte"
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            pathname === "/app/suporte" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
          }`}
        >
          <Headphones className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Support</span>
        </Link>

        <Link
          href="/advogado/perfil"
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            pathname === "/advogado/perfil" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Perfil</span>
        </Link>
      </nav>
    );
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex justify-around items-center">
      <Link
        href="/app"
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
          pathname === "/app" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Home</span>
      </Link>

      <Link
        href="/app/processos"
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
          pathname === "/app/processos" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Dashboard</span>
      </Link>

      <Link
        href="/app/processos/novo"
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
          pathname.includes("/jurisbot") || pathname === "/app/processos/novo"
            ? "text-jus-caramel-contrast font-bold"
            : "text-slate-600 hover:text-jus-petroleum"
        }`}
      >
        <div className="w-6 h-6 rounded-full bg-jus-petroleum text-white flex items-center justify-center -mt-1 shadow">
          <Bot className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5">Chat Bot</span>
      </Link>

      <Link
        href="/app/perfil"
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
          pathname === "/app/perfil" ? "text-jus-petroleum font-bold" : "text-slate-600 hover:text-jus-petroleum"
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Perfil</span>
      </Link>
    </nav>
  );
};
