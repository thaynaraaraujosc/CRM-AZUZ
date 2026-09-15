"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROTA_INICIAL } from "@/lib/rota-inicial";

/**
 * A Visão geral foi incorporada à página "Início". Não faz sentido ter
 * duas visões gerais em áreas diferentes do CRM (ver reestruturação da
 * Inteligência comercial). Esta rota fica só como redirecionamento pra
 * quem tiver o link antigo salvo.
 */
export default function InteligenciaComercialRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ROTA_INICIAL);
  }, [router]);
  return null;
}
