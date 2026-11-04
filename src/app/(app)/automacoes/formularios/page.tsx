"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Ajuda, Toggle } from "@/components/ui";
import { GrupoRecolhivel } from "@/components/automacoes/GrupoRecolhivel";
import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { ProtecoesDoNumero } from "@/components/automacoes/ProtecoesDoNumero";
import { IconExpandir } from "@/components/icons";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import {
  identificadorDoFormularioDoCrm,
  identificadorDoFormularioDoFlow,
} from "@/lib/automation-flow/formulario-do-gatilho";
import { useFormularios } from "@/lib/formularios-context";
import type { RecursoDosFormularios } from "@/app/api/integracoes/azuz-flow/formularios/route";
import type { FormularioDoFlow } from "@/lib/integracoes/azuz-flow-formularios";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * FORMULÁRIOS: o que acontece quando cada um é preenchido.
 *
 * DOIS GRUPOS QUE ABREM, um por origem. Os do AZUZ Flow (só quando há Flow conectado) e os do
 * próprio CRM (sempre). Antes eram duas listas soltas, uma embaixo da outra, e nada dizia que a
 * segunda era de outra procedência — o nome do cartão era a única pista, e some ao rolar. Com o
 * grupo fechado a tela responde "quantos formulários existem, de onde"; aberto, responde "qual
 * deles"; e só o formulário aberto mostra o que ele faz.
 *
 * As cores separam as origens à distância: ouro no Flow, azul no CRM. É a mesma dupla que o resto
 * do produto usa, e vem dos tokens — `--acao` existe nos dois temas; o azul da marca precisa de
 * valor próprio porque `--blue` vira ouro no tema escuro.
 */

/** As variáveis que o texto aceita. Copiadas do servidor em vez de importadas: é texto de tela. */
const VARIAVEIS: [string, string][] = [
  ["{{primeiroNome}}", "o primeiro nome de quem preencheu"],
  ["{{data}}", "a data por extenso"],
  ["{{dataCurta}}", "a data em números"],
  ["{{hora}}", "a hora em Brasília"],
  ["{{link}}", "o link da reunião"],
  ["{{empresa}}", "o nome da sua empresa"],
];

/** O bloco de gatilho do fluxo, quando ele é "formulário preenchido". */
function gatilhoDeFormulario(fluxo: FluxoAutomacao): { formularioId?: string } | null {
  const no = fluxo.nodes.find((n) => n.category === "gatilho");
  if (no?.type !== "formulario_preenchido") return null;
  return (no.data ?? {}) as { formularioId?: string };
}

function Robo({ fluxo }: { fluxo: FluxoAutomacao }) {
  const { t: traduzir } = useIdioma();
  const noAr = fluxo.status === "publicado" && fluxo.ativa;
  return (
    <li className="fflow-robo">
      <Link href={`/automacoes/editor/${fluxo.id}`}>{fluxo.nome}</Link>
      <span className={`pill${noAr ? " on" : ""}`}>
        {noAr ? traduzir("no ar") : fluxo.status === "publicado" ? traduzir("pausado") : traduzir("rascunho")}
      </span>
    </li>
  );
}

function LinhaDoFormulario({
  formulario,
  robos,
  propria,
  geral,
  aoSalvar,
}: {
  formulario: FormularioDoFlow;
  robos: FluxoAutomacao[];
  /** A configuração só deste formulário. `null` = segue a geral. */
  propria: { ativa: boolean; texto: string } | null;
  geral: { ativa: boolean; texto: string };
  aoSalvar: (id: string, valor: { ativa: boolean; texto: string } | null) => Promise<void>;
}) {
  const { t: traduzir } = useIdioma();
  const [aberta, setAberta] = useState(false);

  /*
   * O RASCUNHO LOCAL começa no que ESTE formulário vai fazer hoje — a configuração própria quando
   * existe, a geral quando não. Começar vazio faria o campo parecer "sem mensagem" num formulário
   * que manda mensagem.
   */
  const efetiva = propria ?? geral;
  const [ativa, setAtiva] = useState(efetiva.ativa);
  const [texto, setTexto] = useState(efetiva.texto);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou = ativa !== efetiva.ativa || texto !== efetiva.texto;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(formulario.id, { ativa, texto });
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Não deu pra salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className={`fflow-item${aberta ? " aberta" : ""}`}>
      <button type="button" className="fflow-cabecalho" onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
        <span className="fflow-nome">{formulario.nome}</span>

        <span className="fflow-marcas">
          {/*
            * "NÃO ENVIA AO CRM" EM UMA ETIQUETA, e não num aviso vermelho de duas linhas.
            *
            * No Flow, "enviar ao CRM" é um liga/desliga de cada formulário — conectar a agência não
            * conecta os formulários dela. É informação importante, mas é o estado NORMAL de um
            * formulário que ninguém ligou ainda: com quatro de cinco assim, quatro caixas vermelhas
            * empilhadas leem como quatro defeitos. A explicação inteira fica no corpo, ao abrir.
            */}
          {formulario.enviaAoCrm ? null : <span className="pill alerta">{traduzir("não envia ao CRM")}</span>}
          {formulario.publicado ? null : <span className="pill">{traduzir("rascunho no Flow")}</span>}
          <span className={`pill${efetiva.ativa ? " on" : ""}`}>
            {efetiva.ativa ? traduzir("confirmação ligada") : traduzir("confirmação desligada")}
          </span>
          {robos.length ? (
            <span className="pill">
              {robos.length === 1 ? traduzir("1 robô") : `${robos.length} ${traduzir("robôs")}`}
            </span>
          ) : null}
        </span>

        <IconExpandir className="fflow-seta" width={14} height={14} aria-hidden="true" />
      </button>

      {aberta ? (
        <div className="fflow-corpo">
          {formulario.enviaAoCrm ? null : (
            <p className="fflow-aviso">
              {traduzir(
                "Enquanto o envio ao CRM estiver desligado neste formulário, lá no AZUZ Flow, nada do que for configurado aqui vai acontecer.",
              )}
            </p>
          )}

          {/*
            DOIS BLOCOS COM TÍTULO, e não dez linhas seguidas.
            
            O corpo tinha interruptor, duas notas em cinza, rótulo, campo, seis etiquetas de
            variável, dois botões e uma lista de robôs — tudo com o mesmo peso, empilhado. Separado
            em "a mensagem" e "os robôs", cada pergunta tem onde ser respondida.
          */}
          <section className="fflow-bloco">
            <div className="fflow-bloco-topo">
              <div>
                {/*
                  QUANDO ELA SAI, no "?" e não numa linha cinza fixa.
                  
                  Nem todo formulário tem reunião: num de pesquisa ou de contato este interruptor
                  ligado não manda nada, e sem o aviso "ligada" vira uma promessa que o CRM não
                  cumpre. Mas é explicação de primeira leitura — fixa na tela, ela empilhava com as
                  outras três e fazia a tela parecer documentação. Mandar mensagem a quem respondeu
                  SEM reunião é outra coisa, e se monta como robô: ver o bloco de baixo.
                */}
                <p className="fflow-bloco-titulo">
                  {traduzir("Confirmação de reunião")}
                  <Ajuda
                    texto={traduzir(
                      "Sai só quando o formulário tiver um campo de agendamento preenchido e a pessoa tiver aceitado receber mensagem.",
                    )}
                  />
                </p>
              </div>
              <Toggle defaultOn={ativa} label={traduzir("Confirmação de reunião")} onToggle={setAtiva} />
            </div>

            <label className="lbl-pequeno" htmlFor={`msg-${formulario.id}`}>
              {traduzir("Mensagem que o lead recebe")}
            </label>
            <textarea
              id={`msg-${formulario.id}`}
              className="input fflow-mensagem"
              rows={8}
              maxLength={2000}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />

            {/* As variáveis como etiquetas, numa linha que se dobra: a lista em coluna ocupava mais
                espaço que a própria mensagem. */}
            <p className="fflow-variaveis">
              {VARIAVEIS.map(([chave, explicacao]) => (
                <span key={chave} className="fflow-variavel" title={traduzir(explicacao)}>
                  <code>{chave}</code>
                </span>
              ))}
            </p>

            {erro ? <p className="int-aviso-conflito">{erro}</p> : null}

            <div className="fflow-acoes">
              <button type="button" className="btn primary" disabled={!mudou || salvando} onClick={() => void salvar()}>
                {salvando ? traduzir("Salvando…") : traduzir("Salvar")}
              </button>
              {/*
                APAGAR A EXCEÇÃO é diferente de desligar. Desligado é "neste formulário, não mande";
                sem exceção é "siga a regra geral". Sem este botão não haveria como voltar atrás.
              */}
              {propria ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={salvando}
                  onClick={() => void aoSalvar(formulario.id, null)}
                >
                  {traduzir("Voltar a seguir a geral")}
                </button>
              ) : null}
            </div>
          </section>

          <section className="fflow-bloco">
            <p className="fflow-bloco-titulo">
              {traduzir("Robôs que respondem a este formulário")}
              <Ajuda
                texto={traduzir(
                  "É por aqui que se manda mensagem a quem respondeu SEM marcar reunião: um robô com o gatilho “Formulário preenchido”, com este formulário escolhido.",
                )}
              />
            </p>
            {robos.length ? (
              <ul className="fflow-robos">
                {robos.map((f) => (
                  <Robo key={f.id} fluxo={f} />
                ))}
              </ul>
            ) : (
              <p className="fflow-bloco-nota">
                {traduzir("Nenhum ainda.")}{" "}
                <Link href="/automacoes/novo">{traduzir("Criar um")}</Link>
              </p>
            )}
          </section>
        </div>
      ) : null}
    </li>
  );
}

export default function FormulariosPage() {
  const { t: traduzir } = useIdioma();
  const { fluxos, carregado } = useAutomationFlows();
  const { formularios } = useFormularios();
  const [recurso, setRecurso] = useState<RecursoDosFormularios | null>(null);
  const [erro, setErro] = useState(false);
  const [abertos, setAbertos] = useState<{ flow: boolean; crm: boolean }>({ flow: true, crm: false });

  const carregar = useCallback(() => {
    return fetch("/api/integracoes/azuz-flow/formularios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: RecursoDosFormularios) => {
        setRecurso(Array.isArray(dados?.formularios) ? dados : null);
        setErro(!Array.isArray(dados?.formularios));
        /* Sem Flow conectado não há grupo de Flow pra abrir: o do CRM é a tela inteira. */
        if (!dados?.conectado) setAbertos({ flow: false, crm: true });
      })
      .catch(() => setErro(true));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Grava a exceção de UM formulário. `campo` diz de qual origem ele é. */
  async function salvarUm(
    campo: "umFormulario" | "umFormularioDoCrm",
    id: string,
    valor: { ativa: boolean; texto: string } | null,
  ) {
    const resposta = await fetch("/api/integracoes/azuz-flow/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [campo]: { id, confirmacao: valor } }),
    });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      throw new Error(corpo?.erro ?? traduzir("Não deu pra salvar."));
    }
    await carregar();
  }

  const salvarFormulario = (id: string, valor: { ativa: boolean; texto: string } | null) =>
    salvarUm("umFormulario", id, valor);
  const salvarFormularioDoCrm = (id: string, valor: { ativa: boolean; texto: string } | null) =>
    salvarUm("umFormularioDoCrm", id, valor);

  const deFormulario = fluxos.filter((f) => gatilhoDeFormulario(f) !== null && !f.arquivada);

  /*
   * OS ROBÔS QUE RESPONDEM A TUDO ficam numa faixa própria, em cima.
   *
   * É o estado herdado: nenhum robô publicado antes desta mudança tem formulário escolhido, então
   * todos estão aqui. Escondê-los faria cada linha dizer "nenhum robô responde a este formulário"
   * enquanto, na prática, TODOS respondem a todos — o defeito que a pessoa veio consertar.
   */
  const respondemATudo = deFormulario.filter((f) => !gatilhoDeFormulario(f)?.formularioId?.trim());
  const robosDoFormulario = (id: string) => {
    const identificador = identificadorDoFormularioDoFlow(id);
    return deFormulario.filter((f) => gatilhoDeFormulario(f)?.formularioId?.trim() === identificador);
  };
  // O do CRM vai sem prefixo nenhum. Ver `formulario-do-gatilho.ts`.
  const robosDoFormularioDoCrm = (id: string) =>
    deFormulario.filter((f) => gatilhoDeFormulario(f)?.formularioId?.trim() === identificadorDoFormularioDoCrm(id));

  const doFlow = recurso?.formularios ?? [];

  return (
    <>
      {/* Sem faixa de título: a aba acesa na barra de cima já diz em que tela se está. */}
      <AcoesNoTopo>
        <Link className="btn primary" href="/automacoes/novo">
          {traduzir("+ Nova automação")}
        </Link>
      </AcoesNoTopo>

      {/* `fform-pilha`: o respiro entre os cartões vem de um `gap` só, e não de uma margem
          escrita em cada um. Eram três cartões encostados, com a divisa de 1px fazendo o trabalho
          que o espaço devia fazer. */}
      <div className="content fform-pilha">
        {/* As proteções do número vêm antes dos formulários porque valem para todos eles. */}
        <ProtecoesDoNumero />

        {respondemATudo.length ? (
          <section className="card">
            <p className="int-title">{traduzir("Respondem a qualquer formulário")}</p>
            <p className="hint">
              {traduzir(
                "Estes robôs disparam para todo formulário preenchido, do CRM e do Flow. Abra cada um e escolha o formulário no bloco de gatilho para separar as respostas.",
              )}
            </p>
            <ul className="fflow-robos">
              {respondemATudo.map((f) => (
                <Robo key={f.id} fluxo={f} />
              ))}
            </ul>
          </section>
        ) : null}

        {erro ? (
          <section className="card">
            <p className="hint">{traduzir("Não deu pra ler a lista de formulários agora.")}</p>
          </section>
        ) : !recurso || !carregado ? (
          <p className="hint">{traduzir("Carregando…")}</p>
        ) : (
          <>
            {/*
              O GRUPO DO FLOW SÓ EXISTE COM FLOW CONECTADO.
              
              Antes era a aba inteira que sumia, e com os formulários do CRM morando aqui isso
              escondia metade da tela de quem não usa o Flow. Quem aparece e some agora é o grupo.
            */}
            {recurso.conectado ? (
              <GrupoRecolhivel
                tom="ouro"
                titulo={traduzir("Formulários do AZUZ Flow")}
                explicacao={traduzir("Chegam sozinhos do Flow, com a chave que vocês conectaram.")}
                contagem={doFlow.length}
                aberto={abertos.flow}
                aoAlternar={() => setAbertos((a) => ({ ...a, flow: !a.flow }))}
              >
                {doFlow.length ? (
                  <ul className="fflow-lista">
                    {doFlow.map((f) => (
                      <LinhaDoFormulario
                        /*
                         * A CHAVE CARREGA SE HÁ REGRA PRÓPRIA, e não só o id.
                         *
                         * A linha guarda o rascunho do campo em estado local, começando no que vale
                         * hoje. Ao apagar a exceção ("voltar a seguir a geral"), o que vale passa a
                         * ser outro, e sem remontar a linha ela continuaria mostrando o texto
                         * antigo — com o botão Salvar aceso, porque ele compararia com o novo valor
                         * efetivo.
                         */
                        key={`${f.id}:${recurso.porFormulario[f.id] ? "proprio" : "geral"}`}
                        formulario={f}
                        robos={robosDoFormulario(f.id)}
                        propria={recurso.porFormulario[f.id]?.confirmacao ?? null}
                        geral={recurso.geral}
                        aoSalvar={salvarFormulario}
                      />
                    ))}
                  </ul>
                ) : (
                  /*
                    A lista vem DO FLOW, e dizer isso é o que evita a pessoa procurar aqui um botão
                    de "adicionar formulário" que não existe nem deve existir: quem cria formulário
                    é o Flow.
                  */
                  <p className="fflow-vazio">
                    {traduzir(
                      "Nenhum ainda. Todo formulário publicado no AZUZ Flow aparece aqui sozinho, sem precisar cadastrar nada.",
                    )}
                  </p>
                )}
              </GrupoRecolhivel>
            ) : null}

            {/*
              OS FORMULÁRIOS DO PRÓPRIO CRM, na mesma pasta.
              
              Eles moravam em Configurações, num cartão "Formulário do CRM" com UMA mensagem pra
              todos. A pergunta é a mesma dos de cima — "o que acontece quando preenchem este
              formulário" — e responder em dois lugares faria procurar no errado metade das vezes.
            */}
            <GrupoRecolhivel
              tom="azul"
              titulo={traduzir("Formulários do CRM")}
              explicacao={traduzir("Os que vocês montaram aqui dentro, em Formulários.")}
              contagem={formularios.length}
              aberto={abertos.crm}
              aoAlternar={() => setAbertos((a) => ({ ...a, crm: !a.crm }))}
            >
              {formularios.length ? (
                <ul className="fflow-lista">
                  {formularios.map((f) => (
                    <LinhaDoFormulario
                      key={`crm:${f.id}:${recurso.porFormularioDoCrm[f.id] ? "proprio" : "geral"}`}
                      formulario={{ id: f.id, nome: f.nome, publicado: f.status === "publicado", enviaAoCrm: true }}
                      robos={robosDoFormularioDoCrm(f.id)}
                      propria={recurso.porFormularioDoCrm[f.id]?.confirmacao ?? null}
                      geral={recurso.geralDoCrm}
                      aoSalvar={salvarFormularioDoCrm}
                    />
                  ))}
                </ul>
              ) : (
                <p className="fflow-vazio">
                  {traduzir("Nenhum ainda.")} <Link href="/formularios">{traduzir("Criar um formulário")}</Link>
                </p>
              )}
            </GrupoRecolhivel>
          </>
        )}

        {recurso?.sincronizadaEm ? (
          <p className="hint">
            {traduzir("Lista recebida do Flow em")} {new Date(recurso.sincronizadaEm).toLocaleString("pt-BR")}.
          </p>
        ) : null}
      </div>
    </>
  );
}
