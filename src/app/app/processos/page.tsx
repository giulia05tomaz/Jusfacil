"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import {
  Scale,
  Plus,
  ArrowRight,
  Search,
  Filter,
  FolderKanban,
  UserCheck,
  Calendar,
} from "lucide-react";

export default function CitizenProcessosPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      if (profile?.uid) {
        try {
          const userCases = await getUserCases(profile.uid, "CITIZEN");
          setCases(userCases);
        } catch (error) {
          console.error("Error loading cases:", error);
        } finally {
          setLoading(false);
        }
      }
    }
    loadData();
  }, [profile]);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.legalArea && c.legalArea.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.courtProcessNumber && c.courtProcessNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && c.status === statusFilter;
  });

  const formatCaseNumber = (c: LegalCase) => {
    if (c.courtProcessNumber) return c.courtProcessNumber;
    return c.caseId;
  };

  const formatDate = (dateValue: unknown) => {
    if (!dateValue) return "";
    const d = new Date(dateValue as string | number | Date);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-jus-petroleum">
            Meus Casos
          </h1>
          <p className="text-xs sm:text-sm text-jus-text-muted mt-1">
            Gerencie e acompanhe todos os seus atendimentos e processos jurídicos
          </p>
        </div>

        <Link href="/app/processos/novo" className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            className="w-full shadow-sm sm:w-auto"
          >
            Abrir Novo Caso
          </Button>
        </Link>
      </div>

      {/* Filter and Search Controls */}
      <Card className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative min-w-0 flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por título, protocolo, número judicial ou área..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-jus-petroleum focus:bg-white transition-colors"
          />
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-jus-petroleum"
          >
            <option value="ALL">Todos os Status ({cases.length})</option>
            <option value="TRIAGEM">Em Triagem</option>
            <option value="PREPARANDO_MINUTA">Preparando Minuta</option>
            <option value="MINUTA_APROVADA">Minuta Aprovada</option>
            <option value="ENCAMINHADO_ADVOGADO">Encaminhado ao Advogado</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluídos</option>
          </select>
        </div>
      </Card>

      {/* Cases Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredCases.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={searchTerm ? "Nenhum caso encontrado para a busca" : "Você ainda não possui casos"}
          description={
            searchTerm
              ? "Tente ajustar os filtros ou os termos pesquisados."
              : "Inicie um atendimento guiado pelo JurisBot para analisar sua situação e criar sua petição inicial."
          }
          actionText={searchTerm ? undefined : "Abrir Novo Caso"}
          onAction={searchTerm ? undefined : () => router.push("/app/processos/novo")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredCases.map((c) => (
            <Card
              key={c.caseId}
              hoverable
              className="min-w-0 p-4 sm:p-6 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="max-w-full break-words text-xs font-bold text-jus-petroleum bg-jus-petroleum/10 px-2.5 py-1 rounded-lg">
                    {formatCaseNumber(c)}
                  </span>
                  <Badge status={c.status} />
                </div>

                <div className="space-y-1">
                  <h2 className="text-base font-bold text-jus-petroleum line-clamp-1">
                    {c.title || "Atendimento sem título"}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-jus-caramel font-semibold">
                    <Scale className="w-3.5 h-3.5" />
                    <span>{c.legalArea || c.category || "Direito do Consumidor"}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-1">
                    {c.summary || "Sem resumo disponível no momento."}
                  </p>
                </div>

                {c.assignedLawyerName && (
                  <div className="min-w-0 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-700 flex items-start gap-2">
                    <UserCheck className="w-4 h-4 text-jus-petroleum flex-shrink-0" />
                    <span className="min-w-0 break-words">
                      Advogado Responsável: <strong>{c.assignedLawyerName}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(c.updatedAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/app/processos/${c.caseId}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Abrir Caso
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
