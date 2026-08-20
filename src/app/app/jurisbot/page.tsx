"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Ellipsis, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function JurisBotIntroPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] w-full min-w-0 max-w-full bg-[#F1F1F1] flex flex-col justify-between items-center pb-24 md:pb-12">
      {/* Header Centralizado */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-5 shadow-[0_2px_6px_rgba(0,0,0,0.10)] lg:hidden">
        <Ellipsis className="h-7 w-7 text-slate-500" aria-hidden="true" />
        <h1 className="text-xl font-medium text-slate-500">
          JurisBot
        </h1>
        <Minus className="h-6 w-6 text-slate-500" aria-hidden="true" />
      </header>

      {/* Container Central com Card */}
      <main className="w-full min-w-0 max-w-[532px] px-4 flex-1 flex flex-col items-center justify-center my-8">
        <div className="relative w-full min-w-0 max-w-[500px] bg-white rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] pt-20 pb-8 px-5 sm:px-8 text-center flex flex-col items-center mt-14">
          {/* Avatar Circular Sobrepondo o Topo */}
          <div className="absolute -top-16 w-32 h-32 rounded-full bg-white p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.14)] flex items-center justify-center border border-slate-100">
            <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-50 flex items-center justify-center">
              <Image
                src="/img/robo_logo.png"
                alt="JurisBot Avatar"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Badge Suave */}
          <div className="hidden items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7D6C4]/40 text-[#A8743A] text-xs font-semibold mb-4 lg:inline-flex">
            <Bot className="w-3.5 h-3.5" />
            <span>Assistente Digital Jurídico</span>
          </div>

          {/* Texto Institucional */}
          <p className="w-full max-w-md break-words text-base text-slate-500 leading-[1.9] mb-8 sm:text-lg lg:text-base lg:leading-relaxed lg:text-[#4A4A4A]">
            Olá! Eu sou o JurisBot, seu assistente jurídico digital aqui no aplicativo JusFácil. Fui desenvolvido para tornar a organização das informações e a criação de documentos iniciais para pequenas causas mais simples e acessível para todos.
          </p>

          {/* Botão de Ação */}
          <Link href="/app/processos/novo" className="w-full max-w-[310px]">
            <Button
              id="start-jurisbot-btn"
              variant="primary"
              className="w-full h-[54px] rounded-[18px] bg-[#002B43] hover:bg-[#003A58] text-white text-base font-semibold shadow-md flex items-center justify-center gap-2"
            >
              <span>Iniciar conversa</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-[#6E7580] py-4">
        Desenvolvido por Webtech
      </footer>
    </div>
  );
}
