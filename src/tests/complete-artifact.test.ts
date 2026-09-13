import { describe, expect, it } from "vitest";
import { artifactBinding, ArtifactError, readCompleteArtifact, storeCompleteArtifact, validateArtifact } from "@/lib/drafts/completeArtifact";
import type { DraftVersion, Evidence } from "@/types";
const draft: DraftVersion = { caseId: "JF-QA-ARTIFACT", version: 2, title: "QA", content: "FICTITIOUS QA ONLY", approved: false, createdBy: "qa", source: "CITIZEN", createdAt: "2026-09-12T00:00:00Z" };
const records: Evidence[] = [{ evidenceId: "e1", caseId: draft.caseId, originalName: "QA.jpg", title: "QA image", order: 1, reference: "01", mimeType: "image/jpeg", size: 20, status: "PROCESSED", uploadedBy: "qa", uploadedAt: draft.createdAt, sha256: "a".repeat(64) }];
describe("private complete artifact, no email or AI", () => {
  it("binds case, version, content, evidence metadata and original hash", () => {
    const base = artifactBinding(draft, records);
    expect(artifactBinding({ ...draft, version: 3 }, records)).not.toBe(base);
    expect(artifactBinding({ ...draft, caseId: "JF-OTHER" }, records)).not.toBe(base);
    expect(artifactBinding({ ...draft, content: "OTHER" }, records)).not.toBe(base);
    expect(artifactBinding(draft, [{ ...records[0], sha256: "b".repeat(64) }])).not.toBe(base);
    expect(artifactBinding(draft, [{ ...records[0], title: "OTHER" }])).not.toBe(base);
  });
  it("stores immutable copies and recovers exact bytes independently of React state", async () => {
    const pdf = Buffer.from("%PDF-1.7 QA TEST ONLY\n"); const docx = Buffer.from("PK QA TEST ONLY");
    const meta = await storeCompleteArtifact(draft, records, pdf, docx, 1, "c".repeat(64));
    expect(await readCompleteArtifact(meta, draft, records, "pdf")).toEqual(pdf);
    expect(await readCompleteArtifact(meta, draft, records, "docx")).toEqual(docx);
    expect(await storeCompleteArtifact(draft, records, pdf, docx, 1, "c".repeat(64))).toEqual(meta);
    expect(() => validateArtifact(meta, { ...draft, version: 3 }, records)).toThrow(ArtifactError);
    expect(() => validateArtifact({ ...meta, id: "../secret" }, draft, records)).toThrow(ArtifactError);
    expect(() => validateArtifact(meta, draft, [])).toThrow(ArtifactError);
    await expect(readCompleteArtifact({ ...meta, pdfHash: "b".repeat(64) }, draft, records, "pdf")).rejects.toThrow(ArtifactError);
  });
  it("blocks empty, oversized or non-PDF attachments and mismatched image count", async () => {
    for (const pdf of [Buffer.alloc(0), Buffer.from("NO PDF"), Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(8 * 1024 * 1024)])]) {
      await expect(storeCompleteArtifact(draft, records, pdf, Buffer.from("PK QA"), 1, "c".repeat(64))).rejects.toThrow(ArtifactError);
    }
    await expect(storeCompleteArtifact(draft, records, Buffer.from("%PDF-QA"), Buffer.from("PK QA"), 66, "c".repeat(64))).rejects.toThrow(ArtifactError);
  });
});
