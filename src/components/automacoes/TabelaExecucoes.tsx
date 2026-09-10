"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

import { contagem } from "@/lib/plural";
import type { ExecucaoDetalhada } from "@/app/api/automacoes/execucoes/route";

const SITUACAO_LABEL: Record<string, string> = {
  em_andamento: "Rodando",
  aguardando_tempo: "Esperando o relógio",
  aguardando_evento: "Esperando a resposta",
  concluida: "Concluída",
  cancelada: "Cancelada",
  erro: "Erro",
};

const RESULTADO_LABEL: Record<string, string> = {
  ok: "feito",
  condicao_falsa: "condição não bateu",
  aguardando: "esperando",
  erro: "erro",
  pulado: "pulado",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function classeDaSituacao(situacao: string): string {
  if (situacao === "erro") return "badge-danger";
  if (situacao === "concluida") return "badge-success";
  return "badge-neutral";
}

/**
 * Quanto tempo falta, em palavras. Passado vira "a qualquer momento": a execução já venceu e o
 * cron pega na próxima batida, então dizer "há 3 minutos" assustaria sem motivo.
 */
function faltam(iso: string): string {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutos <= 0) return "a qualquer momento";
  if (minutos < 60) return `em ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `em ${horas}h`;
  return `em ${Math.round(horas / 24)} dias`;
}

/**
 * A lista de execuções, com a timeline de cada uma.
 *
 * Uma só, usada pelo comercial e pelo social, porque a pergunta é a mesma nas duas áreas: "o que
 * aconteceu com esse lead?". Duas cópias divergiriam na primeira correção feita só de um lado, e a
 * área que ficasse pra trás voltaria a ser a que não responde.
 *
 * A coluna "Esperando até" é a razão de esta tela existir. Sem ela, uma execução parada esperando
 * o relógio é indistinguível de uma travada, e foi exatamente essa dúvida que fez um follow-up que
 * não saiu virar meia noite de investigação.
 */
export function TabelaExecucoes({ execucoes, vazio }: { execucoes: ExecucaoDetalhada[]; vazio: string }) {
  const [aberta, setAberta] = useState<string | null>(null);

  if (!execucoes.length) return <p className="hint mt8">{vazio}</p>;

  return (
    <div className="tabela-rolavel mt8">
      <table className="table">
        <thead>
          <tr>
            <th>Começou</th>
            <th>Robô</th>
            <th>Contato</th>
            <th>Situação</th>
            <th>Esperando até</th>
            <th aria-label="Passos" />
          </tr>
        </thead>
        <tbody>
          {execucoes.map((e) => (
            // Duas linhas por execução (a linha e os passos abertos), então a chave vive no
            // Fragment: no `<>` sem chave o React reclama e reordena errado ao filtrar.
            <Fragment key={e.id}>
              <tr>
                <td className="hint">{quando(e.iniciadaEm)}</td>
                <td>
                  <Link href={`/automacoes/editor/${e.fluxoId}`}>{e.fluxoNome}</Link>
                </td>
                <td>{e.contatoNome}</td>
                <td>
                  <span className={`badge ${classeDaSituacao(e.situacao)}`}>
                    {SITUACAO_LABEL[e.situacao] ?? e.situacao}
                  </span>
                  {e.erroMensagem ? <p className="hint mt8">{e.erroMensagem}</p> : null}
                </td>
                <td className="hint">
                  {e.aguardandoAte ? (
                    <>
                      {quando(e.aguardandoAte)}
                      <br />
                      {faltam(e.aguardandoAte)}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn ghost" onClick={() => setAberta(aberta === e.id ? null : e.id)}>
                    {aberta === e.id ? "Fechar" : contagem(e.passos.length, "passo", "passos")}
                  </button>
                </td>
              </tr>
              {aberta === e.id ? (
                <tr>
                  <td colSpan={6}>
                    <ol className="execucao-passos">
                      {e.passos.map((p, i) => (
                        <li key={`${e.id}-${i}`} className={p.resultado === "erro" ? "erro" : undefined}>
                          <span className="hint">{quando(p.criadoEm)}</span>{" "}
                          <strong>{p.titulo || p.noTipo}</strong> — {RESULTADO_LABEL[p.resultado] ?? p.resultado}
                          {p.detalhe ? `: ${p.detalhe}` : ""}
                        </li>
                      ))}
                      {!e.passos.length ? <li>Nenhum passo registrado.</li> : null}
                    </ol>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
