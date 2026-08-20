"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/firebase/authContext";
import { createSupportTicket, getUserSupportTickets } from "@/lib/firebase/services";
import { SupportTicket } from "@/types";
import { Headphones, Send, Loader2, MoreHorizontal, Minus, X, ThumbsUp, ThumbsDown } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "SYSTEM" | "USER";
  text: string;
  time: string;
}

export default function LawyerSupportPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      sender: "SYSTEM",
      text: "Olá! Como podemos ajudar?\n\nEnvie sua dúvida e ela será registrada em nossa central de suporte.",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTickets() {
      if (profile?.uid) {
        try {
          const userTickets = await getUserSupportTickets(profile.uid);
          setTickets(userTickets);
        } catch {
          // Ignore
        }
      }
    }
    void loadTickets();
  }, [profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending || !profile?.uid) return;

    const userMessage = inputText.trim();
    setInputText("");
    setSending(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Add user message to UI
    const userMsgObj: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "USER",
      text: userMessage,
      time: timeStr,
    };
    setMessages((prev) => [...prev, userMsgObj]);

    try {
      // Save support ticket in Firestore
      await createSupportTicket({
        userId: profile.uid,
        category: "DÚVIDA_GERAL",
        subject: userMessage.slice(0, 50),
        message: userMessage,
      });

      // System acknowledgment
      const sysResponse: ChatMessage = {
        id: "sys-" + Date.now(),
        sender: "SYSTEM",
        text: "Sua solicitação foi registrada com sucesso. Acompanhe esta central para futuras atualizações.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, sysResponse]);
    } catch {
      const errResponse: ChatMessage = {
        id: "err-" + Date.now(),
        sender: "SYSTEM",
        text: "Não foi possível registrar seu chamado no momento. Por favor, tente novamente mais tarde.",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errResponse]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="-mx-4 -mt-4 flex h-[calc(100%+1rem)] w-[calc(100%+2rem)] min-w-0 max-w-none flex-col space-y-0 overflow-hidden animate-fadeIn pb-0 sm:mx-auto sm:mt-0 sm:w-full sm:max-w-2xl sm:space-y-4 sm:pb-16 lg:h-auto lg:overflow-visible">
      <div className="bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 text-slate-500"><MoreHorizontal className="h-6 w-6" /><span className="text-base font-medium">Suporte</span><div className="flex items-center gap-2"><Minus className="h-5 w-5" /><X className="h-5 w-5" /></div></div>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-jus-petroleum text-white"><Headphones className="h-5 w-5" /></div><span className="text-base font-medium text-slate-600">Suporte</span></div><div className="flex gap-4 text-slate-500"><ThumbsUp className="h-5 w-5" /><ThumbsDown className="h-5 w-5" /></div></div>
      </div>
      {/* Header Centralizado */}
      <div className="hidden bg-white rounded-[18px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100 items-center gap-3 lg:flex">
        <div className="w-11 h-11 rounded-full bg-[#002B43] text-white flex items-center justify-center shadow-sm">
          <Headphones className="w-5 h-5 text-[#C08A4E]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#002B43]">Suporte</h1>
          <p className="text-xs text-[#6E7580]">Central de atendimento ao profissional</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-200 bg-white shadow-sm sm:h-[520px] sm:flex-none sm:rounded-[18px] sm:border sm:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        {/* Messages Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#EFEFEF]">
          {messages.map((m) => {
            const isUser = m.sender === "USER";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                className={`min-w-0 max-w-[85%] break-words rounded-[10px] p-4 text-xs sm:text-sm leading-relaxed shadow-sm whitespace-pre-wrap sm:rounded-[16px] ${
                    isUser
                      ? "bg-[#002B43] text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Composer Form */}
        <form
          onSubmit={handleSendMessage}
          className="flex w-full min-w-0 items-center gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"
        >
          <input
            type="text"
            placeholder="Digite sua mensagem..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            className="w-full min-w-0 flex-1 border-0 bg-white px-2 py-3 text-xs sm:rounded-[14px] sm:border sm:border-slate-200 sm:bg-slate-50 sm:px-4 sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#002B43] focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#002B43] px-0 text-white shadow-sm transition-all hover:bg-[#003A58] disabled:bg-slate-300 sm:h-11 sm:w-auto sm:rounded-[14px] sm:px-5"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span className="sr-only sm:not-sr-only">Enviar</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      <footer className="bg-white py-3 text-center text-xs text-slate-500 lg:hidden">Desenvolvido por <strong className="text-slate-700">Webtech</strong></footer>

      {/* Histórico prévio se houver */}
      {tickets.length > 0 && (
        <div className="hidden bg-white rounded-[18px] p-4 sm:p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100 space-y-3 lg:block">
          <h3 className="text-xs font-bold text-[#002B43] uppercase tracking-wide">
            Chamados Registrados Anteriormente
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {tickets.slice(0, 3).map((t) => (
              <div key={t.ticketId} className="py-2 flex items-center justify-between gap-2">
                <span className="text-slate-700 truncate max-w-[75%]">{t.subject}</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {t.status === "OPEN" ? "Aberto" : "Resolvido"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
