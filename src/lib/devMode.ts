export const UI_DEV_MODE = process.env.NEXT_PUBLIC_UI_DEV_MODE === "true";

export type DevRole = "CITIZEN" | "LAWYER";

export const DEV_ROLE_STORAGE_KEY = "jusfacil:ui-dev-role";

export function getStoredDevRole(): DevRole | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(DEV_ROLE_STORAGE_KEY);
  return value === "CITIZEN" || value === "LAWYER" ? value : null;
}

export function storeDevRole(role: DevRole): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEV_ROLE_STORAGE_KEY, role);
}

export function clearStoredDevRole(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEV_ROLE_STORAGE_KEY);
}
