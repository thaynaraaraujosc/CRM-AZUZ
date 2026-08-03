import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { AutomacoesProvider } from "@/lib/automacoes-context";
import { AutomationFlowProvider } from "@/lib/automation-flow-context";
import { BibliotecaDocumentosProvider } from "@/lib/biblioteca-documentos-context";
import { CentralDiaProvider } from "@/lib/central-dia-context";
import { ConfiguracoesProvider } from "@/lib/configuracoes-context";
import { ConfigConversasProvider } from "@/lib/conversas-config-context";
import { ContatosProvider } from "@/lib/contatos-context";
import { DocumentosProvider } from "@/lib/documentos-context";
import { FormulariosProvider } from "@/lib/formularios-context";
import { FunisProvider } from "@/lib/funis-context";
import { NotificacoesProvider } from "@/lib/notificacoes-context";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FunisProvider>
      <ContatosProvider>
        <AutomacoesProvider>
          <AutomationFlowProvider>
            <NotificacoesProvider>
              <FormulariosProvider>
                <DocumentosProvider>
                  <BibliotecaDocumentosProvider>
                    <ConfigConversasProvider>
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
                    </ConfigConversasProvider>
                  </BibliotecaDocumentosProvider>
                </DocumentosProvider>
              </FormulariosProvider>
            </NotificacoesProvider>
          </AutomationFlowProvider>
        </AutomacoesProvider>
      </ContatosProvider>
    </FunisProvider>
  );
}
