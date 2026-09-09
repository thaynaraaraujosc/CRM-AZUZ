"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { MODELOS_SOCIAIS } from "@/lib/social/modelos-rapidos";
import { IconAutomacoes, IconDoc, IconSparkle } from "@/components/icons";

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
export default function NovaAutomacaoSocialPage() {
  const router = useRouter();
  const { criarFluxo } = useAutomationFlows();
  const [escolhendoModelo, setEscolhendoModelo] = useState(false);

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
      <Topbar title="Criar automação" sub="Instagram e TikTok" />
      <AbasAutomacoes />

      <div className="content">
        <nav className="social-migalhas" aria-label="Onde você está">
          <button type="button" className="link" onClick={() => router.push("/automacoes/social")}>
            Automações
          </button>
          <span aria-hidden="true">›</span>
          <strong>Nova automação</strong>
        </nav>

        {!escolhendoModelo ? (
          <div className="social-caminhos">
            <button type="button" className="social-caminho destaque" onClick={() => setEscolhendoModelo(true)}>
              <span className="social-caminho-selo">Mais rápido</span>
              <IconDoc width={26} height={26} aria-hidden="true" />
              <strong>Começar com um modelo</strong>
              <span>
                Um robô inteiro já montado, feito só de gatilhos e blocos que existem no Instagram.
                Você troca o texto e publica.
              </span>
            </button>

            <button type="button" className="social-caminho" onClick={doZero}>
              <IconAutomacoes width={26} height={26} aria-hidden="true" />
              <strong>Criar do zero</strong>
              <span>Canvas em branco. Você escolhe o gatilho e monta bloco a bloco, no seu ritmo.</span>
            </button>

            <div className="social-caminho desativado" aria-disabled="true">
              <span className="social-caminho-selo em-breve">Em breve</span>
              <IconSparkle width={26} height={26} aria-hidden="true" />
              <strong>Descrever pra IA montar</strong>
              <span>
                Escrever o que você quer e receber a automação pronta. Ainda não está de pé, e por
                isso está desligado em vez de aberto e sem nada atrás.
              </span>
            </div>
          </div>
        ) : (
          <section className="card">
            <div className="social-secao-topo">
              <h3>Escolha o modelo</h3>
              <button type="button" className="btn ghost" onClick={() => setEscolhendoModelo(false)}>
                Voltar
              </button>
            </div>
            <p className="hint">
              Todos nascem como rascunho. Leia, troque o texto e publique quando estiver do seu jeito.
            </p>
            <div className="social-modelos">
              {MODELOS_SOCIAIS.map((m) => (
                <button key={m.id} type="button" className="social-modelo" onClick={() => doModelo(m.id)}>
                  <strong>{m.nome}</strong>
                  <span>{m.descricao}</span>
                  <em>{m.ajustar}</em>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
