"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import {
  identificadorDoFormularioDoFlow,
} from "@/lib/automation-flow/formulario-do-gatilho";
import type { FormularioDoFlow, ListaDeFormularios } from "@/lib/integracoes/azuz-flow-formularios";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * FORMULÁRIOS DO AZUZ FLOW: qual robô responde a cada um.
 *
 * A tela existe por causa de um defeito com duas metades, e mostra as duas:
 *
 *  1. O CRM só sabia que um formulário do Flow existia DEPOIS que chegava um lead dele. Formulário
 *     novo, ou ainda não preenchido por ninguém, não existia aqui — e não dava pra preparar robô
 *     nenhum pra ele. Agora o Flow manda a lista inteira (ver `azuz-flow-formularios.ts`).
 *  2. Todo robô de "formulário preenchido" respondia a TODO formulário, porque o disparo não dizia
 *     de qual formulário o evento vinha. Era por isso que a mesma resposta chegava para
 *     formulários diferentes.
 *
 * O que ela NÃO faz é editar robô: a escolha do formulário mora no bloco de gatilho, dentro do
 * próprio robô, que é onde o resto da configuração dele está. Ter dois lugares para a mesma
 * escolha é como se cria a tela que discorda do que o robô faz.
 */

/** O bloco de gatilho do fluxo, quando ele é "formulário preenchido". */
function gatilhoDeFormulario(fluxo: FluxoAutomacao): { formularioId?: string } | null {
  const no = fluxo.nodes.find((n) => n.category === "gatilho");
  if (no?.type !== "formulario_preenchido") return null;
  return (no.data ?? {}) as { formularioId?: string };
}

function Robo({ fluxo }: { fluxo: FluxoAutomacao }) {
  const { t: traduzir } = useIdioma();
  const no = fluxo.status === "publicado" && fluxo.ativa;
  return (
    <li className="fflow-robo">
      <Link href={`/automacoes/editor/${fluxo.id}`}>{fluxo.nome}</Link>
      <span className={`pill${no ? " on" : ""}`}>
        {no ? traduzir("no ar") : fluxo.status === "publicado" ? traduzir("pausado") : traduzir("rascunho")}
      </span>
    </li>
  );
}

function CartaoDoFormulario({
  formulario,
  robos,
}: {
  formulario: FormularioDoFlow;
  robos: FluxoAutomacao[];
}) {
  const { t: traduzir } = useIdioma();
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
        * pessoa montaria um robô aqui pra um formulário que nunca vai disparar, e nada na tela
        * diria por quê.
        */}
      {formulario.enviaAoCrm ? null : (
        <p className="int-aviso-conflito">
          {traduzir("Este formulário não está enviando ao CRM. Ligue o envio nele, lá no AZUZ Flow.")}
        </p>
      )}

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

function FormulariosDoFlowConteudo() {
  const { t: traduzir } = useIdioma();
  const { fluxos, carregado } = useAutomationFlows();
  const [lista, setLista] = useState<ListaDeFormularios | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/integracoes/azuz-flow/formularios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((dados: ListaDeFormularios) => {
        setLista(Array.isArray(dados?.formularios) ? dados : { formularios: [], sincronizadaEm: null });
      })
      .catch(() => setErro(true));
  }, []);

  const deFormulario = fluxos
    .filter((f) => gatilhoDeFormulario(f) !== null)
    .filter((f) => !f.arquivada);

  /*
   * OS ROBÔS QUE RESPONDEM A TUDO ficam numa faixa própria, em cima.
   *
   * É o estado herdado: nenhum robô publicado antes desta mudança tem formulário escolhido, então
   * todos estão aqui. Escondê-los faria a tela dizer "nenhum robô responde a este formulário"
   * embaixo de cada cartão enquanto, na prática, TODOS respondem a todos — exatamente o defeito
   * que a pessoa veio consertar.
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
        sub={traduzir("Qual robô responde a cada formulário")}
        actions={<Link className="btn primary" href="/automacoes/novo">{traduzir("+ Nova automação")}</Link>}
      />
      <AbasAutomacoes />

      <div className="content">
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
        ) : !lista || !carregado ? (
          <p className="hint">{traduzir("Carregando…")}</p>
        ) : !lista.formularios.length ? (
          <section className="card">
            <p className="int-title">{traduzir("Nenhum formulário do AZUZ Flow ainda")}</p>
            {/*
              A lista vem DO FLOW, e dizer isso é o que evita a pessoa procurar aqui um botão de
              "adicionar formulário" que não existe nem deve existir: quem cria formulário é o Flow.
            */}
            <p className="hint">
              {traduzir(
                "Quem manda a lista é o próprio AZUZ Flow, com a chave que vocês já conectaram. Se os formulários não aparecerem, confira a conexão em Configurações → Outras integrações.",
              )}
            </p>
          </section>
        ) : (
          <div className="fflow-grade">
            {lista.formularios.map((f) => (
              <CartaoDoFormulario key={f.id} formulario={f} robos={robosDoFormulario(f.id)} />
            ))}
          </div>
        )}

        {lista?.sincronizadaEm ? (
          <p className="hint">
            {traduzir("Lista recebida do Flow em")} {new Date(lista.sincronizadaEm).toLocaleString("pt-BR")}.
          </p>
        ) : null}
      </div>
    </>
  );
}

export default function FormulariosDoFlowPage() {
  return <FormulariosDoFlowConteudo />;
}
