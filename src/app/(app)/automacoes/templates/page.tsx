"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { EditorTemplate, type TemplateSalvo } from "@/components/automacoes/EditorTemplate";
import { PreviaMensagem } from "@/components/automacoes/PreviaMensagem";
import { LIMITES, STATUS_LABEL, type CanalTemplate } from "@/lib/templates/regras";
import type { CanalDisponivel } from "@/app/api/canais/route";

const BADGE_POR_STATUS: Record<string, string> = {
  rascunho: "badge-neutral",
  em_analise: "badge-warning",
  aprovado: "badge-success",
  rejeitado: "badge-danger",
};

/**
 * Templates: a lista de mensagens reutilizáveis do workspace.
 *
 * Não é o construtor de automações. É só onde a mensagem é escrita uma vez pra ser escolhida
 * depois, no Disparo em massa e (na próxima etapa) dentro de uma automação. No WhatsApp oficial
 * o status vem da Meta; nos outros canais o template fica pronto ao salvar.
 */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSalvo[] | null>(null);
  const [canais, setCanais] = useState<CanalDisponivel[]>([]);
  const [editando, setEditando] = useState<TemplateSalvo | null | "novo">(null);
  const [filtroCanal, setFiltroCanal] = useState<CanalTemplate | "todos">("todos");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetch("/api/templates", { cache: "no-store" }).then((r) => r.json() as Promise<TemplateSalvo[]>),
      fetch("/api/canais", { cache: "no-store" }).then((r) => r.json() as Promise<CanalDisponivel[]>),
    ]);
    setTemplates(Array.isArray(t) ? t : []);
    setCanais(Array.isArray(c) ? c : []);
  }, []);

  useEffect(() => {
    // Referência, não chamada: o setState fica dentro do `then`, fora do corpo do efeito.
    Promise.resolve().then(recarregar).catch((e) => console.error("Falha ao carregar templates:", e));
  }, [recarregar]);

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 4000);
  }

  async function acao(t: TemplateSalvo, qual: "analise" | "duplicar" | "excluir") {
    if (qual === "excluir" && !window.confirm(`Excluir "${t.nome}"? ${t.whatsappTemplateId ? "Ele também será apagado na Meta." : ""}`)) return;
    setOcupado(`${t.id}:${qual}`);
    try {
      const url = qual === "excluir" ? `/api/templates/${t.id}` : `/api/templates/${t.id}/${qual === "analise" ? "enviar-analise" : "duplicar"}`;
      const resposta = await fetch(url, { method: qual === "excluir" ? "DELETE" : "POST" });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu certo.");
      avisar(qual === "analise" ? "Enviado pra análise da Meta." : qual === "duplicar" ? "Cópia criada." : "Template excluído.");
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não deu certo.");
    } finally {
      setOcupado(null);
    }
  }

  const visiveis = useMemo(
    () => (templates ?? []).filter((t) => filtroCanal === "todos" || t.canal === filtroCanal),
    [templates, filtroCanal],
  );
  const algumCanal = canais.some((c) => c.conectado);

  return (
    <>
      <Topbar
        title="Templates"
        sub="Mensagens reutilizáveis para disparos e automações"
        actions={
          <button type="button" className="btn primary" onClick={() => setEditando("novo")} disabled={!algumCanal} title={!algumCanal ? "Conecte um canal em Configurações → Outras integrações" : undefined}>
            + Novo template
          </button>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        {aviso ? <div className="tpl-toast">{aviso}</div> : null}

        <div className="tpl-filtros">
          {(["todos", ...Object.keys(LIMITES)] as ("todos" | CanalTemplate)[]).map((c) => (
            <button key={c} type="button" className={`pill${filtroCanal === c ? " on" : ""}`} onClick={() => setFiltroCanal(c)}>
              {c === "todos" ? "Todos" : LIMITES[c].label}
            </button>
          ))}
        </div>

        {templates === null ? (
          <p className="hint">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <div className="card tpl-vazio">
            <strong>Nenhum template ainda.</strong>
            <p className="hint">
              Um template é uma mensagem escrita uma vez e usada muitas: no Disparo em massa e, em breve, dentro das automações.
              {algumCanal ? " Comece pelo botão acima." : " Conecte um canal em Configurações → Outras integrações pra começar."}
            </p>
          </div>
        ) : (
          <div className="tpl-grade">
            {visiveis.map((t) => {
              const podeEditar = !t.whatsappTemplateId || t.status === "rejeitado";
              const podeAnalise = t.canal === "whatsapp_oficial" && (t.status === "rascunho" || t.status === "rejeitado");
              return (
                <article key={t.id} className="card tpl-card">
                  <header className="tpl-card-cabecalho">
                    <div>
                      <strong>{t.nome}</strong>
                      <span className="hint">{LIMITES[t.canal]?.label ?? t.canal}{t.categoria ? ` · ${t.categoria.toLowerCase()}` : ""}</span>
                    </div>
                    <span className={`badge ${BADGE_POR_STATUS[t.status] ?? "badge-neutral"}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                  </header>

                  <PreviaMensagem corpo={t.corpo} variaveis={t.variaveis ?? []} botoes={t.botoes} assunto={t.assunto} titulo="" />

                  {t.status === "rejeitado" && t.motivoRejeicao ? <p className="tpl-rejeicao">Motivo da Meta: {t.motivoRejeicao}</p> : null}

                  <footer className="tpl-card-acoes">
                    {podeEditar ? (
                      <button type="button" className="btn ghost" onClick={() => setEditando(t)}>
                        Editar
                      </button>
                    ) : null}
                    {podeAnalise ? (
                      <button type="button" className="btn ghost" disabled={ocupado === `${t.id}:analise`} onClick={() => void acao(t, "analise")}>
                        {ocupado === `${t.id}:analise` ? "Enviando…" : "Enviar para análise"}
                      </button>
                    ) : null}
                    <button type="button" className="btn ghost" disabled={ocupado === `${t.id}:duplicar`} onClick={() => void acao(t, "duplicar")}>
                      Duplicar
                    </button>
                    <button type="button" className="btn ghost tpl-excluir" disabled={ocupado === `${t.id}:excluir`} onClick={() => void acao(t, "excluir")}>
                      Excluir
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editando ? (
        <EditorTemplate
          template={editando === "novo" ? null : editando}
          canais={canais}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (salvo, enviarParaAnalise) => {
            setEditando(null);
            if (enviarParaAnalise) {
              await acao(salvo, "analise");
            } else {
              avisar("Template salvo.");
              await recarregar();
            }
          }}
        />
      ) : null}
    </>
  );
}
