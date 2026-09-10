"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/firebase/authContext";
import { updateUserProfile } from "@/lib/firebase/services";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, Mail, Phone, FileText, CheckCircle, LogOut, Lock } from "lucide-react";
import { CpfSchema, PhoneSchema, UsernameSchema } from "@/lib/validation/profile";

export default function UserProfilePage() {
  const { profile, logout, refreshProfile, changePassword } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [email] = useState(profile?.email || "");
  const [cpf, setCpf] = useState(profile?.cpf || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [username, setUsername] = useState(profile?.username || "");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess(false);
    setErrorMessage("");

    if (cpf && !CpfSchema.safeParse(cpf).success) { setErrorMessage("CPF inválido."); setSaving(false); return; }
    if (phone && !PhoneSchema.safeParse(phone).success) { setErrorMessage("Telefone inválido."); setSaving(false); return; }
    if (username && !UsernameSchema.safeParse(username).success) { setErrorMessage("Nome de usuário inválido."); setSaving(false); return; }

    try {
      await updateUserProfile(profile.uid, { fullName, cpf, phone, username });
      await refreshProfile();
      setSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível atualizar o perfil.");
    } finally { setSaving(false); }

    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-jus-petroleum">Meu Perfil</h1>
          <p className="text-xs text-slate-500">Gerencie suas informações pessoais e de contato</p>
        </div>
      </div>

      <Card className="space-y-6 p-6 sm:p-8">
        {/* Profile Avatar Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-full bg-jus-petroleum text-white flex items-center justify-center text-2xl font-bold font-serif shadow-md">
            {fullName ? fullName.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{fullName || "Usuário Cidadão"}</h2>
            <p className="text-xs text-slate-500">{email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Conta Cidadão Ativa
            </span>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}
        {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome Completo"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="E-mail"
            type="email"
            value={email}
            icon={<Mail className="w-4 h-4" />}
            disabled
            helperText="O e-mail principal da conta não pode ser alterado diretamente."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="CPF"
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              icon={<FileText className="w-4 h-4" />}
            />

            <Input
              label="Telefone / WhatsApp"
              type="text"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              icon={<Phone className="w-4 h-4" />}
            />
          </div>

          <Input
            label="Nome de Usuário"
            type="text"
            placeholder="@usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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

        <form onSubmit={async (event) => { event.preventDefault(); setErrorMessage(""); if (newPassword.length < 8) { setErrorMessage("A nova senha deve ter pelo menos 8 caracteres."); return; } try { await changePassword(newPassword); setNewPassword(""); setSuccess(true); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha. Faça login novamente."); } }} className="space-y-3 border-t border-slate-100 pt-5">
          <Input label="Nova senha" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} icon={<Lock className="h-4 w-4" />} helperText="O Firebase pode solicitar um login recente para esta alteração." />
          <Button type="submit" variant="outline" disabled={!newPassword}>Alterar senha</Button>
        </form>
      </Card>
    </div>
  );
}
