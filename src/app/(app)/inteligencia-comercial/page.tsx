"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A Visão geral foi incorporada à página "Início" — não faz sentido ter
 * duas visões gerais em áreas diferentes do CRM (ver reestruturação da
 * Inteligência comercial). Esta rota fica só como redirecionamento pra
 * quem tiver o link antigo salvo.
 */
export default function InteligenciaComercialRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inicio");
  }, [router]);
  return null;
}
