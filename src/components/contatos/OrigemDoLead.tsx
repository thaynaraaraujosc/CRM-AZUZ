"use client";

import { useEffect, useState } from "react";

type Origem = {
  plataforma: string;
  campanhaNome: string | null;
  campanhaId: string | null;
  conjuntoNome: string | null;
  anuncioNome: string | null;
  anuncioId: string | null;
  palavraChave: string | null;
  utmCampaign: string | null;
  paginaEntrada: string | null;
  caminho: string;
  criadoEm: string;
};

const NOME_DA_PLATAFORMA: Record<string, string> = { google: "Google Ads", meta: "Meta Ads" };

/**
 * De qual anúncio esta pessoa veio.
 *
 * Só aparece pra quem TEM origem rastreada, e some para todo o resto. A maioria dos contatos entrou
 * por indicação, pela agenda ou na mão, e um bloco dizendo "sem origem" em todos eles seria ruído
 * repetido em cada ficha — do tipo que faz a tela parecer quebrada.
 */
export function OrigemDoLead({ contatoId }: { contatoId: string }) {
  const [origem, setOrigem] = useState<Origem | null>(null);

  // Limpa ao trocar de contato AJUSTANDO DURANTE A RENDERIZAÇÃO, e não dentro do efeito (regra
  // `react-hooks/set-state-in-effect`, o mesmo padrão já usado na tela de Tráfego). Sem isso, a
  // ficha de um contato mostraria por um instante a origem do contato anterior — que é pior do
  // que não mostrar nada, porque é informação errada com cara de certa.
  const [ultimoContato, setUltimoContato] = useState<string | null>(null);
  if (contatoId !== ultimoContato) {
    setUltimoContato(contatoId);
    setOrigem(null);
  }

  useEffect(() => {
    fetch(`/api/rastreio/origem?contatoId=${encodeURIComponent(contatoId)}`)
      .then((r) => (r.ok ? r.json() : { origem: null }))
      .then((d: { origem: Origem | null }) => setOrigem(d.origem))
      .catch((erro) => console.error("Falha ao carregar a origem do lead:", erro));
  }, [contatoId]);

  if (!origem) return null;

  const linhas: [string, string][] = [
    ["Plataforma", NOME_DA_PLATAFORMA[origem.plataforma] ?? origem.plataforma],
    // O id entra entre parênteses quando não há nome: campanha sem nome é o normal quando o
    // anúncio não manda o parâmetro, e mostrar só "—" esconderia um dado que existe.
    ["Campanha", origem.campanhaNome ?? origem.utmCampaign ?? (origem.campanhaId ? `#${origem.campanhaId}` : "")],
    ["Conjunto", origem.conjuntoNome ?? ""],
    ["Anúncio", origem.anuncioNome ?? (origem.anuncioId ? `#${origem.anuncioId}` : "")],
    ["Palavra-chave", origem.palavraChave ?? ""],
  ].filter(([, valor]) => valor) as [string, string][];

  return (
    <div className="field" style={{ margin: "0 17px 14px" }}>
      <label>Veio de um anúncio</label>
      {linhas.map(([rotulo, valor]) => (
        <div className="stat-row" key={rotulo}>
          <span className="sl">{rotulo}</span>
          <span className="sv">{valor}</span>
        </div>
      ))}
      <p className="hint" style={{ margin: "6px 0 0" }}>
        Registrado em {new Date(origem.criadoEm).toLocaleDateString("pt-BR")}, pelo{" "}
        {origem.caminho === "whatsapp" ? "WhatsApp" : origem.caminho === "instagram" ? "Instagram" : origem.caminho}.
      </p>
    </div>
  );
}
