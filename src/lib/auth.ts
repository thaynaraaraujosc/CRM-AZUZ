import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credenciais) {
        const email = credenciais?.email;
        const senha = credenciais?.senha;
        if (typeof email !== "string" || typeof senha !== "string") return null;

        const membro = await prisma.membro.findUnique({
          where: { email },
          include: { workspace: true },
        });
        if (!membro || !membro.senha || !membro.ativo) return null;

        const senhaValida = await bcrypt.compare(senha, membro.senha);
        if (!senhaValida) return null;

        // Super-admin da plataforma (não confundir com `papelTipo: "admin"`, que é só admin do
        // próprio workspace) — decidido por e-mail via env var em vez de coluna no banco, porque é
        // uma conta só (a da Azuz), não um papel que qualquer workspace atribui a alguém.
        const superAdmin = membro.email.toLowerCase() === process.env.SUPERADMIN_EMAIL?.toLowerCase();

        return {
          id: membro.id,
          name: membro.nome,
          email: membro.email,
          workspaceId: membro.workspaceId,
          workspaceNome: membro.workspace.nome,
          initials: membro.initials,
          papelTipo: membro.papelTipo,
          role: membro.papel,
          superAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.workspaceId = user.workspaceId;
        token.workspaceNome = user.workspaceNome;
        token.initials = user.initials;
        token.papelTipo = user.papelTipo;
        token.role = user.role;
        token.superAdmin = user.superAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.workspaceId = token.workspaceId as string;
      session.user.workspaceNome = token.workspaceNome as string;
      session.user.initials = token.initials as string;
      session.user.papelTipo = token.papelTipo as string;
      session.user.role = token.role as string;
      session.user.superAdmin = Boolean(token.superAdmin);
      return session;
    },
  },
});
