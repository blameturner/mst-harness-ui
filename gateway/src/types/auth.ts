export type AuthVariables = {
  userId: string;
  orgId: number;
  email: string;
};

export interface AuthContext {
  userId: string;
  orgId: number;
  email: string;
}
