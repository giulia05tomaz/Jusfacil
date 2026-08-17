"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Mail, Lock, User, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { CpfSchema, OabNumberSchema, OabStateSchema, UsernameSchema } from "@/lib/validation/profile";
import { getFriendlyError } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, signupCitizen, signupLawyer, loginWithGoogle, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup" | "lawyer">("login");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Citizen Signup Form State
  const [citName, setCitName] = useState("");
  const [citEmail, setCitEmail] = useState("");
  const [citUsername, setCitUsername] = useState("");
  const [citCpf, setCitCpf] = useState("");
  const [citPass, setCitPass] = useState("");
  const [citConfirmPass, setCitConfirmPass] = useState("");

  // Lawyer Signup Form State
  const [lawName, setLawName] = useState("");
  const [lawEmail, setLawEmail] = useState("");
  const [lawOab, setLawOab] = useState("");
  const [lawOabState, setLawOabState] = useState("SP");
  const [lawCpf, setLawCpf] = useState("");
  const [lawUsername, setLawUsername] = useState("");
  const [lawPass, setLawPass] = useState("");
  const [lawConfirmPass, setLawConfirmPass] = useState("");

  // Auto redirect if already authenticated
  React.useEffect(() => {
    if (profile) {
      if (profile.role === "ADMIN") {
        router.push("/admin");
      } else if (profile.role === "LAWYER") {
        router.push("/advogado/casos");
      } else {
        router.push("/app");
      }
    }
  }, [profile, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      await loginWithEmail(loginEmail, loginPassword);
    } catch (error: unknown) {
      setErrorMsg(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCitizenSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (citPass !== citConfirmPass) {
      setErrorMsg("As senhas não coincidem!");
      return;
    }
    if (citCpf && !CpfSchema.safeParse(citCpf).success) { setErrorMsg("CPF inválido."); return; }
    if (citUsername && !UsernameSchema.safeParse(citUsername).success) { setErrorMsg("Nome de usuário inválido."); return; }

    setLoading(true);
    try {
      await signupCitizen({
        fullName: citName,
        email: citEmail,
        username: citUsername,
        cpf: citCpf,
        pass: citPass,
      });
      router.push("/app");
    } catch (error: unknown) {
      setErrorMsg(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLawyerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (lawPass !== lawConfirmPass) {
      setErrorMsg("As senhas não coincidem!");
      return;
    }
    if (lawCpf && !CpfSchema.safeParse(lawCpf).success) { setErrorMsg("CPF inválido."); return; }
    if (lawUsername && !UsernameSchema.safeParse(lawUsername).success) { setErrorMsg("Nome de usuário inválido."); return; }
    if (!OabNumberSchema.safeParse(lawOab).success || !OabStateSchema.safeParse(lawOabState).success) { setErrorMsg("OAB ou UF inválida."); return; }

    setLoading(true);
    try {
      await signupLawyer({
        fullName: lawName,
        email: lawEmail,
        oabNumber: lawOab,
        oabState: lawOabState,
        cpf: lawCpf,
        username: lawUsername,
        pass: lawPass,
      });
      router.push("/advogado/casos");
    } catch (error: unknown) {
      setErrorMsg(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    try { await loginWithGoogle(); }
    catch (error) { setErrorMsg(error instanceof Error ? error.message : "Não foi possível entrar com o Google."); }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-cover bg-center flex flex-col justify-center items-center p-4 relative font-sans"
         style={{ backgroundImage: `linear-gradient(rgba(0, 29, 46, 0.85), rgba(0, 43, 67, 0.90)), url('/img/bkg.jpg')` }}>

      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="bg-white p-3 rounded-full shadow-xl border-2 border-jus-caramel mb-3">
          <Image
            src="/img/Logo.png"
            alt="JusFácil Logo"
            width={72}
            height={85}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-wider text-white">JUSFÁCIL</h1>
        <p className="text-xs text-jus-caramel-light font-medium tracking-widest uppercase">
          Plataforma de Auxílio Jurídico e Inteligência Artificial
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 transition-all">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1">
          <button
            onClick={() => { setActiveTab("login"); setErrorMsg(""); }}
            className={`flex-1 py-3 text-xs font-semibold rounded-2xl transition-all cursor-pointer ${
              activeTab === "login"
                ? "bg-jus-petroleum text-white shadow"
                : "text-slate-600 hover:text-jus-petroleum"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setActiveTab("signup"); setErrorMsg(""); }}
            className={`flex-1 py-3 text-xs font-semibold rounded-2xl transition-all cursor-pointer ${
              activeTab === "signup"
                ? "bg-jus-petroleum text-white shadow"
                : "text-slate-600 hover:text-jus-petroleum"
            }`}
          >
            Cadastrar
          </button>
          <button
            onClick={() => { setActiveTab("lawyer"); setErrorMsg(""); }}
            className={`flex-1 py-3 text-xs font-semibold rounded-2xl transition-all cursor-pointer ${
              activeTab === "lawyer"
                ? "bg-jus-petroleum text-white shadow"
                : "text-slate-600 hover:text-jus-petroleum"
            }`}
          >
            Advogado
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">Erro:</span> {errorMsg}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email ou Usuário"
                type="email"
                placeholder="@josemaria1 ou email@exemplo.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Senha"
                type="password"
                placeholder="************"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 mt-2 text-sm font-semibold uppercase tracking-wider"
                loading={loading}
              >
                Entrar
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Ou continue com</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Entrar com Google</span>
              </Button>

              <div className="pt-3 flex flex-col items-center gap-2 text-xs">
                <Link href="/recuperar-senha" className="text-jus-petroleum hover:underline font-medium">
                  Esqueceu a senha?
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className="text-jus-caramel hover:underline font-semibold"
                >
                  Primeiro acesso? Cadastre-se aqui &gt;
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <Link
                  href="/app/suporte"
                  className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Seja nosso afiliado
                </Link>
              </div>
            </form>
          )}

          {/* TAB 2: CADASTRO CIDADÃO */}
          {activeTab === "signup" && (
            <form onSubmit={handleCitizenSignup} className="space-y-3">
              <Input
                label="Nome Completo"
                type="text"
                placeholder="José Maria dos Santos"
                value={citName}
                onChange={(e) => setCitName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Email"
                type="email"
                placeholder="josemaria@gmail.com"
                value={citEmail}
                onChange={(e) => setCitEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Nome de usuário"
                type="text"
                placeholder="@josemaria1"
                value={citUsername}
                onChange={(e) => setCitUsername(e.target.value)}
                rightElement={
                  citUsername.length > 3 ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      disponível
                    </span>
                  ) : undefined
                }
              />

              <Input
                label="CPF"
                type="text"
                placeholder="000.000.000-00"
                value={citCpf}
                onChange={(e) => setCitCpf(e.target.value)}
                icon={<FileText className="w-4 h-4" />}
              />

              <Input
                label="Criar Senha"
                type="password"
                placeholder="************"
                value={citPass}
                onChange={(e) => setCitPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirmar Senha"
                type="password"
                placeholder="************"
                value={citConfirmPass}
                onChange={(e) => setCitConfirmPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                rightElement={
                  citPass && citConfirmPass && citPass === citConfirmPass ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> senhas iguais
                    </span>
                  ) : undefined
                }
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 mt-2 text-sm font-semibold uppercase tracking-wider"
                loading={loading}
              >
                Cadastrar
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs text-jus-petroleum hover:underline font-semibold"
                >
                  Já possuo cadastro &gt;
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CADASTRO ADVOGADO */}
          {activeTab === "lawyer" && (
            <form onSubmit={handleLawyerSignup} className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Área de credenciamento e acesso para Advogados (OAB).</span>
              </div>

              <Input
                label="Nome completo do Advogado"
                type="text"
                placeholder="Dr. José Maria dos Santos"
                value={lawName}
                onChange={(e) => setLawName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Email Institucional"
                type="email"
                placeholder="advogado@escritorio.com"
                value={lawEmail}
                onChange={(e) => setLawEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input
                    label="Nº da OAB"
                    type="text"
                    placeholder="123456"
                    value={lawOab}
                    onChange={(e) => setLawOab(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1.5">
                    UF
                  </label>
                  <select
                    value={lawOabState}
                    onChange={(e) => setLawOabState(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2.5 px-2 text-sm text-slate-800 focus:outline-none focus:border-jus-petroleum"
                  >
                    {["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "GO", "DF"].map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                label="CPF"
                type="text"
                placeholder="000.000.000-00"
                value={lawCpf}
                onChange={(e) => setLawCpf(e.target.value)}
              />

              <Input
                label="Nome de usuário"
                type="text"
                placeholder="@advogada"
                value={lawUsername}
                onChange={(e) => setLawUsername(e.target.value)}
              />

              <Input
                label="Criar Senha"
                type="password"
                placeholder="************"
                value={lawPass}
                onChange={(e) => setLawPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirmar Senha"
                type="password"
                placeholder="************"
                value={lawConfirmPass}
                onChange={(e) => setLawConfirmPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3 mt-2 text-sm font-semibold uppercase tracking-wider"
                loading={loading}
              >
                Cadastrar Advogado
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs text-jus-petroleum hover:underline font-semibold"
                >
                  Já possuo cadastro &gt;
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-300 font-medium">
        JusFácil © 2026 — Desenvolvido com inteligência artificial para a democratização da Justiça.
      </p>
    </div>
  );
}
