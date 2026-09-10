"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/firebase/authContext";
import { updateUserProfile } from "@/lib/firebase/services";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, Mail, Phone, ShieldCheck, CheckCircle, Clock3, Ban, LogOut } from "lucide-react";

const lawyerStatusPresentation = {
  APPROVED: {
    label: "Aprovado para Revisões",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
  },
  PENDING: {
    label: "Cadastro em análise",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  REJECTED: {
    label: "Cadastro não aprovado",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: Ban,
  },
  SUSPENDED: {
    label: "Acesso suspenso",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: Ban,
  },
} as const;

export default function LawyerProfilePage() {
  const { profile, logout, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [email] = useState(profile?.email || "");
  const [oabNumber, setOabNumber] = useState(profile?.oabNumber || "");
  const [oabState, setOabState] = useState(profile?.oabState || "SP");
  const [phone, setPhone] = useState(profile?.phone || "");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const status = lawyerStatusPresentation[profile?.lawyerStatus || "PENDING"];
  const StatusIcon = status.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      await updateUserProfile(profile.uid, { fullName, phone });
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Perfil do Advogado</h1>
        <p className="text-xs text-slate-500">Credenciamento OAB e dados operacionais de revisão</p>
      </div>

      <Card className="space-y-6 p-6 sm:p-8">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-jus-caramel text-jus-petroleum flex items-center justify-center text-2xl font-bold font-serif shadow-md">
            {fullName ? fullName.charAt(0).toUpperCase() : "A"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{fullName || "Advogado"}</h2>
            <p className="text-xs text-slate-500">{email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="w-3 h-3" /> OAB {oabNumber}/{oabState}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${status.className}`}>
                <StatusIcon className="h-3 w-3" /> {status.label}
              </span>
            </div>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Perfil profissional atualizado com sucesso!</span>
          </div>
        )}

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome Completo do Advogado"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="E-mail Institucional"
            type="email"
            value={email}
            icon={<Mail className="w-4 h-4" />}
            disabled
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Input
                label="Inscrição OAB"
                type="text"
                value={oabNumber}
                onChange={(e) => setOabNumber(e.target.value)}
                disabled
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1.5">
                Seccional (UF)
              </label>
              <select
                value={oabState}
                onChange={(e) => setOabState(e.target.value)}
                disabled
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-2 text-sm text-slate-800 focus:outline-none focus:border-jus-petroleum"
              >
                {["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "GO", "DF"].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Telefone / Contato Profissional"
            type="text"
            placeholder="(11) 98888-8888"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            icon={<Phone className="w-4 h-4" />}
          />

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              className="text-red-600 hover:bg-red-50"
              icon={<LogOut className="w-4 h-4" />}
            >
              Sair da Conta
            </Button>

            <Button type="submit" variant="primary" loading={saving}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
