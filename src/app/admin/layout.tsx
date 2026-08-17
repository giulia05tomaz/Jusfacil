"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/authContext";
import { Navbar } from "@/components/layout/Navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && (!user || profile?.role !== "ADMIN")) router.replace("/login");
  }, [loading, profile, router, user]);
  if (loading || profile?.role !== "ADMIN") return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-jus-petroleum" /><span className="sr-only">Validando acesso administrativo</span></div>;
  return <div className="min-h-screen bg-slate-50"><Navbar /><main className="mx-auto max-w-7xl p-4 sm:p-8">{children}</main></div>;
}
