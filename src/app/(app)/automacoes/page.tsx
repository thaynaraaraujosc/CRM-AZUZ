"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { useFunis } from "@/lib/funis-context";
import { useIdioma } from "@/lib/idioma-context";

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
  const { t: traduzir } = useIdioma();
  const params = useSearchParams();
  const { funis } = useFunis();

  /*
   * QUAL FUNIL, pela URL e só por ela.
   *
   * O seletor saiu desta página e foi pra barra de cima (`BarraDeAutomacoes`), que é componente
   * irmão: os dois não compartilham estado, mas leem o mesmo endereço. De quebra, o link de uma
   * tela aberta num funil passa a abrir nele pra quem receber.
   */
  const funilParam = params.get("funil");
  const funil = funis.find((f) => f.id === (funilParam || funis[0]?.id));

  return (
    <>
      <AcoesNoTopo>
        {/* "Execuções" fica ao lado de "Nova automação" de propósito: é a resposta pra pergunta
            que vem logo depois de criar um robô, que é "ele rodou?". Antes essa tela só existia
            pro Instagram, e no funil não havia onde olhar. */}
        <Link className="btn" href="/automacoes/execucoes">
          {traduzir("Execuções")}
        </Link>
        {/* Vai pra tela de três caminhos, não direto pro assistente: o modelo AZUZ pronto é o
            caminho com mais chance de dar certo pra quem nunca montou um robô, e ele não cabe num
            diálogo pequeno. Montar do zero continua a um clique de distância, lá dentro. */}
        <Link className="btn primary" href="/automacoes/novo">
          {traduzir("+ Nova automação")}
        </Link>
      </AcoesNoTopo>

      {/*
        `content-grade`: sem respiro em volta e sem rolagem própria, porque o que vem dentro é uma
        grade que rola sozinha e tem que ir até a borda. Com o `.content` normal, a grade ficava
        numa janelinha no meio da tela, que foi exatamente a reclamação.
      */}
      <div className="content content-grade">
        {funil ? (
          <AutomacaoDoFunil
            funilId={funil.id}
            colunas={funil.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
            semMoldura
          />
        ) : (
          <section className="card">
            <p className="hint">
              {traduzir("Nenhum funil criado ainda. Crie um em Funil pra automatizar as etapas.")}
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
