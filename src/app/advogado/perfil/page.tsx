"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/firebase/authContext";
import { updateUserProfile, uploadUserAvatar } from "@/lib/firebase/services";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle,
  Clock3,
  Ban,
  LogOut,
  Camera,
  KeyRound,
  Loader2,
} from "lucide-react";

const lawyerStatusPresentation = {
  APPROVED: {
    label: "Aprovado",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
  },
  PENDING: {
    label: "Cadastro em análise",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  REJECTED: {
    label: "Não aprovado",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: Ban,
  },
  SUSPENDED: {
    label: "Suspenso",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: Ban,
  },
} as const;

export default function LawyerProfilePage() {
  const { profile, logout, refreshProfile, resetPassword, devMode } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [cpf, setCpf] = useState(profile?.cpf || "");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const status = lawyerStatusPresentation[profile?.lawyerStatus || "PENDING"];
  const StatusIcon = status.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      await updateUserProfile(profile.uid, { fullName, phone, cpf });
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    setResetSending(true);
    setResetSuccess(false);
    setError("");
    try {
      await resetPassword(profile.email);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 5000);
    } catch {
      setError("Não foi possível enviar o e-mail de redefinição de senha.");
    } finally {
      setResetSending(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    setError("");
    try {
      await uploadUserAvatar(profile.uid, file);
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível atualizar a foto de perfil.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Profile Card */}
      <Card className="-mx-1 bg-white rounded-[24px] p-5 sm:mx-0 sm:p-8 shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-slate-100 space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#002B43] text-center">
          Perfil
        </h1>

        {/* Avatar Centralizado com Badge de Edição Caramelo (#C08A4E) */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <div className="w-28 h-28 sm:w-24 sm:h-24 rounded-full bg-[#002B43] text-white flex items-center justify-center text-3xl font-bold font-serif shadow-md border-4 border-white overflow-hidden">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{fullName ? fullName.charAt(0).toUpperCase() : "A"}</span>
              )}
            </div>

            <label
              htmlFor="avatar-input"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#C08A4E] hover:bg-[#a5743e] text-white flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95"
              title="Alterar foto"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              <input
                id="avatar-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
          </div>

          <div className="w-full min-w-0 text-center">
            <h2 className="max-w-full break-words text-xl font-bold text-[#202020]">{fullName || "Advogado"}</h2>
            <p className="break-all text-xs text-[#6E7580] mt-0.5">{profile?.email}</p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OAB {profile?.oabNumber || "—"}/{profile?.oabState || "BR"}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${status.className}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{status.label}</span>
            </span>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-[14px] flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Perfil profissional atualizado com sucesso!</span>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-[14px] flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{devMode ? "Redefinição simulada no modo de desenvolvimento." : `E-mail de redefinição de senha enviado para ${profile?.email}!`}</span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-[14px]">
            {error}
          </p>
        )}

        {/* Formulário de Edição */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Input
            id="adv-fullname"
            label="Nome Completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User className="w-4 h-4 text-slate-400" />}
            required
          />

          <Input
            id="adv-email"
            label="E-mail"
            value={profile?.email || ""}
            disabled
            icon={<Mail className="w-4 h-4 text-slate-400" />}
            helperText="O e-mail é vinculado à sua conta institucional e não pode ser alterado aqui."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="adv-phone"
              label="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              icon={<Phone className="w-4 h-4 text-slate-400" />}
              placeholder="(11) 99999-9999"
            />
            <Input
              id="adv-cpf"
              label="CPF"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1.5">
                Número OAB
              </label>
              <input
                type="text"
                value={profile?.oabNumber || ""}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-xs text-slate-600 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1.5">
                UF OAB
              </label>
              <input
                type="text"
                value={profile?.oabState || ""}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] p-3 text-xs text-slate-600 font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full h-12 rounded-[14px] bg-[#002B43] hover:bg-[#003A58] text-white font-semibold text-xs sm:text-sm shadow-sm"
              disabled={saving}
            >
              {saving ? "Salvando alterações..." : "Salvar alterações"}
            </Button>
          </div>
        </form>

        {/* Alterar Senha via Firebase Auth */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800 block">Segurança da Conta</span>
            <span className="text-[11px] text-slate-500">
              Receba um link seguro para redefinir sua senha
            </span>
          </div>

          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetSending}
            className="text-xs font-semibold text-[#002B43] hover:underline flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{resetSending ? "Enviando..." : "Alterar senha"}</span>
          </button>
        </div>

        {/* Botão Sair da Conta */}
        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-3 rounded-[14px] border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
