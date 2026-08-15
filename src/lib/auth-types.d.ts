import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    workspaceId: string;
    workspaceNome: string;
    initials: string;
    papelTipo: string;
    role: string;
    permissoes: string[];
    superAdmin: boolean;
    /** Id do Membro super-admin que iniciou a impersonação — só existe enquanto a sessão atual é
     * um "entrar como" de outro usuário; ausente numa sessão normal. */
    impersonadoPorId?: string;
  }

  interface Session {
    user: {
      workspaceId: string;
      workspaceNome: string;
      initials: string;
      papelTipo: string;
      role: string;
      permissoes: string[];
      superAdmin: boolean;
      impersonadoPorId?: string;
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
    permissoes: string[];
    superAdmin: boolean;
    impersonadoPorId?: string;
  }
}
