import { App, applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { AppError } from "@/lib/errors";

export type AdminConfigurationStatus = "configured" | "not_configured" | "invalid";

export function getAdminConfigurationStatus(): AdminConfigurationStatus {
  const values = [
    process.env.FIREBASE_ADMIN_PROJECT_ID,
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  ];
  if (values.every((value) => !value)) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS ? "configured" : "not_configured";
  }
  if (values.some((value) => !value)) return "invalid";
  return "configured";
}

export function getAdminApp(): App {
  if (getApps().length) return getApp();
  const status = getAdminConfigurationStatus();
  if (status !== "configured") {
    throw new AppError(
      "FIREBASE_NOT_CONFIGURED",
      status === "invalid"
        ? "A configuração do Firebase Admin está incompleta."
        : "O Firebase Admin não está configurado neste ambiente.",
    );
  }
  const hasExplicitCredentials = Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID
      && process.env.FIREBASE_ADMIN_CLIENT_EMAIL
      && process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  return initializeApp({
    credential: hasExplicitCredentials
      ? cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        })
      : applicationDefault(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
