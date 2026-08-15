import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SessionProvider } from "@/components/session-provider";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Layout do painel de super-admin — fora do grupo `(app)` de propósito: aquele layout monta uma
 * dúzia de providers workspace-scoped (Contatos/Funis/Equipe/...) que buscam dado do
 * `session.user.workspaceId` de quem está logado, e aqui a visão é cross-tenant, não faz sentido
 * nenhum desses providers. O proxy já bloqueia quem não é super-admin antes de chegar num Server
 * Component — esse `redirect` aqui é só defesa em profundidade.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sessao = await auth();
  if (!sessao?.user.superAdmin) redirect("/inicio");

  return (
    <SessionProvider>
      <div className="shell">
        <AdminSidebar />
        <main className="main">{children}</main>
      </div>
    </SessionProvider>
  );
}
