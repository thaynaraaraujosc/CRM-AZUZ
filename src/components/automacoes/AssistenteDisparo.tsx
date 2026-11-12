"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui";
import { SeletorDeData } from "@/components/seletor-de-data";
import { useContatos } from "@/lib/contatos-context";
import {
  ORIGENS_DA_REUNIAO,
  ORIGENS_DO_CONTATO,
  chaveSugeridaDe,
  mapearVariaveis,
  type MapeamentoVariavel,
  type OrigemVariavel,
} from "@/lib/campanhas/variaveis";
import type { Audiencia, ModoAudiencia } from "@/lib/campanhas/audiencia-tipos";
import type { CanalCampanha } from "@/lib/campanhas/ritmo";
import { LIMITES } from "@/lib/templates/regras";
import type { CanalDisponivel } from "@/app/api/canais/route";
import { funisDoNumero, type NumeroDeEnvio } from "@/lib/campanhas/canais-de-envio";
import type { JanelaDirect } from "@/app/api/social/janela/route";
import type { TemplateSalvo } from "./EditorTemplate";
import { PreviaMensagem } from "./PreviaMensagem";
import { useIdioma } from "@/lib/idioma-context";

type Opcoes = {
  totalContatos: number;
  origens: { valor: string; total: number }[];
  etiquetas: { valor: string; total: number }[];
  funis: { id: string; nome: string; contaCanais?: string[]; etapas: { id: string; titulo: string }[] }[];
};

type Previa = {
  total: number;
  receberao: number;
  nomes: string[];
  semDestino: string[];
  semVariavel: string[];
  previsao: { minutos: number; dias: number; limitadoPorCota: boolean };
  ritmo: { porMinuto: number; porDia: number | null; explicacao: string };
  limiteDiario?: number | null;
  /** O nível da conta na Meta (`TIER_1K`…), pra frase poder dizer de onde o número veio. */
  limiteTier?: string;
  /** Perguntou à Meta e ela não respondeu. Diferente de "este canal não tem teto". */
  limiteIndisponivel?: boolean;
};

const PASSOS = ["Canal", "Público", "Mensagem", "Quando", "Revisar"] as const;

const MODOS: { modo: ModoAudiencia; label: string }[] = [
  { modo: "todos", label: "Todos os contatos" },
  { modo: "etiqueta", label: "Por etiqueta" },
  { modo: "origem", label: "Por origem" },
  { modo: "funil", label: "Por funil" },
  { modo: "etapa", label: "Por etapa do funil"},
  { modo: "periodo", label: "Por data de cadastro"},
  { modo: "selecionados", label: "Escolher um a um" },
];

function duracaoLegivel(p: Previa["previsao"]): string {
  if (p.limitadoPorCota) return `cerca de ${p.dias} dia${p.dias > 1 ? "s" : ""} (limite diário da conta)`;
  if (p.minutos < 2) return "menos de 2 minutos";
  if (p.minutos < 90) return `cerca de ${p.minutos} minutos`;
  const horas = Math.round(p.minutos / 60);
  return `cerca de ${horas} hora${horas > 1 ? "s" : ""}`;
}

/**
 * Assistente do Disparo em massa: canal → público → mensagem → quando → revisar.
 *
 * Cada passo mostra só o que aquele passo precisa; o resto fica pro resumo. Tudo que é conta
 * (quantos recebem, quem fica de fora, quanto tempo leva) vem do servidor, pela mesma rota que o
 * disparo real vai usar: a tela nunca inventa um número.
 */
export function AssistenteDisparo({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: (id: string) => void }) {
  const { t: traduzir } = useIdioma();
  const { contatos } = useContatos();
  const [passo, setPasso] = useState(0);
  const [canais, setCanais] = useState<CanalDisponivel[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [templates, setTemplates] = useState<TemplateSalvo[]>([]);

  const [canal, setCanal] = useState<CanalCampanha | null>(null);
  /**
   * POR QUAL NÚMERO ESTE DISPARO SAI. `null` = o canal não tem números (Instagram, e-mail).
   *
   * O canal diz o caminho; isto diz a caixa de saída. Quem recebe vê o nome, a foto e o histórico
   * do NÚMERO — então, numa empresa com o número da vendedora e o do closer no mesmo canal,
   * escolher entre eles é a decisão que mais muda o que chega no aparelho da pessoa.
   */
  const [contaCanal, setContaCanal] = useState<string | null>(null);
  const [audiencia, setAudiencia] = useState<Audiencia>({ modo: "todos" });
  const [busca, setBusca] = useState("");
  const [verQuem, setVerQuem] = useState(false);
  /** Prévia junto com a "chave" (canal + público + variáveis) pra qual ela vale. Se a chave atual
   * for outra, a prévia está velha e a tela mostra "contando" até a nova chegar. */
  const [previaResp, setPreviaResp] = useState<{ chave: string; dados: Previa } | null>(null);
  /** Elegibilidade do Instagram. Só buscada quando o canal é Instagram. */
  const [janela, setJanela] = useState<JanelaDirect | null>(null);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [corpoLivre, setCorpoLivre] = useState("");
  const [assuntoLivre, setAssuntoLivre] = useState("");
  const [variaveis, setVariaveis] = useState<MapeamentoVariavel[]>([]);

  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("09:00");

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /*
   * TRÊS PEDIDOS, TRÊS CHEGADAS. Antes era um `Promise.all`: a tela só desenhava quando os três
   * voltassem.
   *
   * "Fica por muito tempo até abrir o canal, que é o primeiro passo."
   *
   * E o passo do canal não precisa de nenhum dos outros dois. Quem segurava era a prévia, que
   * varre os contatos do workspace um a um pra contar quem tem WhatsApp — a conta mais cara das
   * três, pedida antes de a pessoa ter escolhido qualquer coisa. O modal ficava com a frase "Por
   * onde a mensagem sai" sozinha no meio do branco, esperando uma resposta que o passo 1 nem usa.
   *
   * Agora cada um chega quando chega, e cada passo espera só o que ele mesmo precisa.
   */
  useEffect(() => {
    const falhou = (e: unknown) => setErro(e instanceof Error ? e.message : traduzir("Falha ao carregar."));
    fetch("/api/canais", { cache: "no-store" })
      .then((r) => r.json() as Promise<CanalDisponivel[]>)
      .then((c) => setCanais(Array.isArray(c) ? c : []))
      .catch(falhou);
    fetch("/api/campanhas/previa", { cache: "no-store" })
      .then((r) => r.json() as Promise<Opcoes>)
      .then(setOpcoes)
      .catch(falhou);
    fetch("/api/templates", { cache: "no-store" })
      .then((r) => r.json() as Promise<TemplateSalvo[]>)
      .then((t) => setTemplates(Array.isArray(t) ? t : []))
      .catch(falhou);
  }, []);

  // A janela é buscada ao escolher o Instagram e RE-buscada ao voltar pro passo do público: ela
  // muda sozinha com o tempo (alguém escreve, alguém vence as 24 horas), e um número velho aqui
  // seria a diferença entre "37 vão receber" e 37 falhas no relatório.
  useEffect(() => {
    let cancelado = false;
    if (canal !== "instagram") {
      // Fora de um efeito síncrono: o React Compiler proíbe `setState` direto no corpo do efeito,
      // e a microtarefa é o jeito de dizer "isto é uma consequência, não a renderização".
      Promise.resolve().then(() => {
        if (!cancelado) setJanela(null);
      });
      return () => {
        cancelado = true;
      };
    }
    fetch("/api/social/janela", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<JanelaDirect>) : null))
      .then((d) => {
        if (!cancelado) setJanela(d);
      })
      .catch(() => {
        if (!cancelado) setJanela(null);
      });
    return () => {
      cancelado = true;
    };
  }, [canal, passo]);

  /** Todos os números de WhatsApp de pé, os dois canais numa lista só. Ver `canais-de-envio.ts`. */
  const numerosDeWhats = useMemo(() => canais.flatMap((c) => c.numeros ?? []), [canais]);
  const canaisDeWhatsSemNumero = canais.filter(
    (c) => (c.canal === "whatsapp_oficial" || c.canal === "whatsapp_nao_oficial") && !c.numeros?.length,
  );
  const outrosCanais = canais.filter((c) => c.canal === "instagram" || c.canal === "email");
  const numeroEscolhido = numerosDeWhats.find((n) => n.contaCanal === contaCanal) ?? null;

  function escolherNumero(n: NumeroDeEnvio) {
    setCanal(n.canal as CanalCampanha);
    setContaCanal(n.contaCanal);
    setTemplateId(null);
    setVariaveis([]);
    /* O público volta pro começo ao trocar de número, e é de propósito: os funis oferecidos
       dependem do número (ver `funisDoNumero`), e manter a escolha antiga deixaria selecionado um
       funil que a nova lista nem mostra — a tela discordando de si mesma. */
    setAudiencia({ modo: "todos" });
  }

  /*
   * Só os funis que o número escolhido alcança. A regra (e o porquê de o funil SEM número ficar
   * na lista) mora em `funisDoNumero`, com teste.
   */
  const funisOferecidos = useMemo(
    () => funisDoNumero(opcoes?.funis ?? [], contaCanal),
    [opcoes, contaCanal],
  );

  const limites = canal ? LIMITES[canal] : null;
  const templateEscolhido = templates.find((t) => t.id === templateId) ?? null;
  const templatesDoCanal = templates.filter((t) => t.canal === canal);
  const usaTemplate = !!templateEscolhido;
  const corpo = usaTemplate ? templateEscolhido!.corpo : corpoLivre;
  const assunto = usaTemplate ? templateEscolhido!.assunto : assuntoLivre;
  const botoes = usaTemplate ? templateEscolhido!.botoes : null;

  // Mensagem livre: o mapeamento acompanha o texto; template: começa do que foi salvo nele.
  function escolherTemplate(t: TemplateSalvo | null) {
    setTemplateId(t?.id ?? null);
    setVariaveis(t ? (t.variaveis ?? []) : mapearVariaveis(corpoLivre));
  }
  function mudarCorpoLivre(texto: string) {
    setCorpoLivre(texto);
    setVariaveis((atual) => mapearVariaveis(texto, atual));
  }

  // Prévia: recalculada quando canal, público ou variáveis mudam (o servidor conta quem ficaria
  // com variável vazia). A chave identifica a combinação; a prévia só vale pra chave que a pediu.
  const chavePrevia = canal && passo >= 1 ? JSON.stringify({ canal, audiencia, variaveis }) : "";
  const previa = previaResp && previaResp.chave === chavePrevia ? previaResp.dados : null;
  const carregandoPrevia = !!chavePrevia && !previa;
  useEffect(() => {
    if (!chavePrevia) return;
    let cancelado = false;
    const pedido = JSON.parse(chavePrevia) as { canal: CanalCampanha; audiencia: Audiencia; variaveis: MapeamentoVariavel[] };
    fetch("/api/campanhas/previa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pedido),
    })
      .then(async (r) => {
        const dados = (await r.json()) as Previa & { erro?: string };
        if (!r.ok) throw new Error(dados.erro ?? "Falha na prévia.");
        if (!cancelado) setPreviaResp({ chave: chavePrevia, dados });
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : traduzir("Falha na prévia.")));
    return () => {
      cancelado = true;
    };
  }, [chavePrevia]);

  const contatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? contatos.filter((c) => c.nome.toLowerCase().includes(termo)) : contatos;
  }, [contatos, busca]);

  const podeAvancar = (() => {
    if (passo === 0) return !!canal;
    // No Instagram quem manda é a janela, não a prévia: o público não se escolhe, então avançar
    // depende só de existir alguém dentro dela. Com zero elegíveis, o disparo não sai do lugar.
    if (passo === 1 && canal === "instagram") return !!janela?.conectado && janela.total > 0;
    if (passo === 1) return !!previa && previa.receberao > 0 && !carregandoPrevia;
    if (passo === 2) {
      if (!limites) return false;
      if (canal === "whatsapp_oficial") return usaTemplate;
      if (usaTemplate) return true;
      return corpoLivre.trim().length > 0 && (!limites.exigeAssunto || assuntoLivre.trim().length > 0);
    }
    if (passo === 3) return quando === "agora" || (!!data && !!hora);
    return true;
  })();

  async function confirmar() {
    if (!canal) return;
    setEnviando(true);
    setErro(null);
    try {
      const agendadaPara = quando === "agora" ? new Date().toISOString() : new Date(`${data}T${hora}:00`).toISOString();
      const resposta = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canal,
          contaCanal: contaCanal ?? undefined,
          audiencia,
          templateId: templateId ?? undefined,
          corpo: usaTemplate ? undefined : corpoLivre,
          assunto: usaTemplate ? undefined : assuntoLivre,
          variaveis,
          agendadaPara,
          titulo: usaTemplate ? templateEscolhido!.nome : corpoLivre.split("\n")[0].slice(0, 60),
        }),
      });
      const dados = (await resposta.json()) as { id?: string; erro?: string };
      if (!resposta.ok || !dados.id) throw new Error(dados.erro ?? "Não foi possível criar o disparo.");
      aoConcluir(dados.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Não foi possível criar o disparo."));
      setEnviando(false);
    }
  }

  const canalLabel = canal ? LIMITES[canal].label : "";

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo={traduzir("Novo disparo em massa")}
      largura={1060}
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={passo === 0 ? aoFechar : () => setPasso((p) => p - 1)} disabled={enviando}>
            {passo === 0 ? "Cancelar" : "Voltar"}
          </button>
          {passo < PASSOS.length - 1 ? (
            <button type="button" className="btn primary" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}>
              {traduzir("Continuar")}
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={enviando || !previa} onClick={() => void confirmar()}>
              {enviando ? "Criando…" : "Confirmar disparo"}
            </button>
          )}
        </>
      }
    >
      <ol className="disp-passos">
        {PASSOS.map((nome, i) => (
          <li key={nome} className={i === passo ? "atual" : i < passo ? "feito" : ""}>
            <span>{i + 1}</span> {nome}
          </li>
        ))}
      </ol>

      {erro ? <p className="modelo-erro">{erro}</p> : null}

      {/* ------------------------------------------------------------------ 1. Canal */}
      {passo === 0 ? (
        <div className="disp-passo">
          {/* O Instagram é um canal como os outros AQUI. Ele tinha uma tela própria em
              Instagram → Disparos, que usava exatamente esta mesma API (`/api/campanhas`
              com `canal: "instagram"`): eram duas telas pro mesmo backend. Disparo agora é um
              lugar só, e o que muda por canal é o passo do público, não a página. */}
          {canais.length === 0 ? (
            /* Esqueleto no lugar do branco: o modal abre na hora, e o que falta é só esta lista.
               Antes a tela ficava com a frase de ajuda sozinha, sem dizer que havia algo vindo. */
            <div className="disp-numeros">
              {[0, 1, 2].map((i) => (
                <div key={i} className="disp-numero-esqueleto" aria-hidden="true" />
              ))}
            </div>
          ) : (
            <>
              {numerosDeWhats.length ? (
                <section className="disp-grupo">
                  <h4 className="disp-grupo-titulo">
                    {traduzir("WhatsApp")}
                    <span className="hint">
                      {numerosDeWhats.length === 1
                        ? traduzir("1 número conectado")
                        : `${numerosDeWhats.length} ${traduzir("números conectados")}`}
                    </span>
                  </h4>
                  <div className="disp-numeros">
                    {numerosDeWhats.map((n) => (
                      <button
                        key={n.contaCanal}
                        type="button"
                        className={`disp-numero${contaCanal === n.contaCanal ? " on" : ""}`}
                        onClick={() => escolherNumero(n)}
                      >
                        <span className="disp-numero-topo">
                          <strong>{n.nome}</strong>
                          {/* A etiqueta do canal na frente de cada número: "se ele é uma API
                              oficial ou API não oficial". Não é decoração — as regras dos dois
                              são diferentes (janela de 24h e modelo aprovado só existem no
                              oficial), e é isso que decide o que dá pra mandar. */}
                          <em className={`disp-etiqueta ${n.canal === "whatsapp_oficial" ? "oficial" : "qr"}`}>
                            {traduzir(n.etiqueta)}
                          </em>
                        </span>
                        <span className="hint">{n.numeroLegivel || traduzir("Conectado")}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Canal de WhatsApp sem nenhum número de pé: fica visível, dizendo por quê. A
                  pergunta "cadê o meu WhatsApp?" merece resposta na tela, não um sumiço. */}
              {canaisDeWhatsSemNumero.length ? (
                <div className="disp-numeros">
                  {canaisDeWhatsSemNumero.map((c) => (
                    <div key={c.canal} className="disp-numero disp-numero-off">
                      <span className="disp-numero-topo">
                        <strong>{traduzir(c.label)}</strong>
                      </span>
                      <span className="hint">{c.motivo}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <section className="disp-grupo">
                <h4 className="disp-grupo-titulo">{traduzir("Outros canais")}</h4>
                <div className="disp-numeros">
                  {outrosCanais.map((c) => (
                    <button
                      key={c.canal}
                      type="button"
                      className={`disp-numero${canal === c.canal ? " on" : ""}${c.conectado ? "" : " disp-numero-off"}`}
                      disabled={!c.conectado}
                      title={!c.conectado ? c.motivo : undefined}
                      onClick={() => {
                        setCanal(c.canal as CanalCampanha);
                        setContaCanal(null);
                        setTemplateId(null);
                        setVariaveis([]);
                        // O Instagram tem um público só possível: quem está dentro da janela.
                        // Escolher outro modo ali não é uma opção, é um erro esperando pra
                        // acontecer, então o modo já vem certo.
                        setAudiencia(c.canal === "instagram" ? { modo: "janela_instagram" } : { modo: "todos" });
                      }}
                    >
                      <span className="disp-numero-topo">
                        <strong>{traduzir(c.label)}</strong>
                        {c.emBreve ? <em className="disp-etiqueta">{traduzir("Em breve")}</em> : null}
                      </span>
                      <span className="hint">{c.emBreve ? c.motivo : c.conectado ? c.detalhe || traduzir("Conectado") : c.motivo}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {canal ? <p className="disp-regra-canal">{LIMITES[canal].explicacao}</p> : null}
        </div>
      ) : null}

      {/* --------------------------------------------- 2. Público, no Instagram
          O Instagram não tem escolha de público, e essa é a informação principal da tela.
          Só é possível falar com quem escreveu dentro da janela: etiqueta, funil e etapa não
          mudam nada porque a Meta recusa o envio pra todo o resto. Oferecer os mesmos modos dos
          outros canais aqui seria oferecer filtros que não filtram. */}
      {passo === 1 && canal === "instagram" ? (
        <div className="disp-passo">
          {janela === null ? (
            <p className="hint">{traduzir("Conferindo quem pode receber agora…")}</p>
          ) : !janela.conectado ? (
            <p className="modelo-erro">{traduzir("O Instagram não está conectado. Conecte a conta em Configurações → Outras integrações.")}</p>
          ) : (
            <>
              <div className="disp-ig-conta">
                <span className="hint">{traduzir("Instagram conectado")}</span>
                <strong>{janela.conta ?? "conta conectada"}</strong>
              </div>

              <div className="disp-ig-numeros">
                <div className="disp-ig-numero">
                  <strong>{janela.totalContatos.toLocaleString("pt-BR")}</strong>
                  <span>contatos do Instagram</span>
                </div>
                <div className="disp-ig-numero destaque">
                  <strong>{janela.total.toLocaleString("pt-BR")}</strong>
                  <span>elegíveis para receber agora</span>
                </div>
              </div>

              <div className="disp-ig-regra">
                <strong>{traduzir("Por que a diferença")}</strong>
                <p className="hint mt8">
                  O Instagram só deixa mandar mensagem pra quem escreveu pra você nas últimas{" "}
                  {janela.janelaHoras} horas. É a janela de atendimento, e ela conta da ÚLTIMA
                  mensagem da pessoa, não da sua. Responder alguém não reabre a janela dela.
                </p>
                <p className="hint mt8">{traduzir("Fora da janela a Meta recusa o envio, e não existe modelo aprovado pra retomar como no WhatsApp oficial. Por isso o público aqui não se escolhe: ele é quem está dentro da janela, e mais ninguém.")}</p>
                <p className="hint mt8">
                  A janela é conferida DE NOVO na hora de enviar cada mensagem. Entre montar o
                  disparo e ele chegar em alguém passam minutos, e a janela de uma pessoa pode ter
                  fechado nesse meio: quem fechar fica marcado como &quot;janela fechada&quot;, não
                  como erro.
                </p>
              </div>

              {janela.total === 0 ? (
                <p className="modelo-erro mt16">
                  Ninguém escreveu nas últimas {janela.janelaHoras} horas, então não há pra quem
                  mandar agora. Volte quando alguém responder um story ou mandar um Direct.
                </p>
              ) : (
                <div className="disp-lista-contatos mt16">
                  {janela.pessoas.map((p) => (
                    <div key={p.contatoNome} className="disp-contato">
                      <span aria-hidden="true">·</span>
                      <span>{p.contatoNome}</span>
                      <span className="hint">
                        fecha {new Date(p.fechaEm).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                  {janela.total > janela.pessoas.length ? (
                    <div className="disp-contato">
                      <span aria-hidden="true">·</span>
                      <span className="hint">
                        e mais {(janela.total - janela.pessoas.length).toLocaleString("pt-BR")}.
                      </span>
                      <span />
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 2. Público */}
      {passo === 1 && canal && canal !== "instagram" ? (
        <div className="disp-passo disp-duas-colunas">
          <div>
            <div className="disp-modos">
              {MODOS.map((m) => (
                <button
                  key={m.modo}
                  type="button"
                  className={`pill${audiencia.modo === m.modo ? " on" : ""}`}
                  onClick={() => {
                    setAudiencia({ modo: m.modo, nomes: m.modo === "selecionados" ? [] : undefined });
                    setVerQuem(false);
                  }}
                >
                  {traduzir(m.label)}
                </button>
              ))}
            </div>

            {audiencia.modo === "etiqueta" ? (
              <div className="field">
                <label>{traduzir("Etiqueta")}</label>
                <select className="input" value={audiencia.valor ?? ""} onChange={(e) => setAudiencia({ modo: "etiqueta", valor: e.target.value })}>
                  <option value="">{traduzir("Escolha…")}</option>
                  {(opcoes?.etiquetas ?? []).map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.valor} ({e.total})
                    </option>
                  ))}
                </select>
                {opcoes && opcoes.etiquetas.length === 0 ? <p className="hint">{traduzir("Nenhum contato tem etiqueta ainda.")}</p> : null}
              </div>
            ) : null}

            {audiencia.modo === "origem" ? (
              <div className="field">
                <label>{traduzir("Origem")}</label>
                <select className="input" value={audiencia.valor ?? ""} onChange={(e) => setAudiencia({ modo: "origem", valor: e.target.value })}>
                  <option value="">{traduzir("Escolha…")}</option>
                  {(opcoes?.origens ?? []).map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.valor} ({o.total})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {audiencia.modo === "funil" || audiencia.modo === "etapa" ? (
              <div className="field">
                <label>{audiencia.modo === "funil" ? "Funil" : "Etapa"}</label>
                <select className="input" value={audiencia.valor ?? ""} onChange={(e) => setAudiencia({ modo: audiencia.modo, valor: e.target.value })}>
                  <option value="">{traduzir("Escolha…")}</option>
                  {funisOferecidos.map((f) =>
                    audiencia.modo === "funil" ? (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ) : (
                      <optgroup key={f.id} label={f.nome}>
                        {f.etapas.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.titulo}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </select>
                {numeroEscolhido && funisOferecidos.length < (opcoes?.funis.length ?? 0) ? (
                  /* Lista menor que o total: a tela DIZ por quê. Um filtro que encolhe a lista em
                     silêncio é indistinguível de um funil que sumiu. */
                  <p className="hint">
                    {traduzir("Mostrando os funis que")} <strong>{numeroEscolhido.nome}</strong>{" "}
                    {traduzir("alcança, mais os que não têm número próprio.")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {audiencia.modo === "periodo" ? (
              <div className="tpl-linha">
                <div className="field">
                  <label>{traduzir("Cadastrados de")}</label>
                  <SeletorDeData valor={audiencia.de ?? ""} onChange={(iso) => setAudiencia((a) => ({ ...a, de: iso }))} />
                </div>
                <div className="field">
                  <label>até</label>
                  <SeletorDeData valor={audiencia.ate ?? ""} onChange={(iso) => setAudiencia((a) => ({ ...a, ate: iso }))} />
                </div>
              </div>
            ) : null}

            {audiencia.modo === "selecionados" ? (
              <div className="field">
                <label>{traduzir("Contatos")}</label>
                <input className="input" placeholder={traduzir("Buscar pelo nome…")} value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className="disp-lista-contatos">
                  {contatosFiltrados.map((c) => {
                    const marcado = audiencia.nomes?.includes(c.nome) ?? false;
                    return (
                      <label key={c.nome} className="disp-contato">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setAudiencia((a) => {
                              const nomes = new Set(a.nomes ?? []);
                              if (nomes.has(c.nome)) nomes.delete(c.nome);
                              else nomes.add(c.nome);
                              return { modo: "selecionados", nomes: Array.from(nomes) };
                            })
                          }
                        />
                        <span>{c.nome}</span>
                        <em>{c.origem}</em>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="disp-resumo-publico card">
            {carregandoPrevia ? (
              <p className="hint">{traduzir("Contando…")}</p>
            ) : previa ? (
              <>
                <strong className="disp-numero">{previa.receberao}</strong>
                <span>contatos receberão esta mensagem</span>
                {previa.semDestino.length ? (
                  <p className="hint">
                    {previa.semDestino.length} ficam de fora por não ter {canal === "email" ? "e-mail" : "WhatsApp"} cadastrado.
                  </p>
                ) : null}
                {previa.receberao > 0 ? (
                  <button type="button" className="btn ghost" onClick={() => setVerQuem((v) => !v)}>
                    {verQuem ? "Ocultar" : "Ver quem"}
                  </button>
                ) : null}
                {verQuem ? (
                  <ul className="disp-nomes">
                    {previa.nomes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                    {previa.receberao > previa.nomes.length ? <li className="hint">… e mais {previa.receberao - previa.nomes.length}</li> : null}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="hint">{traduzir("Escolha o público pra ver quantos recebem.")}</p>
            )}
          </aside>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 3. Mensagem */}
      {passo === 2 && canal && limites ? (
        <div className="disp-passo disp-duas-colunas">
          <div>
            {canal === "whatsapp_oficial" ? (
              <p className="hint">
                {traduzir("No WhatsApp API Oficial o disparo só sai com um template")} <strong>aprovado pela Meta</strong>. Os outros aparecem
                aqui com o status, mas não podem ser escolhidos.
              </p>
            ) : (
              <p className="hint">{traduzir("Escolha um template ou escreva a mensagem agora.")}</p>
            )}

            <div className="modelo-lista disp-templates">
              {templatesDoCanal.length === 0 ? (
                <p className="hint">{traduzir("Nenhum template deste canal ainda. Crie em Automações → Templates.")}</p>
              ) : null}
              {templatesDoCanal.map((t) => {
                const disponivel = t.status === "aprovado";
                /* A COR DIZ O ESTADO, à distância: aprovado em azul claro, rejeitado em dourado.
                   "Pra gente ter uma visão melhor." Numa lista de oito modelos, ler oito
                   etiquetas pequenas pra achar os dois que dá pra usar é trabalho que a cor faz
                   sozinha. A etiqueta continua lá: cor sozinha não serve a quem não a distingue. */
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`disp-template ${t.status}${templateId === t.id ? " escolhido" : ""}`}
                    disabled={!disponivel}
                    title={disponivel ? undefined : traduzir("Só modelo aprovado pela Meta pode ser disparado.")}
                    onClick={() => escolherTemplate(templateId === t.id ? null : t)}
                  >
                    <span className="disp-template-topo">
                      <strong>{t.nome}</strong>
                      <span
                        className={`badge ${
                          disponivel
                            ? "badge-success"
                            : t.status === "em_analise"
                              ? "badge-warning"
                              : t.status === "rejeitado"
                                ? "badge-danger"
                                : "badge-neutral"
                        }`}
                      >
                        {disponivel
                          ? traduzir("Aprovado")
                          : t.status === "em_analise"
                            ? traduzir("Em análise")
                            : t.status === "rejeitado"
                              ? traduzir("Rejeitado")
                              : traduzir("Rascunho")}
                      </span>
                    </span>
                    <span className="disp-template-corpo">{t.corpo.slice(0, 160)}</span>
                  </button>
                );
              })}
            </div>

            {canal !== "whatsapp_oficial" && !usaTemplate ? (
              <>
                {limites.exigeAssunto ? (
                  <div className="field">
                    <label>{traduzir("Assunto")}</label>
                    <input className="input" value={assuntoLivre} onChange={(e) => setAssuntoLivre(e.target.value)} />
                  </div>
                ) : null}
                <div className="field">
                  <label>{traduzir("Mensagem")}</label>
                  <textarea
                    className="input tpl-corpo"
                    rows={5}
                    value={corpoLivre}
                    placeholder={"Olá {{nome}}, tudo bem?"}
                    onChange={(e) => mudarCorpoLivre(e.target.value)}
                  />
                  <div className="tpl-inserir">
                    <span className="hint">{traduzir("Inserir:")}</span>
                    {[...ORIGENS_DO_CONTATO.slice(0, 4), ...ORIGENS_DA_REUNIAO].map((o) => (
                      <button key={o.origem} type="button" className="pill" onClick={() => mudarCorpoLivre(`${corpoLivre}{{${chaveSugeridaDe(o.origem)}}}`)}>
                        {traduzir(o.label)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {variaveis.length ? (
              <div className="field">
                <label>{traduzir("Como preencher cada variável")}</label>
                <div className="tpl-variaveis">
                  {variaveis.map((v) => (
                    <div key={v.chave} className="tpl-variavel">
                      <code>{`{{${v.chave}}}`}</code>
                      <select
                        className="input"
                        value={v.origem}
                        onChange={(e) => setVariaveis((atual) => atual.map((x) => (x.chave === v.chave ? { ...x, origem: e.target.value as OrigemVariavel } : x)))}
                      >
                        <optgroup label={traduzir("Do contato")}>
                          {ORIGENS_DO_CONTATO.map((o) => (
                            <option key={o.origem} value={o.origem}>
                              {traduzir(o.label)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={traduzir("Da próxima reunião")}>
                          {ORIGENS_DA_REUNIAO.map((o) => (
                            <option key={o.origem} value={o.origem}>
                              {traduzir(o.label)}
                            </option>
                          ))}
                        </optgroup>
                        <option value="texto">{traduzir("Texto fixo")}</option>
                      </select>
                      {v.origem === "texto" ? (
                        <input
                          className="input"
                          placeholder={traduzir("Valor pra todo mundo")}
                          value={v.valor ?? ""}
                          onChange={(e) => setVariaveis((atual) => atual.map((x) => (x.chave === v.chave ? { ...x, valor: e.target.value } : x)))}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
                {previa?.semVariavel.length ? (
                  <p className="hint disp-alerta">
                    {previa.semVariavel.length} contato{previa.semVariavel.length > 1 ? "s" : ""} ficaria{previa.semVariavel.length > 1 ? "m" : ""} com variável vazia
                    (ex.: {previa.semVariavel.slice(0, 3).join(", ")}). Preencha o campo no cadastro ou use um texto fixo.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <PreviaMensagem corpo={corpo} variaveis={variaveis} botoes={botoes} assunto={limites.exigeAssunto ? assunto : null} />
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 4. Quando */}
      {passo === 3 ? (
        <div className="disp-passo">
          <div className="disp-modos">
            <button type="button" className={`pill${quando === "agora" ? " on" : ""}`} onClick={() => setQuando("agora")}>
              {traduzir("Enviar agora")}
            </button>
            <button type="button" className={`pill${quando === "agendar" ? " on" : ""}`} onClick={() => setQuando("agendar")}>
              {traduzir("Agendar")}
            </button>
          </div>
          {quando === "agendar" ? (
            <div className="tpl-linha">
              <div className="field">
                <label>{traduzir("Data")}</label>
                <SeletorDeData valor={data} onChange={setData} />
              </div>
              <div className="field">
                <label>{traduzir("Horário")}</label>
                <input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>
          ) : null}
          {previa ? (
            <div className="disp-ritmo">
              <p>
                <strong>
                  {previa.ritmo.porMinuto} {traduzir("por minuto")}
                </strong>{" "}
                · {traduzir("para")} {previa.receberao} {traduzir("contatos, leva")} {duracaoLegivel(previa.previsao)}.
              </p>
              {/* DE ONDE VEM O TETO DIÁRIO — a pergunta que ela fez olhando pra esta frase.
                  O número nunca foi chutado: sai de `messaging_limit_tier`, lido da conta dela na
                  Meta a cada prévia. Só que um número sem fonte é indistinguível de um inventado,
                  e era isso que a frase antiga fazia. Agora ela diz o nível e quem disse. */}
              {canal === "whatsapp_oficial" ? (
                previa.limiteDiario ? (
                  <p className="hint">
                    {traduzir("Sua conta na Meta está no nível")} <strong>{previa.limiteTier ?? "—"}</strong>:{" "}
                    {traduzir("até")} <strong>{previa.limiteDiario.toLocaleString("pt-BR")}</strong>{" "}
                    {traduzir("pessoas DIFERENTES por dia. É o limite da conta, lido da Meta agora — não é uma regra do CRM, e sobe sozinho conforme o histórico de qualidade.")}
                  </p>
                ) : previa.limiteTier ? (
                  <p className="hint">
                    {traduzir("Sua conta na Meta está no nível")} <strong>{previa.limiteTier}</strong>:{" "}
                    {traduzir("sem teto diário de pessoas novas.")}
                  </p>
                ) : previa.limiteIndisponivel ? (
                  <p className="hint">
                    {traduzir("Não deu pra ler o limite diário da sua conta na Meta agora. O disparo sai do mesmo jeito: quando a cota acabar, a Meta recusa e o CRM marca quem ficou pra depois.")}
                  </p>
                ) : null
              ) : previa.ritmo.porDia ? (
                <p className="hint">
                  {traduzir("Até")} <strong>{previa.ritmo.porDia}</strong> {traduzir("por dia. Este teto é do CRM, por precaução: este canal não tem limite publicado porque não é uma API oficial.")}
                </p>
              ) : null}
              <p className="hint">{previa.ritmo.explicacao}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 5. Revisar */}
      {passo === 4 && canal ? (
        <div className="disp-passo disp-duas-colunas">
          <dl className="disp-revisao">
            <dt>{traduzir("Sai por")}</dt>
            <dd>
              {numeroEscolhido ? (
                <>
                  <strong>{numeroEscolhido.nome}</strong>{" "}
                  <em className={`disp-etiqueta ${numeroEscolhido.canal === "whatsapp_oficial" ? "oficial" : "qr"}`}>
                    {traduzir(numeroEscolhido.etiqueta)}
                  </em>
                  {numeroEscolhido.numeroLegivel ? <span className="hint"> · {numeroEscolhido.numeroLegivel}</span> : null}
                </>
              ) : (
                canalLabel
              )}
            </dd>
            <dt>{traduzir("Destinatários")}</dt>
            <dd>{previa?.receberao ?? "…"} contatos{previa?.semDestino.length ? ` (${previa.semDestino.length} sem destino ficam de fora)` : ""}</dd>
            <dt>{usaTemplate ? "Template" : "Mensagem"}</dt>
            <dd>{usaTemplate ? templateEscolhido!.nome : corpoLivre.split("\n")[0].slice(0, 60)}</dd>
            <dt>{traduzir("Quando")}</dt>
            <dd>{quando === "agora" ? "Agora" : `${data.split("-").reverse().join("/")} às ${hora}`}</dd>
            <dt>{traduzir("Duração prevista")}</dt>
            <dd>{previa ? duracaoLegivel(previa.previsao) : "…"}</dd>
          </dl>
          <PreviaMensagem corpo={corpo} variaveis={variaveis} botoes={botoes} assunto={limites?.exigeAssunto ? assunto : null} />
        </div>
      ) : null}
    </Modal>
  );
}
