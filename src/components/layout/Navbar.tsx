"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Bell, LogOut, Scale, Menu, X } from "lucide-react";
import { subscribeToNotifications } from "@/lib/firebase/services";
import { countUnreadNotifications } from "@/lib/notifications/unread";

export const Navbar: React.FC = () => {
  const { profile, logout } = useAuth();
  const rawPathname = usePathname();
  const pathname = rawPathname || "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isLawyer = profile?.role === "LAWYER";
  const isAdmin = profile?.role === "ADMIN";

  useEffect(() => {
    if (!profile?.uid || profile.role !== "CITIZEN") return;
    return subscribeToNotifications(profile.uid, (items) => setUnreadCount(countUnreadNotifications(items)), () => setUnreadCount(0));
  }, [profile]);

  return (
    <header className="sticky top-0 z-40 bg-jus-petroleum text-white shadow-md border-b border-jus-petroleum-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href={isAdmin ? "/admin" : isLawyer ? "/advogado/casos" : "/app"} className="flex items-center gap-3 group">
          <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm group-hover:bg-white/20 transition-all">
            <Image
              src="/img/Logo.png"
              alt="JusFácil Logo"
              width={36}
              height={43}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl tracking-wider font-semibold text-white">
              JUSFÁCIL
            </span>
            <span className="text-[10px] text-jus-caramel-light font-medium tracking-widest uppercase">
              {isAdmin ? "Administração" : isLawyer ? "Portal do Advogado" : "Justiça Simples e Acessível"}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {isAdmin ? (
            <Link href="/admin" className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white">Painel administrativo</Link>
          ) : !isLawyer ? (
            <>
              <Link
                href="/app"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/app" ? "bg-white/15 text-white font-semibold" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                Início
              </Link>
              <Link
                href="/app/processos"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/app/processos") ? "bg-white/15 text-white font-semibold" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                Meus Processos
              </Link>
              <Link
                href="/app/processos/novo"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith("/app/jurisbot") ? "bg-jus-caramel text-jus-petroleum font-semibold shadow-sm" : "bg-jus-caramel/90 hover:bg-jus-caramel text-jus-petroleum"
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>Novo Caso</span>
              </Link>
              <Link
                href="/app/suporte"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/app/suporte" ? "bg-white/15 text-white font-semibold" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                Suporte
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/advogado/casos"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/advogado/casos") ? "bg-white/15 text-white font-semibold" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                Casos Atribuídos
              </Link>
              <Link
                href="/advogado/atualizacoes"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/advogado/atualizacoes" ? "bg-white/15 text-white font-semibold" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                Enviar Atualizações
              </Link>
            </>
          )}
        </nav>

        {/* User Right Profile & Controls */}
        <div className="hidden md:flex items-center gap-3">
          {!isLawyer && (
            <Link
              href="/app/notificacoes"
              className="p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-full transition-colors relative"
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span aria-label={`${unreadCount} notificações não lidas`} className="absolute -right-1 -top-1 min-w-4 rounded-full bg-jus-caramel px-1 text-center text-[9px] font-bold text-jus-petroleum ring-2 ring-jus-petroleum">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
          )}

          <div className="h-6 w-[1px] bg-white/20" />

          {profile ? (
            <div className="flex items-center gap-3">
              <Link
                href={isAdmin ? "/admin" : isLawyer ? "/advogado/perfil" : "/app/perfil"}
                className="flex items-center gap-2 py-1 px-2.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-jus-caramel text-jus-petroleum flex items-center justify-center font-bold text-sm shadow">
                  {profile.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                    {profile.fullName.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-slate-300">
                    {profile.role === "ADMIN" ? "Administrador" : profile.role === "LAWYER" ? `OAB ${profile.oabNumber || ""}` : "Cidadão"}
                  </span>
                </div>
              </Link>

              <button
                onClick={logout}
                className="p-2 text-slate-300 hover:text-red-300 hover:bg-white/10 rounded-full transition-colors"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 text-xs font-semibold bg-jus-caramel hover:bg-jus-caramel-hover text-jus-petroleum rounded-full transition-colors"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <div className="md:hidden bg-jus-petroleum-dark border-t border-white/10 px-4 py-4 space-y-2">
          {profile && (
            <div className="pb-3 border-b border-white/10 mb-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-jus-caramel text-jus-petroleum flex items-center justify-center font-bold text-base">
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{profile.fullName}</p>
                <p className="text-xs text-slate-300">{profile.email}</p>
              </div>
            </div>
          )}

          {!isLawyer ? (
            <>
              <Link
                href="/app"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Início
              </Link>
              <Link
                href="/app/processos"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Meus Processos
              </Link>
              <Link
                href="/app/processos/novo"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm font-semibold bg-jus-caramel text-jus-petroleum rounded-lg"
              >
                Abrir Novo Processo
              </Link>
              <Link
                href="/app/notificacoes"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Notificações
              </Link>
              <Link
                href="/app/suporte"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Suporte
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/advogado/casos"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Casos Atribuídos
              </Link>
              <Link
                href="/advogado/atualizacoes"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/10 rounded-lg"
              >
                Enviar Atualizações
              </Link>
            </>
          )}

          <div className="pt-2 border-t border-white/10">
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-white/10 rounded-lg flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
