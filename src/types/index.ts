export type UserRole = "owner" | "tenant";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
