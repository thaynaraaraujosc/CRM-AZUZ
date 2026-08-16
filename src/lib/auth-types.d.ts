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
    /** Id da linha `SessaoAtiva` desta sessão (ver `src/lib/auth.ts`) — usado pelo callback `jwt`
     * pra revogar de verdade quando a pessoa clica "Encerrar sessão". Ausente na impersonação. */
    jti?: string;
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
    /** Id da `SessaoAtiva` da sessão atual — pra Configurações > Segurança marcar "esta sessão". */
    jti?: string;
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
    jti?: string;
  }
}
