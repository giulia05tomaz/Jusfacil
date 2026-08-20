"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/lib/firebase/services";
import { NotificationItem } from "@/types";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, Search, Trash2, CheckCheck, ArrowRight } from "lucide-react";

export default function CitizenNotificationsPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeToNotifications(
      profile.uid,
      setNotifications,
      (error) => setErrorMessage(error.message)
    );
  }, [profile]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const readCount = useMemo(
    () => notifications.filter((n) => n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // 1. Filtro de status
      if (filterTab === "UNREAD" && n.read) return false;
      if (filterTab === "READ" && !n.read) return false;

      // 2. Filtro de pesquisa
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(term);
      const matchMsg = n.message?.toLowerCase().includes(term);
      return matchTitle || matchMsg;
    });
  }, [notifications, filterTab, searchTerm]);

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markNotificationAsRead(n.notificationId).catch(() => undefined);
    }
    if (n.caseId) {
      router.push(`/app/processos/${n.caseId}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteNotification(deleteTargetId);
      setDeleteTargetId(null);
    } catch (err) {
      console.error("Erro ao excluir notificação:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    await markAllNotificationsAsRead(notifications).catch(() => undefined);
  };

  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto space-y-5 animate-fadeIn pb-12">
      {/* Header com fundo cinza/lilás suave fiel ao Figma (Página 13) */}
      <div className="-mx-4 -mt-4 space-y-4 bg-[#E8E6EC] px-5 py-6 shadow-sm sm:mx-0 sm:mt-0 sm:rounded-[18px] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 sm:justify-start">
            <div className="hidden w-10 h-10 rounded-full bg-[#002B43] text-white sm:flex items-center justify-center shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-medium text-slate-700 sm:text-2xl sm:font-bold sm:font-serif sm:text-[#002B43]">
              Notificações
            </h1>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="hidden w-full text-xs font-semibold text-[#002B43] hover:text-[#C08A4E] transition-colors sm:flex items-center justify-center gap-1.5 cursor-pointer bg-white/60 hover:bg-white px-3 py-1.5 rounded-full sm:w-auto"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Marcar todas como lidas</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><Input id="search-notifications-input" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar Notificação" className="h-11 rounded-[10px] border-0 bg-white text-sm shadow-sm" /></div>
          <button type="button" aria-label="Pesquisar notificações" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] bg-white text-slate-700 shadow-sm"><Search className="h-6 w-6" /></button>
        </div>

        {/* Contadores e Abas / Filtros */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto pt-1 pb-1">
          <button
            type="button"
            onClick={() => setFilterTab("ALL")}
            className={`hidden flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer sm:block ${
              filterTab === "ALL"
                ? "bg-[#002B43] text-white shadow-sm"
                : "bg-white/70 text-[#002B43] hover:bg-white"
            }`}
          >
            Todas ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("UNREAD")}
            className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterTab === "UNREAD"
                ? "bg-[#002B43] text-white shadow-sm"
                : "bg-white/70 text-[#002B43] hover:bg-white"
            }`}
          >
            <span>Não lidas</span>
            <span className="bg-[#C08A4E] text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {unreadCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("READ")}
            className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterTab === "READ"
                ? "bg-[#002B43] text-white shadow-sm"
                : "bg-white/70 text-[#002B43] hover:bg-white"
            }`}
          >
            Visualizadas ({readCount})
          </button>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      {/* Lista de Notificações com estilo Figma (#E7E5EB) */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-[18px] p-8 text-center">
            <EmptyState
              icon={Bell}
              title="Nenhuma notificação encontrada"
              description={
                searchTerm
                  ? "Nenhum resultado para os termos pesquisados."
                  : "Você não possui notificações nesta categoria no momento."
              }
            />
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isUnread = !n.read;
            const dateStr = n.createdAt
              ? new Date(n.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div
                key={n.notificationId}
                className="min-w-0 bg-[#E7E5EB] rounded-[10px] p-4 transition-all hover:shadow-md flex items-start justify-between gap-3 group sm:rounded-[16px]"
              >
                {/* Clique no corpo abre caso */}
                <div
                  className="flex min-w-0 items-start gap-3 flex-1 cursor-pointer"
                  onClick={() => void handleNotificationClick(n)}
                >
                  {/* Indicador Circular */}
                  <div className="pt-1 flex-shrink-0">
                    <span
                      className={`block w-3 h-3 rounded-full ${
                        isUnread ? "bg-[#002B43] ring-2 ring-[#002B43]/20 animate-pulse" : "bg-slate-400"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-xs sm:text-sm ${
                          isUnread ? "font-bold text-[#002B43]" : "font-medium text-slate-700"
                        }`}
                      >
                        {n.title}
                      </h3>
                    </div>
                    <p className="break-words text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 block pt-0.5">{dateStr}</span>
                  </div>
                </div>

                {/* Ações: Ver & Excluir */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {n.caseId && (
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(n)}
                      className="p-1.5 text-[#002B43] hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                      title="Abrir Caso"
                      aria-label="Abrir Caso"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(n.notificationId);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                    title="Excluir notificação"
                    aria-label="Excluir notificação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ConfirmDialog para Excluir Notificação */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir esta notificação?"
        description="Esta ação removerá a notificação permanentemente da sua lista."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
