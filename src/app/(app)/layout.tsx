import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { AutomacoesProvider } from "@/lib/automacoes-context";
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
          <NotificacoesProvider>
            <FormulariosProvider>
              <DocumentosProvider>
                <div className="shell">
                  <Sidebar />
                  <main className="main">
                    <AppHeader />
                    {children}
                  </main>
                </div>
              </DocumentosProvider>
            </FormulariosProvider>
          </NotificacoesProvider>
        </AutomacoesProvider>
      </ContatosProvider>
    </FunisProvider>
  );
}
