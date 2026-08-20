"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Search, Scale, FileText, ChevronRight } from "lucide-react";

type FilterType = "ALL" | "AGUARDANDO_REVISAO" | "EM_ANDAMENTO" | "CONCLUIDO";

export default function LawyerCasesListPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    async function load() {
      if (!profile?.uid || profile.lawyerStatus !== "APPROVED") {
        setLoading(false);
        return;
      }

      try {
        const assigned = await getUserCases(profile.uid, "LAWYER");
        setCases(assigned);
      } catch (err) {
        console.error("Error loading assigned cases:", err);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [profile]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch =
        search === "" ||
        c.caseId.toLowerCase().includes(search.toLowerCase()) ||
        (c.title && c.title.toLowerCase().includes(search.toLowerCase())) ||
        (c.category && c.category.toLowerCase().includes(search.toLowerCase())) ||
        (c.summary && c.summary.toLowerCase().includes(search.toLowerCase())) ||
        (c.citizenName && c.citizenName.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filter === "ALL") return true;
      if (filter === "AGUARDANDO_REVISAO") {
        return (
          c.status === "AGUARDANDO_REVISAO" ||
          c.status === "REVISAO_HUMANA" ||
          c.requiresHumanReview === true
        );
      }
      if (filter === "EM_ANDAMENTO") {
        return (
          c.status === "EM_ANDAMENTO" ||
          c.status === "ENCAMINHADO_ADVOGADO" ||
          c.status === "PREPARANDO_MINUTA" ||
          c.status === "AJUSTANDO_MINUTA" ||
          c.status === "MINUTA_APROVADA" ||
          c.status === "PRONTO_PARA_PROTOCOLO" ||
          c.status === "COLETANDO_INFORMACOES" ||
          c.status === "COLETANDO_EVIDENCIAS" ||
          c.status === "ANALISANDO"
        );
      }
      if (filter === "CONCLUIDO") {
        return c.status === "CONCLUIDO";
      }

      return true;
    });
  }, [cases, search, filter]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="-mx-4 -mt-4 bg-[#E8E6EC] px-5 py-6 text-center sm:mx-0 sm:mt-0 sm:bg-transparent sm:p-0 sm:text-left">
        <h1 className="text-xl font-medium text-slate-700 sm:text-3xl sm:font-bold sm:text-[#002B43] sm:tracking-tight">
          Meus casos
        </h1>
        <p className="hidden text-xs text-[#6E7580] mt-1 sm:block">
          Acompanhe e gerencie todos os casos sob sua responsabilidade técnica
        </p>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Pesquisar caso"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-w-0 flex-1 bg-white border border-slate-200 rounded-[10px] px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-[#002B43] focus:ring-1 focus:ring-[#002B43] shadow-sm transition-all sm:rounded-[14px] sm:pl-11"
        />
        <button type="button" aria-label="Pesquisar casos" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] bg-white text-slate-700 shadow-sm"><Search className="h-6 w-6" /></button>
      </div>

      {/* Filter Tabs */}
      <div className="hidden max-w-full items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filter === "ALL"
              ? "bg-[#002B43] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setFilter("AGUARDANDO_REVISAO")}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filter === "AGUARDANDO_REVISAO"
              ? "bg-[#002B43] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Aguardando revisão
        </button>
        <button
          type="button"
          onClick={() => setFilter("EM_ANDAMENTO")}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filter === "EM_ANDAMENTO"
              ? "bg-[#002B43] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Em andamento
        </button>
        <button
          type="button"
          onClick={() => setFilter("CONCLUIDO")}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            filter === "CONCLUIDO"
              ? "bg-[#002B43] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Concluídos
        </button>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="bg-white rounded-[18px] p-8 text-center border border-slate-100">
            <EmptyState
              icon={Scale}
              title={search ? "Nenhum caso encontrado" : "Você ainda não possui casos atribuídos."}
              description={
                search
                  ? "Tente buscar com outros termos."
                  : "Quando novos casos forem atribuídos ao seu perfil, eles serão exibidos aqui."
              }
            />
          </div>
        ) : (
          filteredCases.map((c) => {
            const summaryText = c.summary || c.originalStory || "";

            return (
              <Link
                key={c.caseId}
                href={`/advogado/casos/${c.caseId}`}
                className="block w-full min-w-0 max-w-full bg-[#E7E5EB] rounded-[10px] p-4 sm:p-5 transition-all hover:shadow-md hover:bg-[#E2DFE7] group sm:rounded-[16px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="break-words text-sm font-bold text-[#002B43] group-hover:underline">
                        Caso {c.caseId}
                      </span>
                      <span className="hidden sm:inline"><Badge status={c.status} /></span>
                    </div>

                    {c.category && (
                      <span className="inline-block text-[11px] font-medium text-slate-600 bg-white/60 px-2 py-0.5 rounded-md">
                        {c.category}
                      </span>
                    )}

                    {summaryText && (
                      <p className="text-xs text-[#4A4A4A] line-clamp-2 leading-relaxed pt-0.5">
                        {summaryText}
                      </p>
                    )}

                    {c.citizenName && (
                      <p className="text-[11px] text-slate-500 pt-1">
                        Cidadão: <span className="font-medium text-slate-700">{c.citizenName}</span>
                      </p>
                    )}

                    <span className="text-[10px] text-slate-500 block pt-1">
                      Última atualização: {formatDate(c.updatedAt || c.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 group-hover:text-[#002B43] transition-colors self-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
