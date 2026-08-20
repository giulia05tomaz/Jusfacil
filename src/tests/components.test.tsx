// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftVersionList } from "@/components/drafts/DraftVersionList";
import { UploadProgress } from "@/components/evidence/UploadProgress";
import LoginPage from "@/app/login/page";
import type { DraftVersion } from "@/types";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  loginWithEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
  const imageProps = { ...props };
  delete imageProps.priority;
  return React.createElement("img", imageProps);
} }));
vi.mock("@/lib/firebase/authContext", () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    loginWithEmail: mocks.loginWithEmail,
    signupCitizen: vi.fn(),
    signupLawyer: vi.fn(),
    loginWithGoogle: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("componentes críticos", () => {
  it("mostra erro real de login e não redireciona", async () => {
    mocks.loginWithEmail.mockRejectedValue(new Error("Credenciais inválidas"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Usuário ou e-mail"), { target: { value: "teste@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-inválida" } });
    fireEvent.click(document.querySelector('button[type="submit"]')!);
    expect(await screen.findByText("Credenciais inválidas")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("expõe progresso de upload acessível", () => {
    render(<UploadProgress progress={67.4} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "67");
    expect(screen.getByRole("status")).toHaveTextContent("67%");
  });

  it("permite selecionar versões sem apagar o histórico", async () => {
    const onSelect = vi.fn();
    const draft = (version: number, approved = false): DraftVersion => ({ version, caseId: "JF-2026-TESTE", title: `Versão ${version}`, content: "Conteúdo", approved, createdBy: "citizen-a", source: "AI", createdAt: "2026-01-01T00:00:00.000Z" });
    render(<DraftVersionList drafts={[draft(2, true), draft(1)]} selectedVersion={2} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Versão 1" }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(1));
    expect(screen.getByRole("button", { name: "Versão 2 — final" })).toBeInTheDocument();
  });
});
