"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/authContext";
import { updateUserProfile, uploadUserAvatar } from "@/lib/firebase/services";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  LogOut,
  Lock,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { CpfSchema, PhoneSchema, UsernameSchema } from "@/lib/validation/profile";

export default function UserProfilePage() {
  const { profile, logout, refreshProfile, changePassword } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [email] = useState(profile?.email || "");
  const [cpf, setCpf] = useState(profile?.cpf || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSuccess(false);
    setErrorMessage("");

    if (cpf && !CpfSchema.safeParse(cpf).success) {
      setErrorMessage("CPF inválido.");
      setSaving(false);
      return;
    }
    if (phone && !PhoneSchema.safeParse(phone).success) {
      setErrorMessage("Telefone inválido.");
      setSaving(false);
      return;
    }
    if (username && !UsernameSchema.safeParse(username).success) {
      setErrorMessage("Nome de usuário inválido.");
      setSaving(false);
      return;
    }

    try {
      await updateUserProfile(profile.uid, {
        fullName: fullName.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        username: username.trim(),
      });
      await refreshProfile();
      setSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar o perfil."
      );
    } finally {
      setSaving(false);
    }

    setTimeout(() => setSuccess(false), 3500);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;

    setUploadingAvatar(true);
    setErrorMessage("");
    try {
      const url = await uploadUserAvatar(profile.uid, file);
      setAvatarUrl(url);
      await refreshProfile();
      setSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível enviar a foto de perfil."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-2xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="hidden sm:block">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-jus-petroleum">
          Meu Perfil
        </h1>
        <p className="text-xs sm:text-sm text-jus-text-muted mt-0.5">
          Gerencie suas informações cadastrais e de acesso
        </p>
      </div>

      <Card className="space-y-6 rounded-t-[28px] p-5 shadow-[0_4px_10px_rgba(0,0,0,0.12)] sm:p-8">
        <h1 className="text-center text-lg font-medium text-slate-700 sm:hidden">Perfil</h1>
        {/* Profile Avatar Header with Upload option */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-100 text-center sm:text-left">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full bg-jus-petroleum text-white flex items-center justify-center text-3xl font-bold font-serif shadow-md overflow-hidden border-2 border-white sm:h-20 sm:w-20 sm:text-2xl">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName || "Avatar"}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                fullName ? fullName.charAt(0).toUpperCase() : "C"
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 p-1.5 bg-jus-caramel text-white rounded-full shadow-md hover:bg-jus-caramel-hover transition-colors cursor-pointer"
              title="Trocar Foto"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="w-full min-w-0 space-y-1 text-center sm:w-auto sm:text-left">
            <h2 className="max-w-full break-words text-lg font-bold text-slate-800">
              {fullName || "Usuário Cidadão"}
            </h2>
            <p className="break-all text-xs text-slate-500">{email}</p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Conta Cidadão Ativa</span>
            </div>
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </p>
        )}

        {/* Profile Information Form */}
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
            helperText="O e-mail principal da conta não pode ser alterado."
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

          <div className="pt-4 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 sm:flex-row sm:items-center">
            <Button type="submit" variant="primary" loading={saving}>
              Salvar Alterações
            </Button>
          </div>
        </form>

        {/* Password Update Section */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErrorMessage("");
            if (newPassword.length < 6) {
              setErrorMessage("A nova senha deve ter pelo menos 6 caracteres.");
              return;
            }
            try {
              await changePassword(newPassword);
              setNewPassword("");
              setSuccess(true);
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Não foi possível alterar a senha. Faça login novamente para reautenticar."
              );
            }
          }}
          className="space-y-3 border-t border-slate-100 pt-6"
        >
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Segurança da Conta
          </h3>
          <Input
            label="Nova Senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            helperText="Para redefinir a senha, utilize ao menos 6 dígitos ou caracteres alfanuméricos."
          />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="sm" disabled={!newPassword}>
              Alterar Senha
            </Button>
          </div>
        </form>

        <Button type="button" variant="outline" onClick={() => setShowLogoutModal(true)} className="w-full border-red-500 text-red-600 hover:bg-red-50" icon={<LogOut className="w-4 h-4" />}>Sair da Conta</Button>
      </Card>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
        title="Deseja realmente sair?"
        description="Você será desconectado da sua conta JusFácil neste dispositivo."
        confirmText="Sair da Conta"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
