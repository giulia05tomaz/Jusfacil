"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./config";
import { createUserProfile, getUserProfile } from "./services";
import { AppError } from "@/lib/errors";
import { UI_DEV_MODE, clearStoredDevRole, getStoredDevRole, storeDevRole, type DevRole } from "@/lib/devMode";
import { DEV_CITIZEN_UID, DEV_LAWYER_UID, devGetUserProfile, getDevProfile } from "@/lib/dev/mockStore";
import type { UserProfile } from "@/types";

interface CitizenSignup { fullName: string; email: string; pass: string; cpf?: string; username?: string }
interface LawyerSignup extends CitizenSignup { oabNumber: string; oabState: string }

type AuthUser = Pick<User, "uid" | "email" | "displayName" | "photoURL" | "getIdToken">;

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  devMode: boolean;
  enterDevMode: (role: DevRole) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupCitizen: (data: CitizenSignup) => Promise<void>;
  signupLawyer: (data: LawyerSignup) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const now = () => new Date().toISOString();
const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured) throw new AppError("FIREBASE_NOT_CONFIGURED");
}

function createDevUser(profile: UserProfile): AuthUser {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.fullName,
    photoURL: profile.avatarUrl ?? null,
    getIdToken: async () => `ui-dev-token:${profile.uid}`,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const profileCreationInProgress = useRef(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const storedDevRole = UI_DEV_MODE && hydrated ? getStoredDevRole() : null;
  const storedDevProfile = storedDevRole ? getDevProfile(storedDevRole) : null;
  const authProfile = UI_DEV_MODE ? profile ?? storedDevProfile : profile;
  const authUser = UI_DEV_MODE
    ? user ?? (storedDevProfile ? createDevUser(storedDevProfile) : null)
    : user;
  const authLoading = UI_DEV_MODE ? !hydrated : loading;

  const fetchExistingProfile = async (firebaseUser: User) => {
    const nextProfile = await getUserProfile(firebaseUser.uid);
    if (!nextProfile) {
      await signOut(auth);
      throw new AppError("AUTH_REQUIRED", "Sua autenticação existe, mas o perfil JusFácil não foi encontrado. Contate o suporte.");
    }
    setProfile(nextProfile);
    return nextProfile;
  };

  const applyDevRole = async (role: DevRole) => {
    const nextProfile = getDevProfile(role);
    storeDevRole(role);
    setProfile(nextProfile);
    setUser(createDevUser(nextProfile));
    setLoading(false);
  };

  useEffect(() => {
    if (UI_DEV_MODE || !isFirebaseConfigured) return;

    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // createUserWithEmailAndPassword fires this observer before the profile
      // write finishes. The signup flow owns loading/profile state in that window.
      if (profileCreationInProgress.current) return;
      void fetchExistingProfile(firebaseUser).catch(() => setProfile(null)).finally(() => setLoading(false));
    });
  }, []);

  const refreshProfile = async () => {
    if (!authUser) throw new AppError("AUTH_REQUIRED");
    if (UI_DEV_MODE) {
      const nextProfile = devGetUserProfile(authUser.uid);
      if (!nextProfile) throw new AppError("AUTH_REQUIRED");
      setProfile(nextProfile);
      setUser(createDevUser(nextProfile));
      return;
    }
    await fetchExistingProfile(authUser as User);
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (UI_DEV_MODE) {
      throw new AppError("FIREBASE_NOT_CONFIGURED", "O login real está arquivado enquanto o modo visual de desenvolvimento estiver ativo.");
    }
    assertFirebaseConfigured();
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(result.user);
      await fetchExistingProfile(result.user);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (data: CitizenSignup | LawyerSignup, lawyer: boolean) => {
    if (UI_DEV_MODE) {
      throw new AppError("FIREBASE_NOT_CONFIGURED", "O cadastro real está arquivado enquanto o modo visual de desenvolvimento estiver ativo.");
    }
    assertFirebaseConfigured();
    profileCreationInProgress.current = true;
    setLoading(true);
    let createdUser: User | undefined;
    try {
      const result = await createUserWithEmailAndPassword(auth, data.email.trim(), data.pass);
      createdUser = result.user;
      const timestamp = now();
      const nextProfile: UserProfile = {
        uid: result.user.uid,
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        role: lawyer ? "LAWYER" : "CITIZEN",
        cpf: data.cpf?.trim() || undefined,
        username: data.username?.trim() || undefined,
        ...(lawyer ? {
          oabNumber: (data as LawyerSignup).oabNumber.trim(),
          oabState: (data as LawyerSignup).oabState.trim().toUpperCase(),
          lawyerStatus: "PENDING" as const,
        } : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await createUserProfile(nextProfile);
      setUser(result.user);
      setProfile(nextProfile);
    } catch (error) {
      if (createdUser) await deleteUser(createdUser).catch(() => undefined);
      throw error;
    } finally {
      profileCreationInProgress.current = false;
      setLoading(false);
    }
  };

  const signupCitizen = (data: CitizenSignup) => createAccount(data, false);
  const signupLawyer = (data: LawyerSignup) => createAccount(data, true);

  const loginWithGoogle = async () => {
    if (UI_DEV_MODE) {
      throw new AppError("FIREBASE_NOT_CONFIGURED", "O login Google real está arquivado enquanto o modo visual de desenvolvimento estiver ativo.");
    }
    assertFirebaseConfigured();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      let nextProfile = await getUserProfile(result.user.uid);
      if (!nextProfile && getAdditionalUserInfo(result)?.isNewUser) {
        const timestamp = now();
        nextProfile = {
          uid: result.user.uid,
          fullName: result.user.displayName?.trim() || "Usuário JusFácil",
          email: result.user.email ?? "",
          role: "CITIZEN",
          avatarUrl: result.user.photoURL ?? undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await createUserProfile(nextProfile);
      }
      if (!nextProfile) {
        await signOut(auth);
        throw new AppError("AUTH_REQUIRED", "Perfil JusFácil não encontrado para esta conta Google.");
      }
      setUser(result.user);
      setProfile(nextProfile);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (UI_DEV_MODE) return;
    assertFirebaseConfigured();
    await sendPasswordResetEmail(auth, email.trim());
  };

  const changePassword = async (password: string) => {
    if (!authUser) throw new AppError("AUTH_REQUIRED");
    if (password.length < 6) throw new AppError("VALIDATION_ERROR", "A senha deve ter pelo menos 6 caracteres.");
    if (UI_DEV_MODE) return;
    await updatePassword(authUser as User, password);
  };

  const logout = async () => {
    if (UI_DEV_MODE) {
      clearStoredDevRole();
      setUser(null);
      setProfile(null);
      return;
    }
    assertFirebaseConfigured();
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        profile: authProfile,
        loading: authLoading,
        devMode: UI_DEV_MODE,
        enterDevMode: applyDevRole,
        loginWithEmail,
        signupCitizen,
        signupLawyer,
        loginWithGoogle,
        resetPassword,
        changePassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}

export const DEV_PROFILE_IDS = {
  citizen: DEV_CITIZEN_UID,
  lawyer: DEV_LAWYER_UID,
} as const;
