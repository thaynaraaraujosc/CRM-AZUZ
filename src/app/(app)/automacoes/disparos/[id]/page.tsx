"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { PreviaMensagem } from "@/components/automacoes/PreviaMensagem";
import { descreverAudiencia, type Audiencia } from "@/lib/campanhas/audiencia-tipos";
import { STATUS_CAMPANHA, STATUS_DESTINATARIO, formatarData } from "@/lib/campanhas/apresentacao";
import type { MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { LIMITES } from "@/lib/templates/regras";

type Destinatario = {
  id: string;
  contatoNome: string;
  destino: string;
  status: string;
  erroMensagem: string | null;
  tentativas: number;
  enviadoEm: string | null;
  entregueEm: string | null;
  lidoEm: string | null;
  respondidoEm: string | null;
};

type Campanha = {
  id: string;
  titulo: string;
  corpo: string;
  assunto: string | null;
  canal: keyof typeof LIMITES;
  status: string;
  agendadaPara: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  erroMensagem: string | null;
  templateNome: string | null;
  variaveis: MapeamentoVariavel[] | null;
  audiencia: Audiencia | null;
  destinatarios: Destinatario[];
};

/** Acompanhamento de um disparo: o que aconteceu com cada pessoa, e os controles. */
export default function DetalheDisparoPage() {
  const { id } = useParams<{ id: string }>();
  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "falhou" | "respondido" | "pendente">("todos");
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const r = await fetch(`/api/campanhas/${id}`, { cache: "no-store" });
    const dados = (await r.json()) as Campanha & { erro?: string };
    if (!r.ok) throw new Error(dados.erro ?? "Disparo não encontrado.");
    setCampanha(dados);
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(recarregar).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar."));
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") recarregar().catch(() => {});
    }, 15_000);
    return () => clearInterval(intervalo);
  }, [recarregar]);

  async function controlar(acao: "pausar" | "retomar" | "cancelar") {
    if (acao === "cancelar" && !window.confirm("Cancelar este disparo? Quem já recebeu continua registrado; o resto não será enviado.")) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/campanhas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) });
      const dados = (await r.json()) as { erro?: string };
      if (!r.ok) throw new Error(dados.erro ?? "Não deu certo.");
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu certo.");
    } finally {
      setOcupado(false);
    }
  }

  const resumo = useMemo(() => {
    const d = campanha?.destinatarios ?? [];
    const conta = (s: string[]) => d.filter((x) => s.includes(x.status)).length;
    return {
      total: d.length,
      enviadas: conta(["enviado", "entregue", "lido"]),
      entregues: conta(["entregue", "lido"]),
      lidas: conta(["lido"]),
      respondidas: d.filter((x) => x.respondidoEm).length,
      falhas: conta(["falhou"]),
      pendentes: conta(["pendente", "enviando"]),
    };
  }, [campanha]);

  const visiveis = useMemo(() => {
    const d = campanha?.destinatarios ?? [];
    if (filtro === "falhou") return d.filter((x) => x.status === "falhou");
    if (filtro === "respondido") return d.filter((x) => x.respondidoEm);
    if (filtro === "pendente") return d.filter((x) => x.status === "pendente" || x.status === "enviando");
    return d;
  }, [campanha, filtro]);

  const st = campanha ? (STATUS_CAMPANHA[campanha.status] ?? { label: campanha.status, badge: "badge-neutral" }) : null;
  const podePausar = campanha && ["agendada", "enviando"].includes(campanha.status);
  const podeRetomar = campanha?.status === "pausada";
  const podeCancelar = campanha && !["concluida", "concluida_com_erros", "cancelada"].includes(campanha.status);

  return (
    <>
      <Topbar
        title={campanha?.titulo ?? "Disparo"}
        sub={campanha ? `${LIMITES[campanha.canal]?.label ?? campanha.canal} · ${descreverAudiencia(campanha.audiencia)}` : undefined}
        actions={
          <div className="disp-controles">
            <Link href="/automacoes/disparos" className="btn ghost">
              ← Todos os disparos
            </Link>
            {podePausar ? (
              <button type="button" className="btn ghost" disabled={ocupado} onClick={() => void controlar("pausar")}>
                Pausar
              </button>
            ) : null}
            {podeRetomar ? (
              <button type="button" className="btn ghost" disabled={ocupado} onClick={() => void controlar("retomar")}>
                Retomar
              </button>
            ) : null}
            {podeCancelar ? (
              <button type="button" className="btn ghost tpl-excluir" disabled={ocupado} onClick={() => void controlar("cancelar")}>
                Cancelar disparo
              </button>
            ) : null}
          </div>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        {erro ? <p className="modelo-erro">{erro}</p> : null}
        {!campanha ? (
          <p className="hint">Carregando…</p>
        ) : (
          <div className="disp-detalhe">
            <div className="card disp-detalhe-resumo">
              <div className="disp-item-cabecalho">
                <div>
                  <strong>Situação</strong>
                  <span className="hint">
                    Agendado para {formatarData(campanha.agendadaPara)}
                    {campanha.iniciadaEm ? ` · começou ${formatarData(campanha.iniciadaEm)}` : ""}
                    {campanha.concluidaEm ? ` · terminou ${formatarData(campanha.concluidaEm)}` : ""}
                  </span>
                </div>
                {st ? <span className={`badge ${st.badge}`}>{st.label}</span> : null}
              </div>
              {campanha.erroMensagem ? <p className="tpl-rejeicao">{campanha.erroMensagem}</p> : null}
              <div className="disp-metricas">
                <Metrica valor={resumo.total} label="destinatários" />
                <Metrica valor={resumo.enviadas} label="enviadas" />
                <Metrica valor={resumo.entregues} label="entregues" />
                <Metrica valor={resumo.lidas} label="lidas" />
                <Metrica valor={resumo.respondidas} label="respondidas" />
                <Metrica valor={resumo.falhas} label="falhas" destaque={resumo.falhas > 0} />
                <Metrica valor={resumo.pendentes} label="na fila" />
              </div>
              <PreviaMensagem
                corpo={campanha.corpo}
                variaveis={campanha.variaveis ?? []}
                assunto={campanha.assunto}
                titulo={campanha.templateNome ? `Template: ${campanha.templateNome}` : "Mensagem"}
              />
            </div>

            <div className="card disp-destinatarios">
              <div className="disp-modos">
                {(
                  [
                    ["todos", `Todos (${resumo.total})`],
                    ["pendente", `Na fila (${resumo.pendentes})`],
                    ["respondido", `Responderam (${resumo.respondidas})`],
                    ["falhou", `Falhas (${resumo.falhas})`],
                  ] as const
                ).map(([valor, label]) => (
                  <button key={valor} type="button" className={`pill${filtro === valor ? " on" : ""}`} onClick={() => setFiltro(valor)}>
                    {label}
                  </button>
                ))}
              </div>
              <table className="disp-tabela">
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Destino</th>
                    <th>Situação</th>
                    <th>Quando</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((d) => (
                    <tr key={d.id} className={d.status === "falhou" ? "falhou" : ""}>
                      <td>
                        <Link href={`/conversas?contato=${encodeURIComponent(d.contatoNome)}`}>{d.contatoNome}</Link>
                      </td>
                      <td className="hint">{d.destino}</td>
                      <td>
                        {STATUS_DESTINATARIO[d.status] ?? d.status}
                        {d.respondidoEm ? " · respondeu" : ""}
                      </td>
                      <td className="hint">{formatarData(d.lidoEm ?? d.entregueEm ?? d.enviadoEm)}</td>
                      <td className="hint">{d.erroMensagem ?? (d.tentativas > 1 ? `${d.tentativas} tentativas` : "")}</td>
                    </tr>
                  ))}
                  {visiveis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="hint">
                        Ninguém neste filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {campanha.destinatarios.length >= 1000 ? <p className="hint">Mostrando os primeiros 1.000 destinatários.</p> : null}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Metrica({ valor, label, destaque }: { valor: number; label: string; destaque?: boolean }) {
  return (
    <div className={`disp-metrica${destaque ? " destaque" : ""}`}>
      <strong>{valor}</strong>
      <span>{label}</span>
    </div>
  );
}
