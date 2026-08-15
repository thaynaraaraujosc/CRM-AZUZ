import { useEffect, useState } from "react";

export type StatusIntegracaoMeta = {
  status: "desconectado" | "conectado" | "erro";
  metadados: Record<string, unknown> | null;
  erroMensagem: string | null;
};

/**
 * Estado de conexão de uma integração da Meta (`meta_whatsapp`/`meta_instagram`/`meta_ads`) — usado
 * pelas telas de Configurações e pela página de Tráfego, que só diferem no `provedor` e em quais
 * campos de `metadados` mostram. Centraliza fetch/desconectar/leitura do erro pós-redirect do OAuth
 * pra não duplicar essa lógica em cada tela.
 */
export function useIntegracaoMeta(provedor: string) {
  const [integracao, setIntegracao] = useState<StatusIntegracaoMeta | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  // Lido direto de `window.location` (não `useSearchParams`) — as telas que usam esse hook não têm
  // um limite <Suspense> em volta, e é só pra mostrar um erro pontual depois do redirect do OAuth.
  // Inicializador preguiçoso (não um efeito): já roda com o valor certo na primeira renderização.
  const [erroDoRedirect] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("integracaoErro"),
  );

  function carregarIntegracao() {
    fetch(`/api/integracoes/meta?provedor=${provedor}`)
      .then((r) => r.json())
      .then(setIntegracao)
      .catch((erro) => console.error(`Falha ao carregar status de ${provedor}:`, erro));
  }

  useEffect(() => {
    carregarIntegracao();
    // `carregarIntegracao` só depende de `provedor` (já listado); redeclarar a cada render não deve
    // reexecutar o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provedor]);

  async function desconectar() {
    setDesconectando(true);
    try {
      await fetch(`/api/integracoes/meta/desconectar?provedor=${provedor}`, { method: "POST" });
      carregarIntegracao();
    } finally {
      setDesconectando(false);
    }
  }

  return { integracao, desconectando, desconectar, erroDoRedirect };
}
