"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MODELOS_SOCIAIS } from "@/lib/social/modelos-rapidos";
import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { IconClose, IconSearch } from "@/components/icons";
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

/*
 * AS TRÊS ILUSTRAÇÕES DOS CAMINHOS.
 *
 * Eram três ícones de linha de 26px, do mesmo jogo que a barra lateral usa: do tamanho de um
 * marcador de lista, e os três com o mesmo peso e a mesma cor. "O meu tá com muita cara de IA."
 * Num ecrã que faz UMA pergunta — por onde começar — o desenho é o que separa as respostas antes
 * da leitura, e três marcadores iguais não separam nada.
 *
 * São desenhos CHAPADOS, sem degradê nem brilho: a cor vem dos tokens do CRM (o azul da marca, o
 * dourado de `--acao`) por regra de CSS, e não por atributo, porque atributo de apresentação em
 * SVG não resolve `var()` — escrito como atributo, o desenho sairia preto. As classes viram cor
 * no `globals.css`, e lá o tema escuro troca a paleta inteira de uma vez.
 */

/** Modelo pronto: uma pilha de robôs já montados, com o selo de "conferido" em cima. */
function ArteModelo() {
  return (
    <svg className="social-caminho-arte" viewBox="0 0 96 76" role="img" aria-hidden="true">
      <rect className="arte-suave" x="10" y="14" width="56" height="48" rx="8" />
      <rect className="arte-papel arte-traco" x="20" y="8" width="56" height="50" rx="8" />
      <rect className="arte-suave" x="28" y="18" width="30" height="5" rx="2.5" />
      <rect className="arte-suave" x="28" y="29" width="40" height="5" rx="2.5" />
      <rect className="arte-suave" x="28" y="40" width="22" height="5" rx="2.5" />
      <circle className="arte-ouro" cx="72" cy="54" r="13" />
      <path
        className="arte-marca"
        d="M66.5 54.3l3.6 3.6 7-7.4"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Do zero: o quadro em branco, com o primeiro bloco esperando pra nascer. */
function ArteDoZero() {
  return (
    <svg className="social-caminho-arte" viewBox="0 0 96 76" role="img" aria-hidden="true">
      <rect className="arte-papel arte-traco" x="8" y="22" width="34" height="30" rx="8" />
      <rect className="arte-suave" x="16" y="32" width="18" height="4.5" rx="2.25" />
      <rect className="arte-suave" x="16" y="41" width="12" height="4.5" rx="2.25" />
      <path className="arte-fio" d="M42 37h12" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <rect
        className="arte-tracejado"
        x="54"
        y="22"
        width="34"
        height="30"
        rx="8"
        fill="none"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <path
        className="arte-fio"
        d="M71 30v14M64 37h14"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** IA: a frase escrita virando robô. Apagada de propósito — o caminho ainda não existe. */
function ArteIA() {
  return (
    <svg className="social-caminho-arte" viewBox="0 0 96 76" role="img" aria-hidden="true">
      <path
        className="arte-papel arte-traco"
        d="M16 14h50a8 8 0 018 8v22a8 8 0 01-8 8H38l-12 10V52h-10a8 8 0 01-8-8V22a8 8 0 018-8z"
      />
      <rect className="arte-suave" x="24" y="26" width="34" height="5" rx="2.5" />
      <rect className="arte-suave" x="24" y="37" width="22" height="5" rx="2.5" />
      <path
        className="arte-ouro"
        d="M74 8l2.6 6.4L83 17l-6.4 2.6L74 26l-2.6-6.4L65 17l6.4-2.6z"
      />
      <path className="arte-ouro" d="M84 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
    </svg>
  );
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

      <div className="content content-novo-robo">
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
              <ArteModelo />
              <strong>{traduzir("Começar com um modelo")}</strong>
              <span>{traduzir("Um robô inteiro já montado, feito só de gatilhos e blocos que existem no Instagram. Você troca o texto e publica.")}</span>
            </button>

            <button type="button" className="social-caminho" onClick={doZero}>
              <ArteDoZero />
              <strong>{traduzir("Criar do zero")}</strong>
              <span>{traduzir("Canvas em branco. Você escolhe o gatilho e monta bloco a bloco, no seu ritmo.")}</span>
            </button>

            <div className="social-caminho desativado" aria-disabled="true">
              <span className="social-caminho-selo em-breve">{traduzir("Em breve")}</span>
              <ArteIA />
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
