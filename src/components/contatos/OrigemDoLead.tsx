"use client";

import { useEffect, useState } from "react";
import { useIdioma } from "@/lib/idioma-context";
import { Ajuda } from "@/components/ui";

type Toque = {
  utmSource?: string | null;
  utmCampaign?: string | null;
  campanhaNome?: string | null;
  anuncioNome?: string | null;
  caminho?: string | null;
};

type Origem = {
  plataforma: string;
  campanhaNome: string | null;
  campanhaId: string | null;
  conjuntoNome: string | null;
  anuncioNome: string | null;
  anuncioId: string | null;
  palavraChave: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  paginaEntrada: string | null;
  caminho: string;
  criadoEm: string;
  ultimoToque: Toque | null;
  ultimoToqueEm: string | null;
  /** Só se EXISTE. O código em si não sai do servidor: ver a rota `/api/rastreio/origem`. */
  temCodigoDeClique: boolean;
  tipoDoClique: string | null;
};

const NOME_DA_PLATAFORMA: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok Ads",
  // "outro" é o tráfego marcado e não comprado: newsletter, parceiro, QR code de panfleto.
  outro: "Marcação própria (UTM)",
};

const NOME_DO_CAMINHO: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  formulario: "formulário",
};

/**
 * De qual anúncio esta pessoa veio.
 *
 * Só aparece pra quem TEM origem rastreada, e some para todo o resto. A maioria dos contatos entrou
 * por indicação, pela agenda ou na mão, e um bloco dizendo "sem origem" em todos eles seria ruído
 * repetido em cada ficha — do tipo que faz a tela parecer quebrada.
 */
export function OrigemDoLead({ contatoId }: { contatoId: string }) {
  const { t: traduzir } = useIdioma();
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
    ["utm_source", origem.utmSource ?? ""],
    ["utm_medium", origem.utmMedium ?? ""],
    ["utm_content", origem.utmContent ?? ""],
    ["Veio de", origem.referrer ?? ""],
    ["Caiu em", origem.paginaEntrada ?? ""],
  ].filter(([, valor]) => valor) as [string, string][];

  /*
   * O ÚLTIMO TOQUE SÓ APARECE QUANDO ELE É OUTRO.
   *
   * Na maioria dos leads o primeiro e o último toque são o mesmo — a pessoa clicou no anúncio e
   * falou na hora. Repetir a mesma informação embaixo dela mesma faria o bloco parecer errado. O
   * último toque importa quando ele DIVERGE: é aí que ele explica por que a pessoa voltou agora, e
   * é aí que desligar a campanha errada custa dinheiro.
   */
  const ultimo = origem.ultimoToque;
  const ultimoDiverge =
    ultimo &&
    ((ultimo.utmSource ?? null) !== origem.utmSource ||
      (ultimo.campanhaNome ?? null) !== origem.campanhaNome ||
      (ultimo.caminho ?? null) !== origem.caminho);

  return (
    <div className="field" style={{ margin: "0 17px 14px" }}>
      <label>
        {traduzir("Veio de um anúncio")}
        <Ajuda
          texto={traduzir(
            "O primeiro toque é o que trouxe esta pessoa até você, e ele nunca muda: é dele que a venda recebe o crédito quando a conversão volta pra plataforma. O último é por onde ela voltou mais recentemente.",
          )}
        />
      </label>
      {linhas.map(([rotulo, valor]) => (
        <div className="stat-row" key={rotulo}>
          <span className="sl">{rotulo}</span>
          <span className="sv">{valor}</span>
        </div>
      ))}
      <p className="hint" style={{ margin: "6px 0 0" }}>
        Primeiro toque em {new Date(origem.criadoEm).toLocaleDateString("pt-BR")}, pelo{" "}
        {NOME_DO_CAMINHO[origem.caminho] ?? origem.caminho}.
        {/* Sem código de clique a campanha ainda aparece na tela, só não há como devolver a venda
            pra plataforma por clique — e saber disso é o que explica um relatório sem conversão. */}
        {origem.temCodigoDeClique
          ? ` Tem código de clique (${origem.tipoDoClique}).`
          : " Sem código de clique: a conversão só pode ser devolvida por e-mail ou telefone."}
      </p>
      {ultimoDiverge ? (
        <p className="hint" style={{ margin: "4px 0 0" }}>
          Último toque
          {origem.ultimoToqueEm ? ` em ${new Date(origem.ultimoToqueEm).toLocaleDateString("pt-BR")}` : ""}:{" "}
          {ultimo?.campanhaNome ?? ultimo?.utmCampaign ?? ultimo?.utmSource ?? ultimo?.anuncioNome ?? "—"}
          {ultimo?.caminho ? `, pelo ${NOME_DO_CAMINHO[ultimo.caminho] ?? ultimo.caminho}` : ""}.
        </p>
      ) : null}
    </div>
  );
}
