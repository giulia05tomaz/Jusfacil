"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/authContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { UI_DEV_MODE } from "@/lib/devMode";

export default function PasswordResetPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 bg-cover bg-center flex flex-col justify-center items-center p-4 relative font-sans"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 29, 46, 0.88), rgba(0, 43, 67, 0.92)), url('/img/bkg.jpg')`,
      }}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="bg-white p-3 rounded-full shadow-xl border-2 border-jus-caramel mb-3">
          <Image
            src="/img/Logo.png"
            alt="JusFácil Logo"
            width={64}
            height={76}
            className="object-contain"
          />
        </div>
        <h1 className="font-serif text-2xl font-bold tracking-wider text-white">JUSFÁCIL</h1>
        <p className="text-xs text-jus-caramel-light uppercase font-medium">Recuperação de Acesso</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-100">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-jus-petroleum mb-1">Esqueceu sua senha?</h2>
          <p className="text-xs text-slate-600">
            {UI_DEV_MODE
              ? "Esta tela está preservada para revisão visual. Nenhum e-mail será enviado enquanto o modo DEV estiver ativo."
              : "Digite seu e-mail cadastrado e enviaremos as instruções para você redefinir sua senha com segurança."}
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-900">{UI_DEV_MODE ? "Fluxo de recuperação simulado" : "E-mail de redefinição enviado!"}</h3>
            <p className="text-xs text-emerald-700">
              {UI_DEV_MODE ? <>Nenhum e-mail foi enviado. Esta confirmação existe apenas para validar a interface.</> : <>Verifique sua caixa de entrada no endereço <strong>{email}</strong> para prosseguir.</>}
            </p>
            <Link
              href="/login"
              className="inline-block mt-2 px-5 py-2 text-xs font-semibold bg-jus-petroleum text-white rounded-full hover:bg-jus-petroleum-hover transition-colors"
            >
              Voltar ao Login
            </Link>
          </div>
        ) : (
          <>
          {errorMessage && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail Cadastrado"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-sm font-semibold uppercase tracking-wider"
              loading={loading}
            >
              Enviar Instruções
            </Button>

            <div className="pt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-jus-petroleum font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para tela de Login</span>
              </Link>
            </div>
          </form>
          </>
        )}
      </div>
    </div>
  );
}
