"use client";

import { useEffect, useMemo, useState } from "react";

import { IconClose, IconInstagram } from "@/components/icons";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { blocoValeNaArea, CAPACIDADES, type AreaAutomacao } from "@/lib/canais/capacidades";
import type { FlowNodeType } from "@/lib/automation-flow/types";

/**
 * Escolher o gatilho de uma automação social, em etapas.
 *
 * Um gatilho tem duas perguntas, e elas são de naturezas diferentes: QUAL evento começa a
 * automação, e EM QUE ele vale (qualquer publicação, ou uma só; qualquer palavra, ou algumas).
 * Juntas num formulário, a segunda aparece antes de a primeira ter sido respondida e a tela fica
 * cheia de campos que ainda não fazem sentido. Separadas, cada tela tem uma pergunta.
 *
 * O painel abre pela ESQUERDA. Enquanto se escolhe o gatilho, o que importa olhar é o desenho do
 * fluxo à direita, e um modal no meio esconderia justamente isso.
 */

/** Um gatilho que a tela oferece, e o que ele precisa perguntar depois de escolhido. */
type GatilhoOferecido = {
  tipo: FlowNodeType;
  label: string;
  descricao: string;
  /** Pergunta de escopo, quando o gatilho tem uma. Ausente = o gatilho vale sempre. */
  escopo?: { pergunta: string; qualquer: string; especifico: string; campo: "publicacaoId" };
  /** O gatilho aceita filtro por palavra. */
  temPalavras: boolean;
};

/**
 * Os gatilhos que NÃO existem, com o motivo.
 *
 * Ficam visíveis e desligados de propósito. Escondê-los deixaria "cadê o comentário de live?" sem
 * resposta em lugar nenhum do produto; oferecê-los faria a pessoa montar o fluxo inteiro em volta
 * de um evento que nunca chega.
 */
const INDISPONIVEIS: { label: string; motivo: string }[] = [
  {
    label: "Comentário em transmissão ao vivo",
    motivo: "A Meta não manda webhook de comentário de live pra este produto de API.",
  },
  {
    label: "Disparo manual",
    motivo: "Já existe, mas dentro da conversa do contato: “rodar automação”. Não é um gatilho do fluxo.",
  },
];

function oferecidos(area: AreaAutomacao): GatilhoOferecido[] {
  const definicao = (tipo: FlowNodeType) => BLOCOS_DISPONIVEIS.find((b) => b.tipo === tipo);

  const lista: GatilhoOferecido[] = [
    {
      tipo: "comentario_instagram",
      label: "Comentário no feed",
      descricao: "Alguém comenta numa publicação ou reel.",
      escopo: {
        pergunta: "Em quais publicações a automação deve funcionar?",
        qualquer: "Qualquer publicação",
        especifico: "Publicação específica",
        campo: "publicacaoId",
      },
      temPalavras: true,
    },
    {
      tipo: "instagram_resposta_comentario",
      label: "Resposta a comentário",
      descricao: "Alguém responde a um comentário na sua publicação.",
      escopo: {
        pergunta: "Em quais publicações a automação deve funcionar?",
        qualquer: "Qualquer publicação",
        especifico: "Publicação específica",
        campo: "publicacaoId",
      },
      temPalavras: true,
    },
    {
      tipo: "instagram_story_respondido",
      label: "Resposta a story",
      descricao: "Alguém responde um story seu pelo Direct.",
      temPalavras: true,
    },
    {
      tipo: "instagram_mencao_story",
      label: "Menção em story",
      descricao: "Alguém marca seu perfil num story.",
      temPalavras: false,
    },
    {
      tipo: "mensagem_recebida",
      label: "Mensagem recebida",
      descricao: "Qualquer mensagem nova no Direct.",
      temPalavras: true,
    },
    {
      tipo: "instagram_midia_recebida",
      label: "Mídia recebida no Direct",
      descricao: "A pessoa manda foto, vídeo ou áudio.",
      temPalavras: false,
    },
    {
      tipo: "instagram_publicacao_compartilhada",
      label: "Publicação compartilhada",
      descricao: "A pessoa encaminha uma publicação ou reel pelo Direct.",
      temPalavras: false,
    },
    {
      tipo: "instagram_reacao_recebida",
      label: "Reação a mensagem",
      descricao: "Alguém reage a uma mensagem sua no Direct.",
      temPalavras: false,
    },
  ];

  // A tabela de capacidades continua sendo a dona da verdade: um gatilho listado aqui que o canal
  // da área não entregue não aparece, mesmo estando escrito acima.
  return lista.filter((g) => blocoValeNaArea(g.tipo, area) && definicao(g.tipo));
}

type Publicacao = { id: string; legenda?: string; permalink?: string; tipo?: string };

export function PainelGatilho({
  area,
  tipoAtual,
  dataAtual,
  onSalvar,
  onFechar,
}: {
  area: AreaAutomacao;
  /** O gatilho que já está no fluxo, quando há um. Abre o painel já preenchido. */
  tipoAtual?: FlowNodeType;
  dataAtual?: Record<string, unknown>;
  onSalvar: (tipo: FlowNodeType, data: Record<string, unknown>) => void;
  onFechar: () => void;
}) {
  const gatilhos = useMemo(() => oferecidos(area), [area]);

  const [etapa, setEtapa] = useState<"escolha" | "escopo" | "palavras">(tipoAtual ? "escopo" : "escolha");
  const [tipo, setTipo] = useState<FlowNodeType | null>(tipoAtual ?? null);
  const [publicacaoId, setPublicacaoId] = useState<string>(String(dataAtual?.publicacaoId ?? ""));
  const [palavras, setPalavras] = useState<string>(
    Array.isArray(dataAtual?.palavras) ? (dataAtual.palavras as string[]).join(", ") : "",
  );
  const [publicacoes, setPublicacoes] = useState<Publicacao[] | null>(null);
  const [erroPublicacoes, setErroPublicacoes] = useState<string | null>(null);

  const escolhido = gatilhos.find((g) => g.tipo === tipo) ?? null;

  // As etapas que ESTE gatilho tem. Um gatilho sem escopo e sem palavras salva direto, e forçar
  // duas telas vazias só pra manter o número redondo seria burocracia.
  const etapas = useMemo(() => {
    if (!escolhido) return [] as ("escopo" | "palavras")[];
    const lista: ("escopo" | "palavras")[] = [];
    if (escolhido.escopo) lista.push("escopo");
    if (escolhido.temPalavras) lista.push("palavras");
    return lista;
  }, [escolhido]);

  const indiceEtapa = etapa === "escolha" ? -1 : etapas.indexOf(etapa);

  // As publicações só são buscadas quando alguém realmente vai escolher uma: é uma chamada à Meta,
  // e a maioria das automações fica em "qualquer publicação".
  useEffect(() => {
    if (etapa !== "escopo" || !escolhido?.escopo || publicacoes !== null) return;
    let cancelado = false;
    fetch("/api/integracoes/instagram/publicacoes", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ publicacoes?: Publicacao[]; erro?: string }>)
      .then((dados) => {
        if (cancelado) return;
        if (dados.erro) setErroPublicacoes(dados.erro);
        setPublicacoes(dados.publicacoes ?? []);
      })
      .catch(() => {
        if (!cancelado) {
          setErroPublicacoes("Não deu pra buscar suas publicações agora.");
          setPublicacoes([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [etapa, escolhido, publicacoes]);

  function salvar(tipoFinal: FlowNodeType) {
    const alvo = gatilhos.find((g) => g.tipo === tipoFinal);
    onSalvar(tipoFinal, {
      canal: "Instagram",
      palavras: palavras
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      // "qualquer" compara palavra inteira: uma automação de "quero" não deve disparar em "não
      // quero", e é essa a diferença entre uma automação útil e uma que constrange.
      modoPalavra: "qualquer",
      ignorarAcentos: true,
      ...(alvo?.escopo ? { publicacaoId } : {}),
    });
  }

  function avancar() {
    if (!escolhido) return;
    const proxima = etapas[indiceEtapa + 1];
    if (proxima) setEtapa(proxima);
    else salvar(escolhido.tipo);
  }

  return (
    <aside className="painel-gatilho" role="dialog" aria-label="Escolher o gatilho">
      <div className="painel-gatilho-topo">
        <strong>{etapa === "escolha" ? "Gatilhos" : escolhido?.label}</strong>
        <button type="button" className="icon-btn subtle" aria-label="Fechar" onClick={onFechar}>
          <IconClose width={13} height={13} />
        </button>
      </div>

      {etapa !== "escolha" && etapas.length > 1 ? (
        <div className="painel-gatilho-progresso">
          <p>
            Etapa {indiceEtapa + 1} de {etapas.length}
          </p>
          <div className="painel-gatilho-barra">
            <span style={{ width: `${((indiceEtapa + 1) / etapas.length) * 100}%` }} />
          </div>
        </div>
      ) : null}

      <div className="painel-gatilho-corpo">
        {etapa === "escolha" ? (
          <>
            <div className="field">
              <label>Escolha o canal</label>
              <div className="painel-gatilho-canal">
                <IconInstagram width={15} height={15} aria-hidden="true" />
                <div>
                  <strong>{CAPACIDADES.instagram.label}</strong>
                  <span>{CAPACIDADES.instagram.resumo}</span>
                </div>
              </div>
              <p className="hint mt8">
                {CAPACIDADES.tiktok.label}: {CAPACIDADES.tiktok.motivoIndisponivel}
              </p>
            </div>

            <div className="field">
              <label>Escolha o gatilho</label>
              <p className="hint">O evento do Instagram que começa esta automação.</p>
              <div className="painel-gatilho-lista">
                {gatilhos.map((g) => (
                  <button
                    key={g.tipo}
                    type="button"
                    className={`painel-gatilho-item${tipo === g.tipo ? " on" : ""}`}
                    onClick={() => setTipo(g.tipo)}
                  >
                    <strong>{g.label}</strong>
                    <span>{g.descricao}</span>
                  </button>
                ))}

                {INDISPONIVEIS.map((g) => (
                  <div key={g.label} className="painel-gatilho-item indisponivel" aria-disabled="true">
                    <strong>{g.label}</strong>
                    <span>{g.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {etapa === "escopo" && escolhido?.escopo ? (
          <div className="field">
            <label>{escolhido.escopo.pergunta}</label>
            <select className="input" value={publicacaoId ? "especifico" : "qualquer"} onChange={(e) => setPublicacaoId(e.target.value === "qualquer" ? "" : (publicacoes?.[0]?.id ?? ""))}>
              <option value="qualquer">{escolhido.escopo.qualquer}</option>
              <option value="especifico">{escolhido.escopo.especifico}</option>
            </select>

            {publicacaoId ? (
              <>
                <select
                  className="input mt8"
                  value={publicacaoId}
                  onChange={(e) => setPublicacaoId(e.target.value)}
                >
                  {(publicacoes ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.legenda ?? "").slice(0, 60) || p.id}
                    </option>
                  ))}
                </select>
                {erroPublicacoes ? <p className="hint mt8">{erroPublicacoes}</p> : null}
                {publicacoes && !publicacoes.length && !erroPublicacoes ? (
                  <p className="hint mt8">Nenhuma publicação encontrada nesta conta.</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {etapa === "palavras" ? (
          <div className="field">
            <label>Só quando tiver estas palavras</label>
            <input
              className="input"
              value={palavras}
              placeholder="quero, preço, valor"
              onChange={(e) => setPalavras(e.target.value)}
            />
            <p className="hint mt8">
              Separe por vírgula. Vazio = qualquer mensagem daquele tipo dispara. A comparação é por
              palavra inteira e ignora acento, então “quero” não dispara em “não quero”.
            </p>
          </div>
        ) : null}
      </div>

      <div className="painel-gatilho-rodape">
        {etapa !== "escolha" ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const anterior = etapas[indiceEtapa - 1];
              setEtapa(anterior ?? "escolha");
            }}
          >
            Voltar
          </button>
        ) : null}

        <button
          type="button"
          className="btn primary"
          disabled={!escolhido}
          onClick={() => {
            if (!escolhido) return;
            if (etapa === "escolha") {
              const primeira = etapas[0];
              if (primeira) setEtapa(primeira);
              else salvar(escolhido.tipo);
              return;
            }
            avancar();
          }}
        >
          {etapa !== "escolha" && indiceEtapa === etapas.length - 1 ? "Salvar" : "Continuar"}
        </button>
      </div>
    </aside>
  );
}
