import React from "react";

export function UploadProgress({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  return <div role="status" aria-live="polite" className="space-y-1"><div className="flex justify-between text-[11px] text-slate-600"><span>Enviando evidência</span><span>{safeProgress}%</span></div><progress aria-label="Progresso do upload" className="w-full" max={100} value={safeProgress}>{safeProgress}%</progress></div>;
}
