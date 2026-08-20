"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/authContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Mail, Lock, User, FileText, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { CpfSchema, OabNumberSchema, OabStateSchema, UsernameSchema } from "@/lib/validation/profile";
import { getFriendlyError } from "@/lib/errors";
import { UI_DEV_MODE } from "@/lib/devMode";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, signupCitizen, signupLawyer, loginWithGoogle, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup" | "lawyer">("login");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showCitPassword, setShowCitPassword] = useState(false);
  const [showCitConfirmPassword, setShowCitConfirmPassword] = useState(false);
  const [showLawPassword, setShowLawPassword] = useState(false);
  const [showLawConfirmPassword, setShowLawConfirmPassword] = useState(false);

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
  const [lawyerRegisteredSuccess, setLawyerRegisteredSuccess] = useState(false);

  // Auto redirect if already authenticated
  React.useEffect(() => {
    if (profile && !UI_DEV_MODE) {
      if (profile.role === "ADMIN") {
        router.push("/admin");
      } else if (profile.role === "LAWYER") {
        router.push("/advogado");
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
      await loginWithEmail(loginEmail.trim(), loginPassword);
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
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    if (citPass.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (citCpf && !CpfSchema.safeParse(citCpf).success) {
      setErrorMsg("CPF inválido.");
      return;
    }
    if (citUsername && !UsernameSchema.safeParse(citUsername).success) {
      setErrorMsg("Nome de usuário inválido (use apenas letras, números e ponto).");
      return;
    }

    setLoading(true);
    try {
      await signupCitizen({
        fullName: citName.trim(),
        email: citEmail.trim(),
        username: citUsername.trim() || undefined,
        cpf: citCpf.trim() || undefined,
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
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    if (lawPass.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (lawCpf && !CpfSchema.safeParse(lawCpf).success) {
      setErrorMsg("CPF inválido.");
      return;
    }
    if (lawUsername && !UsernameSchema.safeParse(lawUsername).success) {
      setErrorMsg("Nome de usuário inválido.");
      return;
    }
    if (!OabNumberSchema.safeParse(lawOab.trim()).success || !OabStateSchema.safeParse(lawOabState).success) {
      setErrorMsg("Nº da OAB ou UF inválida.");
      return;
    }

    setLoading(true);
    try {
      await signupLawyer({
        fullName: lawName.trim(),
        email: lawEmail.trim(),
        oabNumber: lawOab.trim(),
        oabState: lawOabState,
        cpf: lawCpf.trim() || undefined,
        username: lawUsername.trim() || undefined,
        pass: lawPass,
      });
      setLawyerRegisteredSuccess(true);
    } catch (error: unknown) {
      setErrorMsg(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    try {
      await loginWithGoogle();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Não foi possível entrar com o Google.");
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 bg-cover bg-center flex flex-col justify-center items-center px-4 py-12 relative font-sans"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 29, 46, 0.88), rgba(0, 43, 67, 0.92)), url('/img/bkg.jpg')`,
      }}
    >
      {UI_DEV_MODE && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-950 shadow-lg">
          Login real arquivado temporariamente para o trabalho visual. <Link href="/" className="font-bold underline underline-offset-2">Voltar ao seletor DEV</Link>
        </div>
      )}
      {/* Brand Card Frame Container */}
      <div className="w-full max-w-[480px] relative pt-20">
        {/* Floating Circular Logo overlapping top of card */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-white shadow-card-elevated border-4 border-white flex items-center justify-center p-3">
          <Image
            src="/img/Logo.png"
            alt="JusFácil Logo"
            width={120}
            height={140}
            className="object-contain"
            priority
          />
        </div>

        {/* Card Box */}
        <div className="bg-white rounded-card shadow-2xl pt-24 pb-8 px-6 sm:px-10 border border-slate-100 transition-all">
          {/* Header Title */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-jus-petroleum tracking-wide">
              JUSFÁCIL
            </h1>
            <p className="text-xs text-jus-text-muted mt-1">
              Justiça Simples e Acessível
            </p>
          </div>

          {/* Navigation Mode Tabs */}
          <div
            id="auth-tab-selector"
            className="flex rounded-[18px] bg-[#F1F4F8] p-1 mb-6 border border-slate-200/60 gap-1"
          >
            <button
              id="auth-tab-entrar"
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMsg("");
                setLawyerRegisteredSuccess(false);
              }}
              className={`flex-1 py-2.5 text-xs rounded-[14px] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08A4E] ${
                activeTab === "login"
                  ? "bg-[#002B43] text-white font-semibold shadow-sm opacity-100"
                  : "bg-transparent text-[#002B43] font-medium opacity-100 hover:bg-[#002B43]/5"
              }`}
            >
              Entrar
            </button>
            <button
              id="auth-tab-cadastrar"
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setErrorMsg("");
                setLawyerRegisteredSuccess(false);
              }}
              className={`flex-1 py-2.5 text-xs rounded-[14px] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08A4E] ${
                activeTab === "signup"
                  ? "bg-[#002B43] text-white font-semibold shadow-sm opacity-100"
                  : "bg-transparent text-[#002B43] font-medium opacity-100 hover:bg-[#002B43]/5"
              }`}
            >
              Cadastrar
            </button>
            <button
              id="auth-tab-advogado"
              type="button"
              onClick={() => {
                setActiveTab("lawyer");
                setErrorMsg("");
                setLawyerRegisteredSuccess(false);
              }}
              className={`flex-1 py-2.5 text-xs rounded-[14px] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08A4E] ${
                activeTab === "lawyer"
                  ? "bg-[#002B43] text-white font-semibold shadow-sm opacity-100"
                  : "bg-transparent text-[#002B43] font-medium opacity-100 hover:bg-[#002B43]/5"
              }`}
            >
              Advogado
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <span className="font-bold">Erro:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN (Tela 1) */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Usuário ou e-mail"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                inputVariant="underline"
                required
              />

              <Input
                label="Senha"
                type={showLoginPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                inputVariant="underline"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="p-1 hover:text-jus-petroleum transition-colors"
                    aria-label={showLoginPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                >
                  Entrar
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

              <div className="pt-4 flex flex-col items-center gap-2.5 text-xs">
                <Link
                  href="/recuperar-senha"
                  className="text-jus-petroleum hover:underline font-medium"
                >
                  Esqueceu a senha?
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className="text-jus-caramel hover:underline font-semibold cursor-pointer"
                >
                  Primeiro acesso? Cadastre-se aqui &gt;
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setShowAffiliateModal(true)}
                  className="inline-block px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Seja nosso afiliado
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CADASTRO CIDADÃO (Tela 2) */}
          {activeTab === "signup" && (
            <form onSubmit={handleCitizenSignup} className="space-y-3.5">
              <Input
                label="Nome Completo"
                type="text"
                placeholder="Seu nome completo"
                value={citName}
                onChange={(e) => setCitName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                inputVariant="underline"
                required
              />

              <Input
                label="E-mail"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={citEmail}
                onChange={(e) => setCitEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                inputVariant="underline"
                required
              />

              <Input
                label="Nome de usuário"
                type="text"
                placeholder="@usuario"
                value={citUsername}
                onChange={(e) => setCitUsername(e.target.value)}
                inputVariant="underline"
                rightElement={
                  citUsername.length > 2 ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      disponível
                    </span>
                  ) : undefined
                }
              />

              <Input
                label="CPF (Opcional)"
                type="text"
                placeholder="000.000.000-00"
                value={citCpf}
                onChange={(e) => setCitCpf(e.target.value)}
                icon={<FileText className="w-4 h-4" />}
                inputVariant="underline"
              />

              <Input
                label="Criar Senha"
                type={showCitPassword ? "text" : "password"}
                placeholder="Mínimo de 6 caracteres"
                value={citPass}
                onChange={(e) => setCitPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                inputVariant="underline"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowCitPassword(!showCitPassword)}
                    className="p-1 hover:text-jus-petroleum transition-colors"
                  >
                    {showCitPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />

              <Input
                label="Confirmar Senha"
                type={showCitConfirmPassword ? "text" : "password"}
                placeholder="Repita sua senha"
                value={citConfirmPass}
                onChange={(e) => setCitConfirmPass(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                inputVariant="underline"
                rightElement={
                  citPass && citConfirmPass && citPass === citConfirmPass ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> senhas iguais
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCitConfirmPassword(!showCitConfirmPassword)}
                      className="p-1 hover:text-jus-petroleum transition-colors"
                    >
                      {showCitConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )
                }
                required
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                >
                  Cadastrar
                </Button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs text-jus-petroleum hover:underline font-semibold cursor-pointer"
                >
                  Já possuo cadastro &gt;
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CADASTRO ADVOGADO (Tela 16) */}
          {activeTab === "lawyer" && (
            <div>
              {lawyerRegisteredSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-jus-petroleum">
                    Cadastro enviado para análise!
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                    Seu cadastro profissional foi recebido com sucesso. Você poderá acessar a plataforma e os casos após aprovação do seu perfil profissional pela administração.
                  </p>
                  <div className="pt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push("/advogado")}
                    >
                      Acessar Portal do Advogado
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLawyerSignup} className="space-y-3.5">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Área de credenciamento profissional para Advogados (OAB).</span>
                  </div>

                  <Input
                    label="Nome completo do Advogado"
                    type="text"
                    placeholder="Dr. Nome Completo"
                    value={lawName}
                    onChange={(e) => setLawName(e.target.value)}
                    icon={<User className="w-4 h-4" />}
                    inputVariant="underline"
                    required
                  />

                  <Input
                    label="E-mail Institucional"
                    type="email"
                    placeholder="advogado@escritorio.com"
                    value={lawEmail}
                    onChange={(e) => setLawEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
                    inputVariant="underline"
                    required
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Nº da OAB"
                        type="text"
                        placeholder="123456"
                        value={lawOab}
                        onChange={(e) => setLawOab(e.target.value)}
                        inputVariant="underline"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase block mb-1">
                        UF da OAB
                      </label>
                      <select
                        value={lawOabState}
                        onChange={(e) => setLawOabState(e.target.value)}
                        className="w-full bg-transparent border-0 border-b-2 border-slate-300 rounded-none py-2 px-1 text-sm text-slate-900 focus:outline-none focus:border-jus-petroleum"
                      >
                        {[
                          "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
                          "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
                          "RS", "RO", "RR", "SC", "SP", "SE", "TO"
                        ].map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Input
                    label="CPF (Opcional)"
                    type="text"
                    placeholder="000.000.000-00"
                    value={lawCpf}
                    onChange={(e) => setLawCpf(e.target.value)}
                    icon={<FileText className="w-4 h-4" />}
                    inputVariant="underline"
                  />

                  <Input
                    label="Nome de usuário"
                    type="text"
                    placeholder="@advogado"
                    value={lawUsername}
                    onChange={(e) => setLawUsername(e.target.value)}
                    inputVariant="underline"
                  />

                  <Input
                    label="Criar Senha"
                    type={showLawPassword ? "text" : "password"}
                    placeholder="Mínimo de 6 caracteres"
                    value={lawPass}
                    onChange={(e) => setLawPass(e.target.value)}
                    icon={<Lock className="w-4 h-4" />}
                    inputVariant="underline"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowLawPassword(!showLawPassword)}
                        className="p-1 hover:text-jus-petroleum transition-colors"
                      >
                        {showLawPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    required
                  />

                  <Input
                    label="Confirmar Senha"
                    type={showLawConfirmPassword ? "text" : "password"}
                    placeholder="Repita sua senha"
                    value={lawConfirmPass}
                    onChange={(e) => setLawConfirmPass(e.target.value)}
                    icon={<Lock className="w-4 h-4" />}
                    inputVariant="underline"
                    rightElement={
                      lawPass && lawConfirmPass && lawPass === lawConfirmPass ? (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> senhas iguais
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowLawConfirmPassword(!showLawConfirmPassword)}
                          className="p-1 hover:text-jus-petroleum transition-colors"
                        >
                          {showLawConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )
                    }
                    required
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      size="lg"
                      loading={loading}
                    >
                      Cadastrar Advogado
                    </Button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("login")}
                      className="text-xs text-jus-petroleum hover:underline font-semibold cursor-pointer"
                    >
                      Já possuo cadastro &gt;
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Affiliate Modal */}
      <ConfirmDialog
        isOpen={showAffiliateModal}
        onClose={() => setShowAffiliateModal(false)}
        onConfirm={() => setShowAffiliateModal(false)}
        title="Programa de Afiliados"
        description="O programa de parceiros e afiliados do JusFácil está em fase de estruturação e estará disponível em breve. Fique atento às próximas novidades!"
        confirmText="Entendi"
        cancelText="Fechar"
        variant="primary"
      />

      <p className="mt-8 text-xs text-slate-300 text-center font-medium">
        JusFácil © 2026 — Justiça Simples e Acessível
      </p>
    </div>
  );
}
