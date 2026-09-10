"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updatePassword, type User } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./config";
import { createUserProfile, getUserProfile } from "./services";
import { AppError } from "@/lib/errors";
import type { UserProfile } from "@/types";

interface CitizenSignup { fullName: string; email: string; pass: string; cpf?: string; username?: string }
interface LawyerSignup extends CitizenSignup { oabNumber: string; oabState: string }
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
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

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured) throw new AppError("FIREBASE_NOT_CONFIGURED");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const profileCreationInProgress = useRef(false);

  const fetchExistingProfile = async (firebaseUser: User) => {
    const nextProfile = await getUserProfile(firebaseUser.uid);
    if (!nextProfile) {
      await signOut(auth);
      throw new AppError("AUTH_REQUIRED", "Sua autenticação existe, mas o perfil JusFácil não foi encontrado. Contate o suporte.");
    }
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }
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
    if (!user) throw new AppError("AUTH_REQUIRED");
    await fetchExistingProfile(user);
  };

  const loginWithEmail = async (email: string, password: string) => {
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
    assertFirebaseConfigured();
    await sendPasswordResetEmail(auth, email.trim());
  };

  const changePassword = async (password: string) => {
    if (!user) throw new AppError("AUTH_REQUIRED");
    await updatePassword(user, password);
  };

  const logout = async () => {
    assertFirebaseConfigured();
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return <AuthContext.Provider value={{ user, profile, loading, loginWithEmail, signupCitizen, signupLawyer, loginWithGoogle, resetPassword, changePassword, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
