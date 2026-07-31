import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { FunisProvider } from "@/lib/funis-context";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FunisProvider>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <AppHeader />
          {children}
        </main>
      </div>
    </FunisProvider>
  );
}
