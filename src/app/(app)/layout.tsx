import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { ContatosProvider } from "@/lib/contatos-context";
import { FunisProvider } from "@/lib/funis-context";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FunisProvider>
      <ContatosProvider>
        <div className="shell">
          <Sidebar />
          <main className="main">
            <AppHeader />
            {children}
          </main>
        </div>
      </ContatosProvider>
    </FunisProvider>
  );
}
