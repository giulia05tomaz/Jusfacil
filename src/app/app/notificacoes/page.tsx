"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { markAllNotificationsAsRead, markNotificationAsRead, subscribeToNotifications } from "@/lib/firebase/services";
import { NotificationItem } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, Check, ArrowRight } from "lucide-react";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeToNotifications(profile.uid, setNotifications, (error) => setErrorMessage(error.message));
  }, [profile]);

  const markAllRead = async () => {
    await markAllNotificationsAsRead(notifications);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-jus-petroleum text-white rounded-2xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Central de Notificações</h1>
            <p className="text-xs text-slate-500">Atualizações em tempo real sobre seus Casos JusFácil</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={markAllRead} icon={<Check className="w-4 h-4" />}>
          Marcar Lidas
        </Button>
      </div>
      {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}

      <Card className="divide-y divide-slate-100 p-0 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Você não possui notificações recentes.</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.notificationId}
              className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                !n.read ? "bg-jus-caramel-50/50" : "bg-white"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-jus-caramel" />}
                  <h3 className="text-xs font-bold text-slate-800">{n.title}</h3>
                </div>
                <p className="text-xs text-slate-600">{n.message}</p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  {new Date(n.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>

              {n.caseId && (
                <Link href={`/app/jurisbot/${n.caseId}`} onClick={() => { if (!n.read) void markNotificationAsRead(n.notificationId); }}>
                  <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Ver
                  </Button>
                </Link>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
