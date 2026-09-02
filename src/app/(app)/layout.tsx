import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { ImpersonandoBanner } from "@/components/impersonando-banner";
import { MainShell } from "@/components/main-shell";
import { NotificacoesPonte } from "@/components/notificacoes-ponte";
import { Sidebar } from "@/components/sidebar";
import { SessionProvider } from "@/components/session-provider";
import { AgendaProvider } from "@/lib/agenda-context";
import { AutomacoesProvider } from "@/lib/automacoes-context";
import { AutomationFlowProvider } from "@/lib/automation-flow-context";
import { BibliotecaDocumentosProvider } from "@/lib/biblioteca-documentos-context";
import { CentralDiaProvider } from "@/lib/central-dia-context";
import { ConfiguracoesProvider } from "@/lib/configuracoes-context";
import { ConfigConversasProvider } from "@/lib/conversas-config-context";
import { ConversasProvider } from "@/lib/conversas-context";
import { ContatosProvider } from "@/lib/contatos-context";
import { DocumentosProvider } from "@/lib/documentos-context";
import { EquipeProvider } from "@/lib/equipe-context";
import { FormulariosProvider } from "@/lib/formularios-context";
import { FunisProvider } from "@/lib/funis-context";
import { MensagensExtraProvider } from "@/lib/mensagens-extra-context";
import { NotificacoesProvider } from "@/lib/notificacoes-context";
import { TarefasProvider } from "@/lib/tarefas-context";

/**
 * Porta de entrada do CRM — nenhuma tela interna renderiza sem sessão.
 *
 * Antes disto, a proteção era só das APIs: as páginas montavam normalmente pra quem não estava
 * logado, e só os dados não vinham. Além de ser uma experiência ruim (tela do CRM vazia em vez de
 * login), é uma superfície a mais — todo o JavaScript da aplicação, com nomes de rota, estrutura e
 * campos, era entregue a qualquer visitante.
 *
 * A checagem é de SERVIDOR (`auth()` + `redirect`), então não dá pra contornar pelo navegador. As
 * APIs continuam validando por conta própria: se um dia esta camada falhar ou for esquecida numa
 * rota nova, os dados seguem protegidos. Defesa em profundidade — nenhuma das duas confia na outra.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessao = await auth();
  if (!sessao) redirect("/login");

  return (
    <SessionProvider>
    <FunisProvider>
      <ContatosProvider>
      <ConversasProvider>
        <EquipeProvider>
          <TarefasProvider>
            <AgendaProvider>
              <AutomacoesProvider>
                <AutomationFlowProvider>
                  <NotificacoesProvider>
                    <FormulariosProvider>
                      <DocumentosProvider>
                        <BibliotecaDocumentosProvider>
                          <ConfigConversasProvider>
                            <MensagensExtraProvider>
                              <CentralDiaProvider>
                                <ConfiguracoesProvider>
                                  <div className="shell">
                                    <NotificacoesPonte />
                                    <Sidebar />
                                    <MainShell>
                                      <ImpersonandoBanner />
                                      <AppHeader />
                                      {children}
                                    </MainShell>
                                  </div>
                                </ConfiguracoesProvider>
                              </CentralDiaProvider>
                            </MensagensExtraProvider>
                          </ConfigConversasProvider>
                        </BibliotecaDocumentosProvider>
                      </DocumentosProvider>
                    </FormulariosProvider>
                  </NotificacoesProvider>
                </AutomationFlowProvider>
              </AutomacoesProvider>
            </AgendaProvider>
          </TarefasProvider>
        </EquipeProvider>
      </ConversasProvider>
      </ContatosProvider>
    </FunisProvider>
    </SessionProvider>
  );
}
