"use client";

import Link from "next/link";
import { FlaskConical, RotateCcw } from "lucide-react";
import { UI_DEV_MODE } from "@/lib/devMode";
import { resetDevStore } from "@/lib/dev/mockStore";

export function DevModeBanner() {
  if (!UI_DEV_MODE) return null;

  const handleReset = () => {
    resetDevStore();
    window.location.reload();
  };

  return (
    <div className="sticky top-0 z-30 w-full max-w-full border-b border-amber-300 bg-amber-50 text-amber-950 lg:top-16">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-1.5 px-3 py-1.5 text-[10px] leading-tight sm:items-center sm:gap-2 sm:px-6 sm:py-2 sm:text-xs lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-1.5 font-semibold sm:items-center sm:gap-2">
          <FlaskConical className="h-3.5 w-3.5 flex-shrink-0 text-amber-700 sm:h-4 sm:w-4" />
          <span className="min-w-0 break-words">AMBIENTE DE DESENVOLVIMENTO — dados simulados; Firebase e OpenAI não são usados.</span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pl-5 sm:w-auto sm:pl-0">
          <Link href="/" className="font-semibold underline underline-offset-2 hover:text-[#002B43]">
            Trocar perfil
          </Link>
          <button type="button" onClick={handleReset} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-[#002B43]">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar dados demo
          </button>
        </div>
      </div>
    </div>
  );
}
