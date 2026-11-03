"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Topbar, Toggle } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { ProtecoesDoNumero } from "@/components/automacoes/ProtecoesDoNumero";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { identificadorDoFormularioDoFlow } from "@/lib/automation-flow/formulario-do-gatilho";
import type { RecursoDosFormularios } from "@/app/api/integracoes/azuz-flow/formularios/route";
import type { FormularioDoFlow } from "@/lib/integracoes/azuz-flow-formularios";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * FORMULÁRIOS DO AZUZ FLOW: o que acontece quando cada um é preenchido.
 *
 * Duas coisas por formulário, e as duas estavam no lugar errado antes:
 *
 *  1. A CONFIRMAÇÃO DE REUNIÃO — ligar e escrever a mensagem que o lead recebe. Morava em
 *     Configurações › Outras integrações, numa configuração só para todos os formulários. Mas
 *     Configurações é onde se CONECTA uma integração; o que acontece quando um formulário é
 *     preenchido é automação, e é diferente de um formulário pro outro.
 *  2. OS ROBÔS que respondem àquele formulário, com link pra abrir cada um.
 *
 * A aba só existe quando o Flow está conectado (ver `AbasAutomacoes`): sem chave não há lista, e
 * uma aba que só sabe dizer "conecte primeiro" é um lugar a mais pra não encontrar nada.
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

function CartaoDoFormulario({
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
  /*
   * O RASCUNHO LOCAL começa no que ESTE formulário vai fazer hoje — a configuração própria quando
   * existe, a geral quando não. Começar vazio faria o campo parecer "sem mensagem" num formulário
   * que manda mensagem; começar na própria apenas quando ela existe faria o texto aparecer do nada
   * ao ligar o botão.
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
    <section className="card fflow-card">
      <header className="fflow-card-topo">
        <p className="int-title">{formulario.nome}</p>
        {formulario.publicado ? null : <span className="pill">{traduzir("rascunho no Flow")}</span>}
      </header>

      {/*
        * A RESPOSTA PRA "POR QUE ESSE FORMULÁRIO NUNCA CHEGA".
        *
        * No Flow, "enviar ao CRM" é um liga/desliga DE CADA FORMULÁRIO — conectar a agência não
        * conecta os formulários dela. Era isso que fazia "conectei e só veio um". Sem este aviso, a
        * pessoa configuraria aqui um formulário que nunca vai chegar, e nada diria por quê.
        */}
      {formulario.enviaAoCrm ? null : (
        <p className="int-aviso-conflito">
          {traduzir("Este formulário não está enviando ao CRM. Ligue o envio nele, lá no AZUZ Flow.")}
        </p>
      )}

      <div className="fflow-confirmacao">
        <div className="toggle-row">
          <span className="tl">
            {traduzir("Confirmação de reunião")}
            {!propria ? <span className="pill fflow-herdado">{traduzir("igual à geral")}</span> : null}
          </span>
          <Toggle defaultOn={ativa} label={traduzir("Confirmação de reunião")} onToggle={setAtiva} />
        </div>

        <label className="lbl-pequeno" htmlFor={`msg-${formulario.id}`}>
          {traduzir("Mensagem")}
        </label>
        <textarea
          id={`msg-${formulario.id}`}
          className="input"
          rows={5}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p className="hint fflow-variaveis">
          {VARIAVEIS.map(([chave, explicacao]) => (
            <span key={chave}>
              <code>{chave}</code> {traduzir(explicacao)}
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
            <button type="button" className="btn ghost" disabled={salvando} onClick={() => void aoSalvar(formulario.id, null)}>
              {traduzir("Voltar a seguir a geral")}
            </button>
          ) : null}
        </div>
      </div>

      {robos.length ? (
        <ul className="fflow-robos">
          {robos.map((f) => (
            <Robo key={f.id} fluxo={f} />
          ))}
        </ul>
      ) : (
        <p className="hint">
          {traduzir("Nenhum robô responde só a este formulário.")}{" "}
          <Link href="/automacoes/novo">{traduzir("Criar um")}</Link>
        </p>
      )}
    </section>
  );
}

export default function FormulariosDoFlowPage() {
  const { t: traduzir } = useIdioma();
  const { fluxos, carregado } = useAutomationFlows();
  const [recurso, setRecurso] = useState<RecursoDosFormularios | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    return fetch("/api/integracoes/azuz-flow/formularios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: RecursoDosFormularios) => {
        setRecurso(Array.isArray(dados?.formularios) ? dados : null);
        setErro(!Array.isArray(dados?.formularios));
      })
      .catch(() => setErro(true));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarFormulario(id: string, valor: { ativa: boolean; texto: string } | null) {
    const resposta = await fetch("/api/integracoes/azuz-flow/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ umFormulario: { id, confirmacao: valor } }),
    });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
      throw new Error(corpo?.erro ?? traduzir("Não deu pra salvar."));
    }
    await carregar();
  }

  const deFormulario = fluxos.filter((f) => gatilhoDeFormulario(f) !== null && !f.arquivada);

  /*
   * OS ROBÔS QUE RESPONDEM A TUDO ficam numa faixa própria, em cima.
   *
   * É o estado herdado: nenhum robô publicado antes desta mudança tem formulário escolhido, então
   * todos estão aqui. Escondê-los faria cada cartão dizer "nenhum robô responde a este formulário"
   * enquanto, na prática, TODOS respondem a todos — o defeito que a pessoa veio consertar.
   */
  const respondemATudo = deFormulario.filter((f) => !gatilhoDeFormulario(f)?.formularioId?.trim());
  const robosDoFormulario = (id: string) => {
    const identificador = identificadorDoFormularioDoFlow(id);
    return deFormulario.filter((f) => gatilhoDeFormulario(f)?.formularioId?.trim() === identificador);
  };

  return (
    <>
      <Topbar
        title={traduzir("Formulários do AZUZ Flow")}
        sub={traduzir("O que acontece quando cada formulário é preenchido")}
        actions={<Link className="btn primary" href="/automacoes/novo">{traduzir("+ Nova automação")}</Link>}
      />
      <AbasAutomacoes />

      <div className="content">
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
        ) : !recurso.formularios.length ? (
          <section className="card">
            <p className="int-title">{traduzir("Nenhum formulário do AZUZ Flow ainda")}</p>
            {/*
              A lista vem DO FLOW, e dizer isso é o que evita a pessoa procurar aqui um botão de
              "adicionar formulário" que não existe nem deve existir: quem cria formulário é o Flow.
            */}
            <p className="hint">
              {traduzir(
                "Quem manda a lista é o próprio AZUZ Flow, com a chave que vocês já conectaram. Todo formulário publicado lá aparece aqui sozinho.",
              )}
            </p>
          </section>
        ) : (
          <div className="fflow-grade">
            {recurso.formularios.map((f) => (
              <CartaoDoFormulario
                /*
                 * A CHAVE CARREGA SE HÁ REGRA PRÓPRIA, e não só o id.
                 *
                 * O cartão guarda o rascunho do campo em estado local, começando no que vale hoje.
                 * Ao apagar a exceção ("voltar a seguir a geral"), o que vale passa a ser outro, e
                 * sem remontar o cartão continuaria mostrando o texto antigo — com o botão Salvar
                 * aceso, porque ele compararia com o novo valor efetivo.
                 */
                key={`${f.id}:${recurso.porFormulario[f.id] ? "proprio" : "geral"}`}
                formulario={f}
                robos={robosDoFormulario(f.id)}
                propria={recurso.porFormulario[f.id]?.confirmacao ?? null}
                geral={recurso.geral}
                aoSalvar={salvarFormulario}
              />
            ))}
          </div>
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
