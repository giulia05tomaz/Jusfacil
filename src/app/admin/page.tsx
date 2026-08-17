"use client";

import { useEffect, useState } from "react";
import { Scale, ShieldCheck, TicketCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/firebase/authContext";
import { assignLawyer, getAdminStats, getApprovedLawyers, getCasesAwaitingAssignment, getPendingLawyers, getSupportTicketsForAdmin, reviewLawyer } from "@/lib/firebase/services";
import { getFriendlyError } from "@/lib/errors";
import type { LegalCase, SupportTicket, UserProfile } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const STAT_CARDS = [
  { key: "users", label: "Usuários", Icon: Users },
  { key: "cases", label: "Casos", Icon: Scale },
  { key: "pendingLawyers", label: "Advogados pendentes", Icon: ShieldCheck },
] as const;

export default function AdminPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ users: 0, cases: 0, pendingLawyers: 0, reviewCases: 0 });
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [approved, setApproved] = useState<UserProfile[]>([]);
  const [reviewCases, setReviewCases] = useState<LegalCase[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    try {
      const [nextStats, nextPending, nextApproved, nextCases, nextTickets] = await Promise.all([getAdminStats(), getPendingLawyers(), getApprovedLawyers(), getCasesAwaitingAssignment(), getSupportTicketsForAdmin()]);
      setStats(nextStats); setPending(nextPending); setApproved(nextApproved); setReviewCases(nextCases); setTickets(nextTickets); setErrorMessage("");
    } catch (error) { setErrorMessage(getFriendlyError(error)); }
  };
  useEffect(() => {
    // The first read is asynchronous; state updates occur only after Firebase resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const decide = async (lawyer: UserProfile, status: "APPROVED" | "REJECTED") => {
    if (!profile) return;
    const reason = status === "REJECTED" ? window.prompt("Informe o motivo da recusa:")?.trim() : undefined;
    if (status === "REJECTED" && !reason) return;
    await reviewLawyer(lawyer.uid, status, profile.uid, reason);
    await load();
  };

  return <div className="space-y-8"><div><h1 className="text-2xl font-serif font-bold text-jus-petroleum">Administração</h1><p className="text-sm text-slate-500">Aprovação profissional, atribuição explícita e visão operacional.</p></div>{errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{errorMessage}</p>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{STAT_CARDS.map(({ key, label, Icon }) => <Card key={key} className="p-5"><Icon className="mb-3 h-5 w-5 text-jus-caramel" /><p className="text-2xl font-bold text-jus-petroleum">{stats[key]}</p><p className="text-xs text-slate-500">{label}</p></Card>)}<Card className="p-5"><TicketCheck className="mb-3 h-5 w-5 text-jus-caramel" /><p className="text-2xl font-bold text-jus-petroleum">{tickets.filter((ticket) => ticket.status === "OPEN").length}</p><p className="text-xs text-slate-500">Chamados</p></Card></div>
    <Card className="space-y-4 p-6"><h2 className="font-bold text-jus-petroleum">Advogados pendentes</h2>{pending.length === 0 ? <p className="text-sm text-slate-500">Nenhum cadastro pendente.</p> : pending.map((lawyer) => <div key={lawyer.uid} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{lawyer.fullName}</p><p className="text-xs text-slate-500">OAB {lawyer.oabNumber}/{lawyer.oabState}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => void decide(lawyer, "APPROVED")}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => void decide(lawyer, "REJECTED")}>Recusar</Button></div></div>)}</Card>
    <Card className="space-y-4 p-6"><h2 className="font-bold text-jus-petroleum">Casos aguardando atribuição</h2>{reviewCases.filter((item) => !item.assignedLawyerId).map((legalCase) => <div key={legalCase.caseId} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_260px_auto]"><div><p className="font-semibold">{legalCase.title}</p><p className="text-xs text-slate-500">{legalCase.humanReviewReason || "Revisão humana indicada"}</p></div><select aria-label={`Advogado para ${legalCase.caseId}`} value={assignments[legalCase.caseId] || ""} onChange={(event) => setAssignments((current) => ({ ...current, [legalCase.caseId]: event.target.value }))} className="rounded-xl border p-2 text-sm"><option value="">Selecione um advogado aprovado</option>{approved.map((lawyer) => <option key={lawyer.uid} value={lawyer.uid}>{lawyer.fullName}</option>)}</select><Button size="sm" disabled={!assignments[legalCase.caseId]} onClick={async () => { const lawyer = approved.find((item) => item.uid === assignments[legalCase.caseId]); if (lawyer) { await assignLawyer(legalCase.caseId, lawyer); await load(); } }}>Atribuir</Button></div>)}</Card>
  </div>;
}
