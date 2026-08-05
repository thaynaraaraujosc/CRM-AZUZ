import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { SessionProvider } from "@/components/session-provider";
import { AgendaProvider } from "@/lib/agenda-context";
import { AutomacoesProvider } from "@/lib/automacoes-context";
import { AutomationFlowProvider } from "@/lib/automation-flow-context";
import { BibliotecaDocumentosProvider } from "@/lib/biblioteca-documentos-context";
import { CentralDiaProvider } from "@/lib/central-dia-context";
import { ConfiguracoesProvider } from "@/lib/configuracoes-context";
import { ConfigConversasProvider } from "@/lib/conversas-config-context";
import { ContatosProvider } from "@/lib/contatos-context";
import { DocumentosProvider } from "@/lib/documentos-context";
import { EquipeProvider } from "@/lib/equipe-context";
import { FormulariosProvider } from "@/lib/formularios-context";
import { FunisProvider } from "@/lib/funis-context";
import { MensagensExtraProvider } from "@/lib/mensagens-extra-context";
import { NotificacoesProvider } from "@/lib/notificacoes-context";
import { TarefasProvider } from "@/lib/tarefas-context";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
    <FunisProvider>
      <ContatosProvider>
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
                                    <Sidebar />
                                    <main className="main">
                                      <AppHeader />
                                      {children}
                                    </main>
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
      </ContatosProvider>
    </FunisProvider>
    </SessionProvider>
  );
}
