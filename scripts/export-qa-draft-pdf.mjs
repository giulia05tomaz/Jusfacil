import fs from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generateDraftPdf } from "../src/lib/pdf/generateDraftPdf.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const caseId = process.argv[2];
if (!caseId || !/^JF-[A-Za-z0-9-]+$/.test(caseId)) throw new Error("Informe um caseId QA válido.");

const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore(app);
const caseSnapshot = await db.collection("cases").doc(caseId).get();
if (!caseSnapshot.exists) throw new Error("Caso QA não encontrado.");
const legalCase = caseSnapshot.data();
const version = Number(legalCase.currentDraftVersion || 0);
const draftSnapshot = await caseSnapshot.ref.collection("drafts").doc(`v${version}`).get();
if (!draftSnapshot.exists || !draftSnapshot.data().approved) throw new Error("A última minuta QA ainda não está aprovada.");

const outputDirectory = path.resolve("output", "pdf");
await fs.mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, `peticao-inicial-${caseId}-v${version}.pdf`);
const pdf = generateDraftPdf(legalCase, draftSnapshot.data());
await fs.writeFile(outputPath, Buffer.from(pdf.output("arraybuffer")));
console.log(JSON.stringify({ outputPath, bytes: (await fs.stat(outputPath)).size, version }));
