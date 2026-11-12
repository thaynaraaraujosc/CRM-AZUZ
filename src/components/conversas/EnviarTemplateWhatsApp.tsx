"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";

import {
  buscarModelos,
  modelosEmCache,
  type ModeloWhatsApp as Template,
} from "@/lib/conversas/modelos-whatsapp";

type ComponenteTemplate = { type?: string; text?: string; format?: string };

/** Texto do corpo do modelo. É o que a pessoa vai receber, e o único jeito de escolher sem
 * decorar nomes como `primeiro_contato_v2`. */
function corpoDoTemplate(componentes: unknown): string {
  if (!Array.isArray(componentes)) return "";
  const corpo = (componentes as ComponenteTemplate[]).find((c) => c.type?.toUpperCase() === "BODY");
  return corpo?.text ?? "";
}

/** Quantas variáveis ({{1}}, {{2}}…) o corpo espera. A Meta recusa o envio se faltar alguma. */
function quantidadeDeVariaveis(texto: string): number {
  const encontradas = texto.match(/\{\{(\d+)\}\}/g) ?? [];
  const numeros = encontradas.map((v) => Number(v.replace(/\D/g, "")));
  return numeros.length ? Math.max(...numeros) : 0;
}

function preencher(texto: string, valores: string[]): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] || `{{${n}}}`);
}

/**
 * Envio de modelo aprovado: o único jeito de FALAR PRIMEIRO com alguém no WhatsApp.
 *
 * Fora da janela de 24h (ou com quem nunca escreveu), a Meta recusa mensagem livre. Até aqui o CRM
 * sabia buscar os modelos e sabia enviá-los, mas não tinha por onde escolher um: quem usava ficava
 * preso a só responder quem chamasse primeiro. Inútil pra prospecção, que é metade do trabalho
 * comercial.
 */
export function EnviarTemplateWhatsApp({
  destinatario,
  contatoNome,
  aoFechar,
  aoEnviar,
}: {
  destinatario: string;
  contatoNome: string;
  aoFechar: () => void;
  aoEnviar: (texto: string, wamid?: string) => void;
}) {
  const { t: traduzir } = useIdioma();
  /*
   * JÁ ABRE PREENCHIDA quando a lista foi aquecida.
   *
   * "Na hora que eu clico em escolher o modelo, já aparece, sem essa espera." O estado nasce com o
   * que está no cache — então, no caso normal, não há um instante sequer de "Carregando seus
   * modelos…": a janela abre com os modelos na tela. Ver `modelos-whatsapp.ts`.
   */
  const [templates, setTemplates] = useState<Template[] | null>(() => modelosEmCache());
  const [erro, setErro] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<Template | null>(null);
  const [valores, setValores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    /* Busca mesmo com cache quente: é barato (a ida é compartilhada e o cache vale por minutos) e
       garante que um modelo aprovado agora apareça sem ninguém recarregar a página. O que a
       pessoa vê não espera por isto — a lista já está na tela. */
    buscarModelos()
      .then(setTemplates)
      .catch((e: Error) => setErro(e.message));
  }, []);

  // Só modelo APROVADO pode ser enviado. Mostrar os pendentes como se pudessem seria empurrar o
  // usuário pra um erro da Meta que ele não teria como entender.
  const aprovados = useMemo(
    () => (templates ?? []).filter((t) => t.status?.toUpperCase() === "APPROVED"),
    [templates],
  );

  const corpo = escolhido ? corpoDoTemplate(escolhido.componentes) : "";
  const totalVariaveis = quantidadeDeVariaveis(corpo);
  const faltaPreencher = valores.slice(0, totalVariaveis).some((v) => !v?.trim()) || valores.length < totalVariaveis;

  async function enviar() {
    if (!escolhido) return;
    setEnviando(true);
    setErro(null);
    try {
      const componentes = totalVariaveis
        ? [
            {
              type: "body",
              parameters: Array.from({ length: totalVariaveis }, (_, i) => ({
                type: "text",
                text: valores[i] ?? "",
              })),
            },
          ]
        : undefined;

      const resposta = await fetch("/api/integracoes/meta/whatsapp/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinatario,
          contatoNome,
          template: { nome: escolhido.nome, idioma: escolhido.idioma, componentes },
        }),
      });
      const dados = (await resposta.json()) as { erro?: string; wamid?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao enviar o modelo.");

      // A bolha na conversa mostra o texto JÁ preenchido. É o que a pessoa recebeu, não o molde
      // com {{1}}.
      aoEnviar(preencher(corpo, valores), dados.wamid);
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Falha ao enviar o modelo."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={aoFechar}
      titulo={traduzir("Iniciar conversa com um modelo")}
      tamanho="lg"
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={aoFechar}>
            {traduzir("Cancelar")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!escolhido || faltaPreencher || enviando}
            onClick={() => void enviar()}
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </>
      }
    >
      <p className="hint">{traduzir("O WhatsApp só deixa você falar primeiro com um modelo aprovado. Depois que a pessoa responder, a conversa fica livre por 24 horas.")}</p>

      {erro ? <p className="modelo-erro">{erro}</p> : null}

      {templates === null ? (
        <p className="hint">{traduzir("Carregando seus modelos…")}</p>
      ) : aprovados.length === 0 ? (
        <p className="hint">{traduzir("Você ainda não tem nenhum modelo aprovado. Crie um no Gerenciador do WhatsApp (Modelos de mensagem): a aprovação costuma sair em minutos.")}</p>
      ) : (
        <div className="modelo-lista">
          {aprovados.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`modelo-item${escolhido?.id === t.id ? " escolhido" : ""}`}
              onClick={() => {
                setEscolhido(t);
                setValores([]);
              }}
            >
              <strong>{t.nome}</strong>
              <em>{t.categoria}</em>
              <span>{corpoDoTemplate(t.componentes).slice(0, 120)}</span>
            </button>
          ))}
        </div>
      )}

      {escolhido && totalVariaveis > 0 ? (
        <div className="modelo-variaveis">
          {Array.from({ length: totalVariaveis }, (_, i) => (
            <div className="field" key={i}>
              <label>Valor de {`{{${i + 1}}}`}</label>
              <input
                className="input"
                value={valores[i] ?? ""}
                onChange={(e) => {
                  const novos = [...valores];
                  novos[i] = e.target.value;
                  setValores(novos);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {escolhido ? (
        <div className="modelo-previa">
          <span className="hint">{traduzir("A pessoa vai receber:")}</span>
          <p>{preencher(corpo, valores)}</p>
        </div>
      ) : null}
    </Modal>
  );
}
