"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { blocoValeNaArea } from "@/lib/canais/capacidades";
import { IconGrade, IconLista, IconMaisOpcoes, IconNovaPasta, IconSearch } from "@/components/icons";
import type { PastaSalva } from "@/app/api/automacoes-pastas/route";
import type { ConexaoSocial } from "@/app/api/social/conexoes/route";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";

type Visao = "lista" | "grade";
type FiltroStatus = "todos" | "ativo" | "inativo" | "rascunho";

/** Os gatilhos que existem nesta área, pro filtro. Sai da mesma tabela que a biblioteca usa. */
const GATILHOS_SOCIAIS = BLOCOS_DISPONIVEIS.filter(
  (b) => b.categoria === "gatilho" && blocoValeNaArea(b.tipo, "social"),
);

function dataCurta(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** O gatilho do robô, em palavras. É a coluna que responde "o que faz este aqui começar?". */
function gatilhoDoFluxo(fluxo: FluxoAutomacao): string {
  const no = fluxo.nodes?.find((n) => n.category === "gatilho");
  if (!no) return "Sem gatilho";
  return BLOCOS_DISPONIVEIS.find((b) => b.tipo === no.type)?.label ?? no.type;
}

/**
 * Automações do Instagram e do TikTok.
 *
 * Mesma lista, mesmo editor e mesmo motor dos robôs do funil: o que separa os dois é a `area` do
 * fluxo, que decide quais gatilhos e quais blocos existem na tela. Um robô daqui move o lead no
 * funil, cria tarefa e chama um atendente igual ao outro, porque é o mesmo código rodando.
 */
export default function AutomacoesSociaisPage() {
  const router = useRouter();
  const { fluxos, atualizarFluxo, alternarAtivo, excluirFluxo, duplicarFluxo } = useAutomationFlows();

  const [conexoes, setConexoes] = useState<ConexaoSocial[] | null>(null);
  const [pastas, setPastas] = useState<PastaSalva[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [gatilho, setGatilho] = useState("todos");
  const [visao, setVisao] = useState<Visao>("lista");
  const [pastaAberta, setPastaAberta] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const carregarPastas = useCallback(async () => {
    const r = await fetch("/api/automacoes-pastas?area=social", { cache: "no-store" });
    setPastas(r.ok ? ((await r.json()) as PastaSalva[]) : []);
  }, []);

  useEffect(() => {
    fetch("/api/social/conexoes", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ConexaoSocial[]>) : []))
      .then((dados) => setConexoes(Array.isArray(dados) ? dados : []))
      .catch(() => setConexoes([]));
  }, []);

  useEffect(() => {
    Promise.resolve()
      .then(carregarPastas)
      .catch(() => setPastas([]));
  }, [carregarPastas]);

  const instagram = conexoes?.find((c) => c.canal === "instagram");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return fluxos
      .filter((f) => f.area === "social" && !f.arquivada)
      .filter((f) => (pastaAberta ? f.pastaId === pastaAberta : true))
      .filter((f) => (termo ? f.nome.toLowerCase().includes(termo) : true))
      .filter((f) => {
        if (status === "todos") return true;
        if (status === "rascunho") return f.status === "rascunho";
        if (status === "ativo") return f.status === "publicado" && f.ativa;
        return f.status === "publicado" && !f.ativa;
      })
      .filter((f) => (gatilho === "todos" ? true : f.nodes?.some((n) => n.type === gatilho)));
  }, [fluxos, busca, status, gatilho, pastaAberta]);

  async function novaPasta() {
    const nome = window.prompt("Nome da pasta");
    if (!nome?.trim()) return;
    await fetch("/api/automacoes-pastas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome, area: "social" }),
    });
    await carregarPastas();
  }

  async function apagarPasta(id: string, nome: string) {
    if (!window.confirm(`Apagar a pasta "${nome}"? Os robôs dentro dela voltam pra lista principal.`)) return;
    await fetch(`/api/automacoes-pastas/${id}`, { method: "DELETE" });
    if (pastaAberta === id) setPastaAberta(null);
    await carregarPastas();
  }

  function moverParaPasta(fluxoId: string) {
    const escolha = window.prompt(
      `Digite o número da pasta:\n0 - Nenhuma (lista principal)\n${pastas.map((p, i) => `${i + 1} - ${p.nome}`).join("\n")}`,
    );
    if (escolha === null) return;
    const indice = Number(escolha);
    if (!Number.isFinite(indice) || indice < 0 || indice > pastas.length) return;
    atualizarFluxo(fluxoId, { pastaId: indice === 0 ? null : pastas[indice - 1].id });
    carregarPastas().catch(() => {});
  }

  return (
    <>
      <Topbar
        title="Instagram e TikTok"
        sub="Robôs que respondem comentário, Direct, story e menção"
        actions={
          <button type="button" className="btn primary" onClick={() => router.push("/automacoes/social/novo")}>
            + Criar automação
          </button>
        }
      />
      <AbasAutomacoes />

      <div className="content social-layout">
        <AbasSocial />

        <div className="social-conteudo">
          {instagram && !instagram.conectado ? (
            <section className="card" style={{ marginBottom: "var(--space-3)" }}>
              <strong>O Instagram não está conectado.</strong>
              <p className="hint mt8">
                {instagram.motivo} Dá pra montar os robôs aqui, mas nenhum gatilho vai acontecer.
              </p>
            </section>
          ) : null}

          <div className="social-filtros">
            <div className="social-busca">
              <IconSearch width={14} height={14} aria-hidden="true" />
              <input
                className="input"
                placeholder="Buscar por automações"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as FiltroStatus)}>
              <option value="todos">Status: todos</option>
              <option value="ativo">Ligadas</option>
              <option value="inativo">Pausadas</option>
              <option value="rascunho">Rascunhos</option>
            </select>

            <select className="input" value={gatilho} onChange={(e) => setGatilho(e.target.value)}>
              <option value="todos">Gatilho: todos</option>
              {GATILHOS_SOCIAIS.map((g) => (
                <option key={g.tipo} value={g.tipo}>
                  {g.label}
                </option>
              ))}
            </select>

            <div className="social-visao">
              <button
                type="button"
                className={`icon-btn${visao === "lista" ? " on" : ""}`}
                aria-label="Ver em lista"
                aria-pressed={visao === "lista"}
                onClick={() => setVisao("lista")}
              >
                <IconLista width={14} height={14} />
              </button>
              <button
                type="button"
                className={`icon-btn${visao === "grade" ? " on" : ""}`}
                aria-label="Ver em grade"
                aria-pressed={visao === "grade"}
                onClick={() => setVisao("grade")}
              >
                <IconGrade width={14} height={14} />
              </button>
            </div>
          </div>

          <section className="card">
            <div className="social-secao-topo">
              <h3>
                Pastas <span className="social-contador">{pastas.length}</span>
              </h3>
              <button type="button" className="btn ghost" onClick={novaPasta}>
                <IconNovaPasta width={14} height={14} aria-hidden="true" /> Nova pasta
              </button>
            </div>

            {!pastas.length ? (
              <p className="hint">
                Nenhuma pasta. Com poucos robôs isso não faz falta; a partir de uma dezena, faz.
              </p>
            ) : (
              <div className="social-pastas">
                <button
                  type="button"
                  className={`social-pasta${pastaAberta === null ? " on" : ""}`}
                  onClick={() => setPastaAberta(null)}
                >
                  <strong>Todas</strong>
                  <span>{fluxos.filter((f) => f.area === "social" && !f.arquivada).length}</span>
                </button>
                {pastas.map((p) => (
                  <div key={p.id} className={`social-pasta${pastaAberta === p.id ? " on" : ""}`}>
                    <button type="button" className="social-pasta-abrir" onClick={() => setPastaAberta(p.id)}>
                      <strong>{p.nome}</strong>
                      <span>{p.total}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn subtle"
                      aria-label={`Apagar a pasta ${p.nome}`}
                      onClick={() => apagarPasta(p.id, p.nome)}
                    >
                      <IconMaisOpcoes width={13} height={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card mt16">
            <div className="social-secao-topo">
              <h3>
                Automações <span className="social-contador">{visiveis.length}</span>
              </h3>
            </div>

            {!visiveis.length ? (
              <p className="hint">
                {fluxos.some((f) => f.area === "social")
                  ? "Nenhuma automação com esses filtros."
                  : "Nenhuma automação ainda. Use “+ Criar automação” pra começar."}
              </p>
            ) : visao === "grade" ? (
              <div className="social-grade">
                {visiveis.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="social-card"
                    onClick={() => router.push(`/automacoes/editor/${f.id}`)}
                  >
                    <strong>{f.nome}</strong>
                    <span>{gatilhoDoFluxo(f)}</span>
                    <em>
                      {f.status === "rascunho" ? "Rascunho" : f.ativa ? "Ligada" : "Pausada"} ·{" "}
                      {f.execucoes} execuções
                    </em>
                  </button>
                ))}
              </div>
            ) : (
              <table className="table social-tabela">
                <thead>
                  <tr>
                    <th>Automação</th>
                    <th>Gatilho</th>
                    <th>Criado</th>
                    <th>Última publicação</th>
                    <th>Execuções</th>
                    <th>Situação</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <button
                          type="button"
                          className="link"
                          onClick={() => router.push(`/automacoes/editor/${f.id}`)}
                        >
                          {f.nome}
                        </button>
                      </td>
                      <td className="hint">{gatilhoDoFluxo(f)}</td>
                      <td className="hint">{dataCurta(f.criadoEm)}</td>
                      <td className="hint">{f.publicadoEm ? dataCurta(f.publicadoEm) : "—"}</td>
                      <td>{f.execucoes}</td>
                      <td>
                        {f.status === "rascunho" ? (
                          <span className="badge badge-neutral">Rascunho</span>
                        ) : (
                          <label className="social-toggle">
                            <input type="checkbox" checked={f.ativa} onChange={() => alternarAtivo(f.id)} />
                            <span>{f.ativa ? "Ativo" : "Inativo"}</span>
                          </label>
                        )}
                      </td>
                      <td style={{ textAlign: "right", position: "relative" }}>
                        <button
                          type="button"
                          className="icon-btn subtle"
                          aria-label={`Mais opções de ${f.nome}`}
                          onClick={() => setMenuAberto(menuAberto === f.id ? null : f.id)}
                        >
                          <IconMaisOpcoes width={14} height={14} />
                        </button>
                        {menuAberto === f.id ? (
                          <div className="social-menu-opcoes" role="menu">
                            <button type="button" onClick={() => router.push(`/automacoes/editor/${f.id}`)}>
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const copia = duplicarFluxo(f.id);
                                setMenuAberto(null);
                                if (copia) router.push(`/automacoes/editor/${copia.id}`);
                              }}
                            >
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                moverParaPasta(f.id);
                                setMenuAberto(null);
                              }}
                            >
                              Mover pra pasta
                            </button>
                            <button
                              type="button"
                              className="perigo"
                              onClick={() => {
                                setMenuAberto(null);
                                if (window.confirm(`Excluir "${f.nome}"? Isso não volta.`)) excluirFluxo(f.id);
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
