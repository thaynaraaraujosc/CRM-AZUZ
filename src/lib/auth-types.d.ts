import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    workspaceId: string;
    workspaceNome: string;
    initials: string;
    papelTipo: string;
    role: string;
    superAdmin: boolean;
  }

  interface Session {
    user: {
      workspaceId: string;
      workspaceNome: string;
      initials: string;
      papelTipo: string;
      role: string;
      superAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    workspaceId: string;
    workspaceNome: string;
    initials: string;
    papelTipo: string;
    role: string;
    superAdmin: boolean;
  }
}
