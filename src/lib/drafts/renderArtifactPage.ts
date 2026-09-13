import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ArtifactError } from "./completeArtifact";

export async function renderArtifactPage(pdf: Buffer, page: number) {
  const directory = await mkdtemp(path.join(tmpdir(), "jusfacil-page-"));
  try {
    const input = path.join(directory, "petition.pdf"); const output = path.join(directory, "page.png");
    await writeFile(input, pdf, { mode: 0o600 });
    const metadata = await new Promise<{ pages: number; page: number; firstAnnexPage: number | null }>((resolve, reject) => {
      const child = spawn(/*turbopackIgnore: true*/ process.env.JUSFACIL_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3"),
        [path.join(process.cwd(), "scripts", "render_petition_page.py"), input, output, "--page", String(page)],
        { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
      let stdout = "";
      const timeout = setTimeout(() => { child.kill(); reject(new ArtifactError("DOCUMENT_PREVIEW_UNAVAILABLE")); }, 25_000);
      child.stdout.on("data", (chunk: Buffer) => { if (stdout.length < 2000) stdout += chunk.toString(); });
      child.on("error", () => { clearTimeout(timeout); reject(new ArtifactError("DOCUMENT_PREVIEW_UNAVAILABLE")); });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) return reject(new ArtifactError("DOCUMENT_PREVIEW_UNAVAILABLE"));
        try { const result = JSON.parse(stdout); if (result.page !== page || !Number.isInteger(result.pages) || result.pages < page) throw new Error(); resolve(result); }
        catch { reject(new ArtifactError("DOCUMENT_PREVIEW_UNAVAILABLE")); }
      });
    });
    const bytes = await readFile(output);
    if (bytes.length > 12 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new ArtifactError("DOCUMENT_PREVIEW_UNAVAILABLE");
    return { bytes, ...metadata };
  } finally {
    if (directory.startsWith(path.join(tmpdir(), "jusfacil-page-"))) await rm(directory, { recursive: true, force: true });
  }
}
