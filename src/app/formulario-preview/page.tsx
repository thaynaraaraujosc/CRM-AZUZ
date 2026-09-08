"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { FormularioPublico } from "@/components/formularios/FormularioPublico";

/**
 * Pré-visualização, aberta de dentro do CRM pelo botão "Pré-visualizar".
 *
 * Só descobre o `id` e a `chave` na query string e entrega pro componente. A tela em si é a mesma
 * que o link público abre (ver `FormularioPublico`), de propósito: uma pré-visualização que
 * renderiza por um caminho diferente do real acaba mostrando algo que o lead não vê.
 */
function PreviaConteudo() {
  const searchParams = useSearchParams();
  return <FormularioPublico id={searchParams.get("id")} chave={searchParams.get("chave")} />;
}

export default function FormularioPreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviaConteudo />
    </Suspense>
  );
}
