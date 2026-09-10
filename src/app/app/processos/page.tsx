"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/authContext";
import { getUserCases } from "@/lib/firebase/services";
import { LegalCase } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Scale, Plus, ArrowRight, Search, Filter } from "lucide-react";

export default function CitizenProcessosPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      if (profile?.uid) setCases(await getUserCases(profile.uid, "CITIZEN"));
    }
    loadData();
  }, [profile]);

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseId.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "CONCLUIDO") return matchesSearch && c.status === "CONCLUIDO";
    return matchesSearch && c.status !== "CONCLUIDO";
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Meus Processos</h1>
          <p className="text-xs text-slate-500">Gerencie e acompanhe todos os seus casos cadastrados no JusFácil</p>
        </div>

        <Link href="/app/processos/novo">
          <Button variant="secondary" size="md" icon={<Plus className="w-4 h-4" />}>
            Abrir Novo Processo
          </Button>
        </Link>
      </div>

      {/* Filter and Search Controls */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por título, protocolo ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-jus-petroleum"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-jus-petroleum"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Em Andamento</option>
            <option value="CONCLUIDO">Concluídos</option>
          </select>
        </div>
      </Card>

      {/* Cases Grid */}
      {filteredCases.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Scale className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum processo encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Você ainda não criou nenhum processo com estes filtros. Inicie uma triagem agora mesmo com o JurisBot.
          </p>
          <div className="pt-2">
            <Link href="/app/processos/novo">
              <Button variant="primary" size="sm">
                Abrir Novo Caso
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map((c) => (
            <Card key={c.caseId} hoverable className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-jus-caramel-contrast uppercase tracking-wider">
                    {c.category}
                  </span>
                  <Badge status={c.status} />
                </div>

                <h3 className="text-sm font-bold text-jus-petroleum line-clamp-1">{c.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{c.summary}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">
                  Atualizado em {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                </span>

                <Link href={`/app/jurisbot/${c.caseId}`}>
                  <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                    Acessar Caso
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
