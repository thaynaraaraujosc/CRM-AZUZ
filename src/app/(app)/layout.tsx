import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <AppHeader />
        {children}
      </main>
    </div>
  );
}
