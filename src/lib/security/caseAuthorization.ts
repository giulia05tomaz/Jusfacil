import type { LegalCase, UserProfile } from "@/types";

export function isAuthorizedForCase(uid: string, user: Pick<UserProfile, "role" | "lawyerStatus">, legalCase: Pick<LegalCase, "citizenId" | "assignedLawyerId">): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "CITIZEN") return legalCase.citizenId === uid;
  return user.role === "LAWYER" && user.lawyerStatus === "APPROVED" && legalCase.assignedLawyerId === uid;
}
