"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/ui";
import { PreviaMensagem } from "./PreviaMensagem";
import { lerTemplatesColados, type TemplateImportado } from "@/lib/templates/importar";
import { CANAIS_TEMPLATE_OFERECIDOS, CATEGORIAS_META, LIMITES, type CanalTemplate } from "@/lib/templates/regras";
import { useIdioma } from "@/lib/idioma-context";

/** O que aconteceu com cada modelo durante a criação. */
type Resultado = { nome: string; ok: boolean; detalhe: string };

/**
 * IMPORTAR VÁRIOS TEMPLATES DE UMA VEZ.
 *
 * Sete modelos escritos fora do CRM viravam sete idas ao editor — nome, categoria, idioma, corpo,
 * variável, botão, salvar, enviar pra análise, sete vezes. O trabalho de verdade (escrever a
 * mensagem) já estava feito; o que sobrava era digitação, e digitação repetida é onde o erro entra
 * sem ninguém ver.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O LEITOR PALPITA, E ESTA TELA É ONDE O PALPITE APARECE.
 *
 * `lerTemplatesColados` entende o formato em que as pessoas escrevem de verdade, não um formato
 * que alguém teria que aprender — e em troca ele erra às vezes (separar botão de última frase é
 * palpite). Por isso nada é criado direto: cada modelo é desenhado aqui, do jeito que vai ficar,
 * com os problemas dele, e só então ela confirma.
 *
 * O que está certo em silêncio não pede atenção; o que ficou torto está na tela antes de virar um
 * pedido de aprovação na Meta — que é uma fila de horas e uma reprovação que fica no histórico da
 * conta.
 */
export function ImportarTemplates({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: () => void }) {
  const { t: traduzir } = useIdioma();
  const [texto, setTexto] = useState("");
  const [canal, setCanal] = useState<CanalTemplate>("whatsapp_oficial");
  const [paraAnalise, setParaAnalise] = useState(true);
  const [criando, setCriando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  const lidos = useMemo(() => lerTemplatesColados(texto, canal), [texto, canal]);
  const prontos = lidos.filter((t) => t.problemas.length === 0);
  const temAnalise = LIMITES[canal].temAnalise;

  async function criar() {
    setCriando(true);
    const saida: Resultado[] = [];
    for (const t of prontos) {
      try {
        const r = await fetch("/api/templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome: t.nome,
            canal,
            categoria: t.categoria,
            idioma: "pt_BR",
            corpo: t.corpo,
            variaveis: t.variaveis,
            botoes: t.botoes,
          }),
        });
        const dados = (await r.json()) as { id?: string; erro?: string };
        if (!r.ok || !dados.id) throw new Error(dados.erro ?? "não deu pra criar");

        if (paraAnalise && temAnalise) {
          const a = await fetch(`/api/templates/${dados.id}/enviar-analise`, { method: "POST" });
          const resposta = (await a.json().catch(() => ({}))) as { erro?: string };
          if (!a.ok) {
            // Criado mas não enviado é um estado de verdade, e dizer "falhou" aqui esconderia que
            // o rascunho EXISTE — ela criaria tudo de novo e ficaria com sete duplicados.
            saida.push({ nome: t.nome, ok: true, detalhe: `salvo como rascunho · ${resposta.erro ?? "não foi pra análise"}` });
            continue;
          }
          saida.push({ nome: t.nome, ok: true, detalhe: traduzir("enviado para análise da Meta") });
          continue;
        }
        saida.push({ nome: t.nome, ok: true, detalhe: traduzir("salvo como rascunho") });
      } catch (e) {
        saida.push({ nome: t.nome, ok: false, detalhe: e instanceof Error ? e.message : "falhou" });
      }
      setResultados([...saida]);
    }
    setResultados(saida);
    setCriando(false);
  }

  const terminou = !!resultados && !criando;

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo={traduzir("Importar vários templates")}
      largura={1060}
      rodape={
        terminou ? (
          <button type="button" className="btn primary" onClick={aoConcluir}>
            {traduzir("Pronto")}
          </button>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={aoFechar} disabled={criando}>
              {traduzir("Cancelar")}
            </button>
            <button type="button" className="btn primary" disabled={!prontos.length || criando} onClick={() => void criar()}>
              {criando
                ? `${traduzir("Criando")}… ${resultados?.length ?? 0}/${prontos.length}`
                : prontos.length === 1
                  ? traduzir("Criar 1 template")
                  : `${traduzir("Criar")} ${prontos.length} ${traduzir("templates")}`}
            </button>
          </>
        )
      }
    >
      {terminou ? (
        <div className="imp-resultados">
          {resultados.map((r) => (
            <div key={r.nome} className={`imp-resultado${r.ok ? "" : " erro"}`}>
              <span className={`badge ${r.ok ? "badge-success" : "badge-danger"}`}>{r.ok ? "✓" : "!"}</span>
              <strong>{r.nome}</strong>
              <span className="hint">{r.detalhe}</span>
            </div>
          ))}
          <p className="hint">
            {traduzir("A Meta responde em minutos, às vezes horas. O status de cada um muda sozinho aqui na lista quando ela responder.")}
          </p>
        </div>
      ) : (
        <div className="imp-corpo">
          <div className="imp-entrada">
            <div className="field">
              <label>{traduzir("Canal")}</label>
              <select className="input" value={canal} onChange={(e) => setCanal(e.target.value as CanalTemplate)}>
                {CANAIS_TEMPLATE_OFERECIDOS.map((c) => (
                  <option key={c} value={c}>
                    {LIMITES[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{traduzir("Cole os modelos aqui")}</label>
              <textarea
                className="input imp-textarea"
                rows={18}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={
                  "Marketing\nNome: primeiro_contato\nOlá, {{1}}! Tudo bem? Recebemos seu cadastro…\nQuero conhecer\nAgora não\n\nMarketing\nNome: boas_vindas\n…"
                }
              />
              <p className="hint">
                {traduzir("Um modelo por “Nome:”. A categoria pode vir na linha de cima ou como “Categoria:”. As últimas linhas curtas viram botões. O “{{1}}” da Meta vira a variável de primeiro nome.")}
              </p>
            </div>
            {temAnalise ? (
              <label className="imp-opcao">
                <input type="checkbox" checked={paraAnalise} onChange={(e) => setParaAnalise(e.target.checked)} />
                <span>{traduzir("Enviar para análise da Meta assim que criar")}</span>
              </label>
            ) : null}
          </div>

          <div className="imp-previa">
            {!texto.trim() ? (
              <p className="hint">{traduzir("Cole os modelos ao lado para conferir como cada um vai ficar.")}</p>
            ) : !lidos.length ? (
              <p className="modelo-erro">
                {traduzir("Não achei nenhum modelo. Cada um precisa de uma linha “Nome: alguma_coisa”.")}
              </p>
            ) : (
              <>
                <p className="hint">
                  {lidos.length} {lidos.length === 1 ? traduzir("modelo encontrado") : traduzir("modelos encontrados")}
                  {lidos.length !== prontos.length ? ` · ${lidos.length - prontos.length} ${traduzir("com pendência")}` : ""}
                </p>
                {lidos.map((t, i) => (
                  <Cartao key={`${t.nome}-${i}`} t={t} canal={canal} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Cartao({ t, canal }: { t: TemplateImportado; canal: CanalTemplate }) {
  const { t: traduzir } = useIdioma();
  const categoria = CATEGORIAS_META.find((c) => c.valor === t.categoria);
  return (
    <article className={`imp-cartao${t.problemas.length ? " pendente" : ""}`}>
      <header className="imp-cartao-topo">
        <strong>{t.nome || traduzir("(sem nome)")}</strong>
        <span className={`badge ${t.categoria ? "badge-info" : "badge-warning"}`}>
          {categoria?.label ?? traduzir("sem categoria")}
        </span>
      </header>
      {/* A MESMA prévia do editor e do disparo: quem confere aqui e quem confirma o envio
          precisam estar olhando pra mesma bolha, com as variáveis já preenchidas. */}
      <PreviaMensagem corpo={t.corpo} variaveis={t.variaveis} botoes={canal === "whatsapp_oficial" ? t.botoes : null} assunto={null} titulo="" />
      {t.problemas.length ? (
        <ul className="imp-problemas">
          {t.problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
