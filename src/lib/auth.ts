import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { POLITICAS, contarChamada, ipDeQuemChamou } from "@/lib/seguranca/limite-de-uso";

import { prisma } from "@/lib/prisma";
import { verificarTokenImpersonar } from "@/lib/admin/impersonar";

function ehSuperAdmin(email: string): boolean {
  return email.toLowerCase() === process.env.SUPERADMIN_EMAIL?.toLowerCase();
}

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

        // `authorize` devolvendo `null` cobre quatro situações bem diferentes — e-mail que não
        // existe, conta desativada, conta sem senha e senha errada — que na tela viram a mesma
        // frase. Isso é proposital pra fora (dizer "esse e-mail não existe" entrega quem tem conta),
        // mas sem registro nenhum ficava impossível diagnosticar de dentro. O log fica no servidor,
        // com o e-mail e o motivo, nunca a senha.
        // Trava de força bruta, ANTES de tocar no banco.
        //
        // A chave combina IP e e-mail de propósito. Só por IP, um escritório inteiro atrás do mesmo
        // endereço é punido junto. Só por e-mail, qualquer pessoa consegue trancar a conta de outra
        // — vira um jeito fácil de derrubar um cliente, que é o oposto de segurança. Combinando os
        // dois, o ataque precisa variar as duas pontas, e um usuário legítimo nunca esbarra.
        const ip = await ipDeQuemChamou();
        const limite = contarChamada(`login:${ip}:${email}`, POLITICAS.login);
        if (!limite.permitido) {
          // O log registra o e-mail e o motivo — nunca a senha tentada.
          console.warn(`[login] bloqueado por excesso de tentativas: ${email}`);
          return null;
        }

        let membro;
        try {
          membro = await prisma.membro.findUnique({ where: { email }, include: { workspace: true } });
        } catch (erro) {
          // Banco fora do ar. Lançar (em vez de devolver `null`) mantém a diferença entre "não
          // consegui conferir" e "conferi e está errado" — ver `/api/saude/banco`, que é o que a
          // tela de login consulta pra não acusar a senha de uma falha de infraestrutura.
          console.error("[login] falha ao consultar o banco:", erro instanceof Error ? erro.message : erro);
          throw erro;
        }
        if (!membro) {
          console.warn(`[login] recusado: nenhum membro com o e-mail ${email}.`);
          return null;
        }
        if (!membro.ativo) {
          console.warn(`[login] recusado: conta de ${email} está desativada.`);
          return null;
        }
        if (!membro.senha) {
          console.warn(`[login] recusado: ${email} não tem senha definida (convite não aceito?).`);
          return null;
        }

        const senhaValida = await bcrypt.compare(senha, membro.senha);
        if (!senhaValida) {
          console.warn(`[login] recusado: senha incorreta para ${email}.`);
          return null;
        }

        // Fire-and-forget — não atrasa o login por causa disso; só alimenta a coluna "Último
        // acesso" em Configurações > Usuários.
        prisma.membro.update({ where: { id: membro.id }, data: { ultimoAcesso: new Date() } }).catch(() => {});

        return {
          id: membro.id,
          name: membro.nome,
          email: membro.email,
          workspaceId: membro.workspaceId,
          workspaceNome: membro.workspace.nome,
          initials: membro.initials,
          papelTipo: membro.papelTipo,
          role: membro.papel,
          permissoes: Array.isArray(membro.permissoes) ? (membro.permissoes as string[]) : [],
          // Super-admin da plataforma (não confundir com `papelTipo: "admin"`, que é só admin do
          // próprio workspace) — decidido por e-mail via env var em vez de coluna no banco, porque
          // é uma conta só (a da Azuz), não um papel que qualquer workspace atribui a alguém.
          superAdmin: ehSuperAdmin(membro.email),
        };
      },
    }),
    Credentials({
      id: "impersonar",
      name: "Impersonar",
      credentials: { membroId: { label: "membroId" }, token: { label: "token" } },
      /**
       * "Entrar como" — troca a sessão atual pela de outro Membro sem pedir senha nenhuma dele.
       * Só funciona com um token de curta duração emitido por `POST /api/admin/membros/[id]/
       * impersonar` (super-admin) ou `POST /api/impersonar/voltar` (retorno de quem estava
       * impersonando) — ver `src/lib/admin/impersonar.ts`. Sem token válido, não autentica ninguém.
       */
      async authorize(credenciais) {
        const membroId = credenciais?.membroId;
        const token = credenciais?.token;
        if (typeof membroId !== "string" || typeof token !== "string") return null;

        const verificado = verificarTokenImpersonar(token);
        if (!verificado || verificado.membroId !== membroId) return null;

        const membro = await prisma.membro.findUnique({ where: { id: membroId }, include: { workspace: true } });
        if (!membro || !membro.ativo) return null;

        return {
          id: membro.id,
          name: membro.nome,
          email: membro.email,
          workspaceId: membro.workspaceId,
          workspaceNome: membro.workspace.nome,
          initials: membro.initials,
          papelTipo: membro.papelTipo,
          role: membro.papel,
          permissoes: Array.isArray(membro.permissoes) ? (membro.permissoes as string[]) : [],
          superAdmin: ehSuperAdmin(membro.email),
          impersonadoPorId: verificado.superAdminId ?? undefined,
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
        token.permissoes = user.permissoes;
        token.superAdmin = user.superAdmin;
        // Some do token quando a sessão nova não é impersonação (login normal ou "voltar pro
        // admin") — senão o campo ficaria "grudado" indefinidamente numa sessão que já não é mais
        // um "entrar como".
        token.impersonadoPorId = user.impersonadoPorId;
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
      session.user.permissoes = Array.isArray(token.permissoes) ? (token.permissoes as string[]) : [];
      session.user.superAdmin = Boolean(token.superAdmin);
      session.user.impersonadoPorId = token.impersonadoPorId as string | undefined;
      return session;
    },
  },
});
