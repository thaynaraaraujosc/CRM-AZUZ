import type { Metadata } from "next";

import { CabecalhoConvidar } from "@/components/equipe/CabecalhoConvidar";
import { ConvidarForm } from "@/components/equipe/ConvidarForm";

export const metadata: Metadata = { title: "Convidar membro · CRM AZUZ" };

export default function ConvidarPage() {
  return (
    <>
      <CabecalhoConvidar />

      <div className="content">
        <ConvidarForm />
      </div>
    </>
  );
}
