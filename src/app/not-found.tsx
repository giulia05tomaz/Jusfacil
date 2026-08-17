import React from "react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md text-center space-y-4 border border-slate-200">
        <h2 className="text-2xl font-bold text-[#002B43]">Página Não Encontrada (404)</h2>
        <p className="text-xs text-slate-500">
          A página que você está procurando não existe ou foi movida.
        </p>
        <a
          href="/login"
          className="inline-block px-5 py-2.5 bg-[#002B43] text-white text-xs font-bold rounded-xl hover:bg-[#001D2E] transition-colors"
        >
          Voltar para o Início
        </a>
      </div>
    </div>
  );
}
