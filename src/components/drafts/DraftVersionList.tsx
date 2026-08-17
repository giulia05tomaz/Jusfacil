import React from "react";
import type { DraftVersion } from "@/types";

export function DraftVersionList({ drafts, selectedVersion, onSelect }: { drafts: DraftVersion[]; selectedVersion: number; onSelect: (version: number) => void }) {
  return <div aria-label="Histórico de versões" className="flex flex-wrap gap-2">{drafts.map((draft) => <button key={draft.version} type="button" onClick={() => onSelect(draft.version)} aria-pressed={selectedVersion === draft.version} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${selectedVersion === draft.version ? "border-jus-petroleum bg-jus-petroleum text-white" : "border-slate-300 bg-white text-slate-600"}`}>Versão {draft.version}{draft.approved ? " — final" : ""}</button>)}</div>;
}
