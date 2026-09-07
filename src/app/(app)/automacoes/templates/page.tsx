"use client";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";

export default function TemplatesPage() {
  return (
    <>
      <Topbar title="Templates" sub="Mensagens reutilizáveis para disparos e automações" />
      <AbasAutomacoes />
      <div className="content" />
    </>
  );
}
