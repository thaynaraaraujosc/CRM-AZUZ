"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MODELOS_SOCIAIS } from "@/lib/social/modelos-rapidos";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { IconAutomacoes, IconClose, IconDoc, IconSearch, IconSparkle } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Como começar uma automação do Instagram.
 *
 * Três caminhos, e a ordem é a da chance de dar certo: modelo primeiro (é um robô inteiro pronto
 * pra ajustar), do zero depois (pra quem já sabe o que quer), e a IA por último, marcada como o
 * que ela é hoje.
 *
 * A IA aparece DESLIGADA e escrita como "Em breve", de propósito. Ela ainda não monta automação
 * aqui, e um cartão bonito que abre um campo de texto sem nada atrás seria a forma mais rápida de
 * quebrar a confiança na tela inteira: quem tenta uma vez e não funciona não tenta as outras duas.
 */
/**
 * O QUE O MODELO TRAZ, lido do próprio modelo.
 *
 * O cartão da galeria mostra "ativado quando você receber" e as palavras-chave, e os dois saem de
 * `construir()` — o mesmo código que monta o robô. Escrever essa lista à mão numa tabela paralela
 * daria, no primeiro modelo editado, um cartão prometendo um gatilho que o robô não tem.
 */
function resumoDoModelo(modeloId: string): { gatilhos: string[]; palavras: string[] } {
  const modelo = MODELOS_SOCIAIS.find((m) => m.id === modeloId);
  if (!modelo) return { gatilhos: [], palavras: [] };
  const { nodes } = modelo.construir();
  const gatilhos: string[] = [];
  const palavras: string[] = [];
  for (const n of nodes) {
    if (n.category !== "gatilho") continue;
    const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === n.type);
    if (bloco) gatilhos.push(bloco.label);
    const d = (n.data ?? {}) as { palavras?: unknown };
    if (Array.isArray(d.palavras)) {
      for (const p of d.palavras) if (typeof p === "string" && p.trim()) palavras.push(p.trim());
    }
  }
  return { gatilhos, palavras };
}

export default function NovaAutomacaoSocialPage() {
  const { t: traduzir } = useIdioma();
  const router = useRouter();
  const { criarFluxo } = useAutomationFlows();
  const [escolhendoModelo, setEscolhendoModelo] = useState(false);
  const [buscaModelo, setBuscaModelo] = useState("");

  const termo = buscaModelo.trim().toLowerCase();
  const modelosFiltrados = termo
    ? MODELOS_SOCIAIS.filter(
        (m) => m.nome.toLowerCase().includes(termo) || m.descricao.toLowerCase().includes(termo),
      )
    : MODELOS_SOCIAIS;

  function doZero() {
    const novo = criarFluxo({ nome: "Sem título", area: "social" });
    router.push(`/automacoes/editor/${novo.id}`);
  }

  function doModelo(modeloId: string) {
    const modelo = MODELOS_SOCIAIS.find((m) => m.id === modeloId);
    if (!modelo) return;
    const { nodes, edges, configuracoes } = modelo.construir();
    // Rascunho, sempre. Publicar sozinho ligaria uma automação que ninguém leu, respondendo
    // cliente com texto de exemplo.
    const novo = criarFluxo({
      nome: modelo.nome,
      descricao: modelo.descricao,
      area: "social",
      nodes,
      edges,
      configuracoes,
    });
    router.push(`/automacoes/editor/${novo.id}`);
  }

  return (
    <>
      <Topbar title={traduzir("Criar automação")} sub="Social Seller" />

      <div className="content">
        <nav className="social-migalhas" aria-label={traduzir("Onde você está")}>
          <button type="button" className="link" onClick={() => router.push("/social-seller/automacoes")}>
            {traduzir("Automações")}
          </button>
          <span aria-hidden="true">›</span>
          <strong>{traduzir("Nova automação")}</strong>
        </nav>

        {!escolhendoModelo ? (
          <div className="social-caminhos">
            <button type="button" className="social-caminho destaque" onClick={() => setEscolhendoModelo(true)}>
              <span className="social-caminho-selo">{traduzir("Mais rápido")}</span>
              <IconDoc width={26} height={26} aria-hidden="true" />
              <strong>{traduzir("Começar com um modelo")}</strong>
              <span>{traduzir("Um robô inteiro já montado, feito só de gatilhos e blocos que existem no Instagram. Você troca o texto e publica.")}</span>
            </button>

            <button type="button" className="social-caminho" onClick={doZero}>
              <IconAutomacoes width={26} height={26} aria-hidden="true" />
              <strong>{traduzir("Criar do zero")}</strong>
              <span>{traduzir("Canvas em branco. Você escolhe o gatilho e monta bloco a bloco, no seu ritmo.")}</span>
            </button>

            <div className="social-caminho desativado" aria-disabled="true">
              <span className="social-caminho-selo em-breve">{traduzir("Em breve")}</span>
              <IconSparkle width={26} height={26} aria-hidden="true" />
              <strong>{traduzir("Descrever pra IA montar")}</strong>
              <span>{traduzir("Escrever o que você quer e receber a automação pronta. Ainda não está de pé, e por isso está desligado em vez de aberto e sem nada atrás.")}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/*
        A GALERIA DE MODELOS NUMA JANELA, e não numa seção empurrando a página pra baixo.
        
        Escolher modelo é um desvio de dez segundos dentro de "criar automação": a janela deixa os
        três caminhos no lugar, atrás, e some sem mexer no que estava na tela. Cada cartão diz o
        que dispara o robô e com que palavra — as duas perguntas que a pessoa faz antes de escolher.
      */}
      {escolhendoModelo ? (
        <div className="modal-overlay" onClick={() => setEscolhendoModelo(false)}>
          <div className="tpl-janela" role="dialog" aria-label={traduzir("Templates de automação")} onClick={(e) => e.stopPropagation()}>
            <header className="tpl-topo">
              <h3>{traduzir("Templates de automação")}</h3>
              <button type="button" className="tpl-fechar" aria-label={traduzir("Fechar")} onClick={() => setEscolhendoModelo(false)}>
                <IconClose width={14} height={14} />
              </button>
            </header>

            <div className="tpl-corpo">
              <div className="tpl-busca">
                <IconSearch width={14} height={14} aria-hidden="true" />
                <input
                  className="input"
                  placeholder={traduzir("Buscar templates…")}
                  value={buscaModelo}
                  onChange={(e) => setBuscaModelo(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="tpl-grade">
                {modelosFiltrados.map((m) => {
                  const { gatilhos, palavras } = resumoDoModelo(m.id);
                  return (
                    <button key={m.id} type="button" className="tpl-cartao" onClick={() => doModelo(m.id)}>
                      <span className="tpl-selo">{traduzir("Automações")}</span>
                      <strong>{traduzir(m.nome)}</strong>
                      <span className="tpl-desc">{traduzir(m.descricao)}</span>
                      <span className="tpl-meta">
                        <span className="tpl-meta-col">
                          <em>{traduzir("Ativado quando você receber")}</em>
                          <span className="tpl-pills">
                            {gatilhos.map((g) => (
                              <span key={g} className="tpl-pill">
                                {traduzir(g)}
                              </span>
                            ))}
                          </span>
                        </span>
                        {palavras.length ? (
                          <span className="tpl-meta-col">
                            <em>{traduzir("Palavras-chave/frase")}</em>
                            <span className="tpl-pills">
                              {palavras.map((p) => (
                                <span key={p} className="tpl-pill">
                                  {p}
                                </span>
                              ))}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="tpl-ajustar">{traduzir(m.ajustar)}</span>
                    </button>
                  );
                })}
                {!modelosFiltrados.length ? <p className="hint">{traduzir("Nenhum template com esse nome.")}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
