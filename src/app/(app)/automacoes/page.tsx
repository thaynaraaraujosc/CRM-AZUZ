"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { useFunis } from "@/lib/funis-context";

/**
 * Automações: a grade por etapa do funil, e só ela.
 *
 * Esta página era uma biblioteca de robôs (lista com busca, filtros, arquivar, duplicar) que
 * convivia com a grade do funil. Eram dois lugares pra pensar a mesma coisa, e a pergunta de quem
 * abriu a tela foi exatamente essa: "por que tem dois?". A automação passa a ser configurada num
 * lugar só: a etapa.
 *
 * O que a lista fazia e não se perdeu: criar (pelo "+ Nova automação" e pelo "+ Adicionar gatilho"
 * de cada etapa), abrir, renomear (o nome fica no painel do próprio robô) e ver execuções. O que
 * saiu junto: busca, filtros por gatilho/canal, arquivar e os modelos de demonstração. Se algum
 * fizer falta, ele volta pra dentro desta tela, não pra uma segunda.
 */
function AutomacoesConteudo() {
  const params = useSearchParams();
  const { funis } = useFunis();

  const [funilEscolhido, setFunilEscolhido] = useState("");

  const funilParam = params.get("funil");

  // Por derivação, não por efeito: um seletor que abre vazio obriga a um clique que não decide
  // nada quando só existe um funil, que é o caso comum.
  const funil = funis.find((f) => f.id === (funilEscolhido || funilParam || funis[0]?.id));

  return (
    <>
      <Topbar
        title="Automações"
        sub="O que cada etapa do funil faz sozinha quando um lead entra"
        actions={
          <>
            {/* "Execuções" fica ao lado de "Nova automação" de propósito: é a resposta pra pergunta
                que vem logo depois de criar um robô, que é "ele rodou?". Antes essa tela só existia
                pro Instagram, e no funil não havia onde olhar. */}
            <Link className="btn" href="/automacoes/execucoes">
              Execuções
            </Link>
            {/* Vai pra tela de três caminhos, não direto pro assistente: o modelo AZUZ pronto é
                o caminho com mais chance de dar certo pra quem nunca montou um robô, e ele não
                cabe num diálogo pequeno. Montar do zero continua a um clique de distância, lá
                dentro, com o mesmo assistente de sempre. */}
            <Link className="btn primary" href="/automacoes/novo">
              + Nova automação
            </Link>
          </>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        {/*
          Classe própria em vez de `.field`: `.field` carrega uma linha embaixo, que existe pra
          separar um campo do SEGUINTE dentro de um painel. Aqui não há campo seguinte, e a linha
          ficava solta, atravessando a tela sem separar nada.
        */}
        <div className="fauto-escolher-funil">
          <label htmlFor="funil-a-automatizar">Qual funil você quer automatizar</label>
          <select
            id="funil-a-automatizar"
            className="input"
            value={funil?.id ?? ""}
            onChange={(e) => setFunilEscolhido(e.target.value)}
          >
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {funil ? (
          <AutomacaoDoFunil
            funilId={funil.id}
            funilNome={funil.nome}
            colunas={funil.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
          />
        ) : (
          <section className="card">
            <p className="hint">
              Nenhum funil criado ainda. Crie um em Funil pra automatizar as etapas.
            </p>
          </section>
        )}
      </div>

    </>
  );
}

export default function AutomacoesPage() {
  // `useSearchParams` precisa de um limite de Suspense: sem ele a página inteira vira dinâmica e
  // o build reclama.
  return (
    <Suspense fallback={null}>
      <AutomacoesConteudo />
    </Suspense>
  );
}
