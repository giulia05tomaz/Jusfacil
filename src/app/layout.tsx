import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/authContext";

export const metadata: Metadata = {
  title: "JusFácil | Assistente Jurídico Digital e Pequenas Causas",
  description: "Plataforma revolucionária de auxílio jurídico com inteligência artificial para pequenos processos e democratização da justiça.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-jus-canvas flex flex-col antialiased text-slate-800 font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
