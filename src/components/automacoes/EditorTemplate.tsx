"use client";

import { useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui";
import { ORIGENS_DO_CONTATO, mapearVariaveis, type MapeamentoVariavel, type OrigemVariavel } from "@/lib/campanhas/variaveis";
import {
  CATEGORIAS_META,
  IDIOMAS,
  LIMITES,
  validarTemplate,
  type BotaoTemplate,
  type CanalTemplate,
} from "@/lib/templates/regras";
import type { CanalDisponivel } from "@/app/api/canais/route";
import { PreviaMensagem } from "./PreviaMensagem";

export type TemplateSalvo = {
  id: string;
  nome: string;
  canal: CanalTemplate;
  categoria: string | null;
  idioma: string;
  assunto: string | null;
  corpo: string;
  variaveis: MapeamentoVariavel[] | null;
  botoes: BotaoTemplate[] | null;
  status: string;
  motivoRejeicao: string | null;
  whatsappTemplateId: string | null;
  atualizadoEm: string;
};

type Rascunho = {
  nome: string;
  canal: CanalTemplate;
  categoria: string;
  idioma: string;
  assunto: string;
  corpo: string;
  variaveis: MapeamentoVariavel[];
  botoes: BotaoTemplate[];
};

function rascunhoDe(t: TemplateSalvo | null, canalPadrao: CanalTemplate): Rascunho {
  return {
    nome: t?.nome ?? "",
    canal: t?.canal ?? canalPadrao,
    categoria: t?.categoria ?? "MARKETING",
    idioma: t?.idioma ?? "pt_BR",
    assunto: t?.assunto ?? "",
    corpo: t?.corpo ?? "",
    variaveis: t?.variaveis ?? [],
    botoes: t?.botoes ?? [],
  };
}

/**
 * Editor visual de template. Quem usa não precisa saber que a Meta numera variáveis nem o que é
 * um `component`: escreve a mensagem com `{{nome}}`, clica pra inserir um campo do contato, adiciona
 * botões até o limite do canal, e vê a prévia do lado. A conversão pro formato da Meta acontece
 * no servidor, na hora de enviar pra análise.
 */
export function EditorTemplate({
  template,
  canais,
  aoFechar,
  aoSalvar,
}: {
  /** `null` = criando. */
  template: TemplateSalvo | null;
  canais: CanalDisponivel[];
  aoFechar: () => void;
  aoSalvar: (salvo: TemplateSalvo, enviarParaAnalise: boolean) => Promise<void>;
}) {
  const canalPadrao = (canais.find((c) => c.conectado)?.canal ?? "whatsapp_oficial") as CanalTemplate;
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(template, canalPadrao));
  const [salvando, setSalvando] = useState<"salvar" | "analise" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  const limites = LIMITES[r.canal];
  const editavelNaMeta = !template?.whatsappTemplateId || template.status === "rejeitado";
  const problemas = useMemo(() => validarTemplate(r), [r]);

  // A cada tecla o mapeamento acompanha o texto: variável nova ganha origem adivinhada; a que
  // sumiu do texto sai; índice e origem das que ficaram são preservados. Feito no mesmo `set` do
  // texto (não num efeito) pra prévia e validação já enxergarem os dois juntos.
  function mudarCorpo(corpo: string) {
    setR((a) => ({ ...a, corpo, variaveis: mapearVariaveis(corpo, a.variaveis) }));
  }

  function inserirNoCorpo(trecho: string) {
    const el = corpoRef.current;
    if (!el) {
      mudarCorpo(`${r.corpo}${trecho}`);
      return;
    }
    const inicio = el.selectionStart ?? el.value.length;
    const fim = el.selectionEnd ?? el.value.length;
    mudarCorpo(`${el.value.slice(0, inicio)}${trecho}${el.value.slice(fim)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + trecho.length, inicio + trecho.length);
    });
  }

  function mudarVariavel(chave: string, mudanca: Partial<MapeamentoVariavel>) {
    setR((a) => ({ ...a, variaveis: a.variaveis.map((v) => (v.chave === chave ? { ...v, ...mudanca } : v)) }));
  }

  async function salvar(enviarParaAnalise: boolean) {
    setErro(null);
    setSalvando(enviarParaAnalise ? "analise" : "salvar");
    try {
      const resposta = await fetch(template ? `/api/templates/${template.id}` : "/api/templates", {
        method: template ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r),
      });
      const dados = (await resposta.json()) as TemplateSalvo & { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível salvar.");
      await aoSalvar(dados, enviarParaAnalise);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(null);
    }
  }

  const contagemCorpo = `${r.corpo.length.toLocaleString("pt-BR")} / ${limites.corpoMaximo.toLocaleString("pt-BR")}`;

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo={template ? "Editar template" : "Novo template"}
      largura={960}
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!!salvando || problemas.length > 0 || !editavelNaMeta}
            onClick={() => void salvar(false)}
          >
            {salvando === "salvar" ? "Salvando…" : limites.temAnalise ? "Salvar rascunho" : "Salvar"}
          </button>
          {limites.temAnalise ? (
            <button
              type="button"
              className="btn primary"
              disabled={!!salvando || problemas.length > 0 || !editavelNaMeta}
              onClick={() => void salvar(true)}
              title="Salva e envia pra análise da Meta"
            >
              {salvando === "analise" ? "Enviando…" : "Salvar e enviar para análise"}
            </button>
          ) : null}
        </>
      }
    >
      {!editavelNaMeta ? (
        <p className="tpl-aviso">
          Este template já está na Meta. Pra mudar o texto, feche e use <strong>Duplicar</strong>: a cópia pode ser
          editada e enviada pra análise como um modelo novo.
        </p>
      ) : null}
      {erro ? <p className="modelo-erro">{erro}</p> : null}

      <div className="tpl-editor">
        <div className="tpl-editor-form">
          <div className="field">
            <label>Nome do template</label>
            <input
              className="input"
              value={r.nome}
              placeholder="Ex.: Retomar atendimento"
              onChange={(e) => setR((a) => ({ ...a, nome: e.target.value }))}
              disabled={!editavelNaMeta}
            />
          </div>

          <div className="field">
            <label>Canal</label>
            <div className="tpl-canais">
              {canais.map((c) => (
                <button
                  key={c.canal}
                  type="button"
                  className={`tpl-canal${r.canal === c.canal ? " on" : ""}`}
                  disabled={!c.conectado || !!template}
                  title={!c.conectado ? c.motivo : template ? "O canal não muda depois de criado; duplique se precisar." : undefined}
                  onClick={() => setR((a) => ({ ...a, canal: c.canal, botoes: LIMITES[c.canal].botoesMaximo ? a.botoes : [] }))}
                >
                  <strong>{c.label}</strong>
                  <span>{c.conectado ? c.detalhe || "Conectado" : "Não conectado"}</span>
                </button>
              ))}
            </div>
            <p className="hint">{limites.explicacao}</p>
          </div>

          {limites.exigeCategoria || limites.exigeIdioma ? (
            <div className="tpl-linha">
              {limites.exigeCategoria ? (
                <div className="field">
                  <label>Categoria</label>
                  <select className="input" value={r.categoria} onChange={(e) => setR((a) => ({ ...a, categoria: e.target.value }))} disabled={!editavelNaMeta}>
                    {CATEGORIAS_META.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="hint">{CATEGORIAS_META.find((c) => c.valor === r.categoria)?.explicacao}</p>
                </div>
              ) : null}
              {limites.exigeIdioma ? (
                <div className="field">
                  <label>Idioma</label>
                  <select className="input" value={r.idioma} onChange={(e) => setR((a) => ({ ...a, idioma: e.target.value }))} disabled={!editavelNaMeta}>
                    {IDIOMAS.map((i) => (
                      <option key={i.valor} value={i.valor}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {limites.exigeAssunto ? (
            <div className="field">
              <label>Assunto</label>
              <input className="input" value={r.assunto} onChange={(e) => setR((a) => ({ ...a, assunto: e.target.value }))} />
            </div>
          ) : null}

          <div className="field">
            <label>Mensagem</label>
            <textarea
              ref={corpoRef}
              className="input tpl-corpo"
              rows={6}
              value={r.corpo}
              placeholder={"Olá {{nome}}, vi que você demonstrou interesse em {{produto}}. Gostaria de continuar o atendimento?"}
              onChange={(e) => mudarCorpo(e.target.value)}
              disabled={!editavelNaMeta}
            />
            <div className="tpl-inserir">
              <span className="hint">Inserir:</span>
              {ORIGENS_DO_CONTATO.slice(0, 5).map((o) => {
                const chave = o.origem.slice("contato.".length);
                return (
                  <button key={o.origem} type="button" className="pill" onClick={() => inserirNoCorpo(`{{${chave}}}`)} disabled={!editavelNaMeta}>
                    {o.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="pill"
                disabled={!editavelNaMeta}
                onClick={() => {
                  const nome = window.prompt("Nome da variável (só letras, sem espaço). Ex.: produto");
                  const limpo = (nome ?? "").trim().replace(/[^a-zA-Z0-9_]/g, "");
                  if (limpo) inserirNoCorpo(`{{${limpo}}}`);
                }}
              >
                + Variável personalizada
              </button>
              <span className="hint tpl-contagem">{contagemCorpo}</span>
            </div>
          </div>

          {r.variaveis.length ? (
            <div className="field">
              <label>Variáveis</label>
              <div className="tpl-variaveis">
                {r.variaveis.map((v) => (
                  <div key={v.chave} className="tpl-variavel">
                    <code>{`{{${v.chave}}}`}</code>
                    <select
                      className="input"
                      value={v.origem}
                      onChange={(e) => mudarVariavel(v.chave, { origem: e.target.value as OrigemVariavel })}
                      disabled={!editavelNaMeta}
                    >
                      {ORIGENS_DO_CONTATO.map((o) => (
                        <option key={o.origem} value={o.origem}>
                          {o.label} do contato
                        </option>
                      ))}
                      <option value="texto">Texto fixo (preencho no disparo)</option>
                    </select>
                    {v.origem === "texto" ? (
                      <input
                        className="input"
                        placeholder="Valor padrão (opcional)"
                        value={v.valor ?? ""}
                        onChange={(e) => mudarVariavel(v.chave, { valor: e.target.value })}
                        disabled={!editavelNaMeta}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {limites.botoesMaximo > 0 ? (
            <div className="field">
              <label>
                Botões de resposta <span className="hint">(até {limites.botoesMaximo}, {limites.botaoMaximo} caracteres cada)</span>
              </label>
              <div className="tpl-botoes">
                {r.botoes.map((b, i) => (
                  <div key={i} className="tpl-botao">
                    <input
                      className="input"
                      value={b.texto}
                      maxLength={limites.botaoMaximo}
                      placeholder="Ex.: Sim, quero continuar"
                      onChange={(e) => setR((a) => ({ ...a, botoes: a.botoes.map((x, j) => (j === i ? { texto: e.target.value } : x)) }))}
                      disabled={!editavelNaMeta}
                    />
                    <span className="hint">{b.texto.length}/{limites.botaoMaximo}</span>
                    <button type="button" className="btn ghost" onClick={() => setR((a) => ({ ...a, botoes: a.botoes.filter((_, j) => j !== i) }))} disabled={!editavelNaMeta} aria-label="Remover botão">
                      ×
                    </button>
                  </div>
                ))}
                {r.botoes.length < limites.botoesMaximo ? (
                  <button type="button" className="pill" onClick={() => setR((a) => ({ ...a, botoes: [...a.botoes, { texto: "" }] }))} disabled={!editavelNaMeta}>
                    + Adicionar botão
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {problemas.length && (r.corpo || r.nome) ? (
            <ul className="tpl-problemas">
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <PreviaMensagem corpo={r.corpo} variaveis={r.variaveis} botoes={r.botoes} assunto={limites.exigeAssunto ? r.assunto : null} />
      </div>
    </Modal>
  );
}
