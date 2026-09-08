"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui";
import { SeletorDeData } from "@/components/seletor-de-data";
import { useContatos } from "@/lib/contatos-context";
import { ORIGENS_DO_CONTATO, mapearVariaveis, type MapeamentoVariavel, type OrigemVariavel } from "@/lib/campanhas/variaveis";
import type { Audiencia, ModoAudiencia } from "@/lib/campanhas/audiencia-tipos";
import type { CanalCampanha } from "@/lib/campanhas/ritmo";
import { LIMITES } from "@/lib/templates/regras";
import type { CanalDisponivel } from "@/app/api/canais/route";
import type { TemplateSalvo } from "./EditorTemplate";
import { PreviaMensagem } from "./PreviaMensagem";

type Opcoes = {
  totalContatos: number;
  origens: { valor: string; total: number }[];
  etiquetas: { valor: string; total: number }[];
  funis: { id: string; nome: string; etapas: { id: string; titulo: string }[] }[];
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
};

const PASSOS = ["Canal", "Público", "Mensagem", "Quando", "Revisar"] as const;

const MODOS: { modo: ModoAudiencia; label: string }[] = [
  { modo: "todos", label: "Todos os contatos" },
  { modo: "etiqueta", label: "Por etiqueta" },
  { modo: "origem", label: "Por origem" },
  { modo: "funil", label: "Por funil" },
  { modo: "etapa", label: "Por etapa do funil" },
  { modo: "periodo", label: "Por data de cadastro" },
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
  const { contatos } = useContatos();
  const [passo, setPasso] = useState(0);
  const [canais, setCanais] = useState<CanalDisponivel[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [templates, setTemplates] = useState<TemplateSalvo[]>([]);

  const [canal, setCanal] = useState<CanalCampanha | null>(null);
  const [audiencia, setAudiencia] = useState<Audiencia>({ modo: "todos" });
  const [busca, setBusca] = useState("");
  const [verQuem, setVerQuem] = useState(false);
  /** Prévia junto com a "chave" (canal + público + variáveis) pra qual ela vale. Se a chave atual
   * for outra, a prévia está velha e a tela mostra "contando" até a nova chegar. */
  const [previaResp, setPreviaResp] = useState<{ chave: string; dados: Previa } | null>(null);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [corpoLivre, setCorpoLivre] = useState("");
  const [assuntoLivre, setAssuntoLivre] = useState("");
  const [variaveis, setVariaveis] = useState<MapeamentoVariavel[]>([]);

  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("09:00");

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/canais", { cache: "no-store" }).then((r) => r.json() as Promise<CanalDisponivel[]>),
      fetch("/api/campanhas/previa", { cache: "no-store" }).then((r) => r.json() as Promise<Opcoes>),
      fetch("/api/templates", { cache: "no-store" }).then((r) => r.json() as Promise<TemplateSalvo[]>),
    ])
      .then(([c, o, t]) => {
        setCanais(Array.isArray(c) ? c : []);
        setOpcoes(o);
        setTemplates(Array.isArray(t) ? t : []);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar."));
  }, []);

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
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha na prévia."));
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
      setErro(e instanceof Error ? e.message : "Não foi possível criar o disparo.");
      setEnviando(false);
    }
  }

  const canalLabel = canal ? LIMITES[canal].label : "";

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo="Novo disparo em massa"
      largura={920}
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={passo === 0 ? aoFechar : () => setPasso((p) => p - 1)} disabled={enviando}>
            {passo === 0 ? "Cancelar" : "Voltar"}
          </button>
          {passo < PASSOS.length - 1 ? (
            <button type="button" className="btn primary" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}>
              Continuar
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
          <p className="hint">Por onde a mensagem sai. Só aparece o que está conectado neste workspace.</p>
          <div className="disp-canais">
            {canais.map((c) => (
              <button
                key={c.canal}
                type="button"
                className={`tpl-canal${canal === c.canal ? " on" : ""}`}
                disabled={!c.conectado}
                title={!c.conectado ? c.motivo : undefined}
                onClick={() => {
                  setCanal(c.canal);
                  setTemplateId(null);
                  setVariaveis([]);
                }}
              >
                <strong>{c.label}</strong>
                <span>{c.conectado ? c.detalhe || "Conectado" : c.motivo}</span>
              </button>
            ))}
            <div className="tpl-canal disp-canal-indisponivel" aria-disabled>
              <strong>Instagram</strong>
              <span>O Instagram não permite mensagem em massa: só responder quem escreveu nas últimas 24h. Use Automações pra isso.</span>
            </div>
          </div>
          {canal ? <p className="hint">{LIMITES[canal].explicacao}</p> : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 2. Público */}
      {passo === 1 && canal ? (
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
                  {m.label}
                </button>
              ))}
            </div>

            {audiencia.modo === "etiqueta" ? (
              <div className="field">
                <label>Etiqueta</label>
                <select className="input" value={audiencia.valor ?? ""} onChange={(e) => setAudiencia({ modo: "etiqueta", valor: e.target.value })}>
                  <option value="">Escolha…</option>
                  {(opcoes?.etiquetas ?? []).map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.valor} ({e.total})
                    </option>
                  ))}
                </select>
                {opcoes && opcoes.etiquetas.length === 0 ? <p className="hint">Nenhum contato tem etiqueta ainda.</p> : null}
              </div>
            ) : null}

            {audiencia.modo === "origem" ? (
              <div className="field">
                <label>Origem</label>
                <select className="input" value={audiencia.valor ?? ""} onChange={(e) => setAudiencia({ modo: "origem", valor: e.target.value })}>
                  <option value="">Escolha…</option>
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
                  <option value="">Escolha…</option>
                  {(opcoes?.funis ?? []).map((f) =>
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
              </div>
            ) : null}

            {audiencia.modo === "periodo" ? (
              <div className="tpl-linha">
                <div className="field">
                  <label>Cadastrados de</label>
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
                <label>Contatos</label>
                <input className="input" placeholder="Buscar pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
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
              <p className="hint">Contando…</p>
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
              <p className="hint">Escolha o público pra ver quantos recebem.</p>
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
                No WhatsApp API Oficial o disparo só sai com um template <strong>aprovado pela Meta</strong>. Os outros aparecem
                aqui com o status, mas não podem ser escolhidos.
              </p>
            ) : (
              <p className="hint">Escolha um template ou escreva a mensagem agora.</p>
            )}

            <div className="modelo-lista disp-templates">
              {templatesDoCanal.length === 0 ? (
                <p className="hint">Nenhum template deste canal ainda. Crie em Automações → Templates.</p>
              ) : null}
              {templatesDoCanal.map((t) => {
                const disponivel = t.status === "aprovado";
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`modelo-item${templateId === t.id ? " escolhido" : ""}`}
                    disabled={!disponivel}
                    onClick={() => escolherTemplate(templateId === t.id ? null : t)}
                  >
                    <strong>
                      {t.nome} <span className={`badge ${disponivel ? "badge-success" : t.status === "em_analise" ? "badge-warning" : "badge-neutral"}`}>{disponivel ? "Aprovado" : t.status === "em_analise" ? "Em análise" : t.status === "rejeitado" ? "Rejeitado" : "Rascunho"}</span>
                    </strong>
                    <span>{t.corpo.slice(0, 140)}</span>
                  </button>
                );
              })}
            </div>

            {canal !== "whatsapp_oficial" && !usaTemplate ? (
              <>
                {limites.exigeAssunto ? (
                  <div className="field">
                    <label>Assunto</label>
                    <input className="input" value={assuntoLivre} onChange={(e) => setAssuntoLivre(e.target.value)} />
                  </div>
                ) : null}
                <div className="field">
                  <label>Mensagem</label>
                  <textarea
                    className="input tpl-corpo"
                    rows={5}
                    value={corpoLivre}
                    placeholder={"Olá {{nome}}, tudo bem?"}
                    onChange={(e) => mudarCorpoLivre(e.target.value)}
                  />
                  <div className="tpl-inserir">
                    <span className="hint">Inserir:</span>
                    {ORIGENS_DO_CONTATO.slice(0, 4).map((o) => (
                      <button key={o.origem} type="button" className="pill" onClick={() => mudarCorpoLivre(`${corpoLivre}{{${o.origem.slice("contato.".length)}}}`)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {variaveis.length ? (
              <div className="field">
                <label>Como preencher cada variável</label>
                <div className="tpl-variaveis">
                  {variaveis.map((v) => (
                    <div key={v.chave} className="tpl-variavel">
                      <code>{`{{${v.chave}}}`}</code>
                      <select
                        className="input"
                        value={v.origem}
                        onChange={(e) => setVariaveis((atual) => atual.map((x) => (x.chave === v.chave ? { ...x, origem: e.target.value as OrigemVariavel } : x)))}
                      >
                        {ORIGENS_DO_CONTATO.map((o) => (
                          <option key={o.origem} value={o.origem}>
                            {o.label} do contato
                          </option>
                        ))}
                        <option value="texto">Texto fixo</option>
                      </select>
                      {v.origem === "texto" ? (
                        <input
                          className="input"
                          placeholder="Valor pra todo mundo"
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
              Enviar agora
            </button>
            <button type="button" className={`pill${quando === "agendar" ? " on" : ""}`} onClick={() => setQuando("agendar")}>
              Agendar
            </button>
          </div>
          {quando === "agendar" ? (
            <div className="tpl-linha">
              <div className="field">
                <label>Data</label>
                <SeletorDeData valor={data} onChange={setData} />
              </div>
              <div className="field">
                <label>Horário</label>
                <input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>
          ) : null}
          {previa ? (
            <p className="hint">
              O envio é feito aos poucos, {previa.ritmo.porMinuto} por minuto{previa.limiteDiario ? ` e até ${previa.limiteDiario.toLocaleString("pt-BR")} pessoas por dia (limite da sua conta na Meta)` : previa.ritmo.porDia ? ` e até ${previa.ritmo.porDia} por dia` : ""}.
              Para {previa.receberao} contatos, leva {duracaoLegivel(previa.previsao)}. {previa.ritmo.explicacao}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ 5. Revisar */}
      {passo === 4 && canal ? (
        <div className="disp-passo disp-duas-colunas">
          <dl className="disp-revisao">
            <dt>Canal</dt>
            <dd>{canalLabel}</dd>
            <dt>Destinatários</dt>
            <dd>{previa?.receberao ?? "…"} contatos{previa?.semDestino.length ? ` (${previa.semDestino.length} sem destino ficam de fora)` : ""}</dd>
            <dt>{usaTemplate ? "Template" : "Mensagem"}</dt>
            <dd>{usaTemplate ? templateEscolhido!.nome : corpoLivre.split("\n")[0].slice(0, 60)}</dd>
            <dt>Quando</dt>
            <dd>{quando === "agora" ? "Agora" : `${data.split("-").reverse().join("/")} às ${hora}`}</dd>
            <dt>Duração prevista</dt>
            <dd>{previa ? duracaoLegivel(previa.previsao) : "…"}</dd>
          </dl>
          <PreviaMensagem corpo={corpo} variaveis={variaveis} botoes={botoes} assunto={limites?.exigeAssunto ? assunto : null} />
        </div>
      ) : null}
    </Modal>
  );
}
