import type { DraftVersion } from "@/types";

export function nextDraftVersion(drafts: Pick<DraftVersion, "version">[]): number {
  return drafts.reduce((highest, draft) => Math.max(highest, draft.version), 0) + 1;
}
