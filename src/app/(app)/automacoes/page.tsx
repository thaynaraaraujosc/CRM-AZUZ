"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { EstadoVazio } from "@/components/estado-vazio";
import { IconPipeline } from "@/components/icons";
import { useFunis } from "@/lib/funis-context";
import { slugId } from "@/lib/ids";
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
  const { funis, criarEtapaPersistida, reordenarEtapas, salvarAparenciaDaEtapa } = useFunis();

  /*
   * QUAL FUNIL, pela URL e só por ela.
   *
   * O seletor saiu desta página e foi pra barra de cima (`BarraDeAutomacoes`), que é componente
   * irmão: os dois não compartilham estado, mas leem o mesmo endereço. De quebra, o link de uma
   * tela aberta num funil passa a abrir nele pra quem receber.
   */
  const funilParam = params.get("funil");
  const funil = funis.find((f) => f.id === (funilParam || funis[0]?.id));

  /**
   * Cria uma etapa na posição clicada, direto da grade.
   *
   * O nome vem de um `prompt` do navegador, e isso é uma escolha: a alternativa é um diálogo
   * próprio, e ele custaria um estado, um foco e um fechar-com-Esc pra uma pergunta de uma linha
   * que acontece uma vez por mês. Quando a etapa passar a ter cor e dicas — que é o que falta pra
   * igualar a referência — a caixa própria passa a valer a pena, e entra junto com elas.
   */
  async function inserirEtapa(funilId: string, posicao: number) {
    const titulo = window.prompt(traduzir("Nome da etapa nova"))?.trim();
    if (!titulo) return;
    await criarEtapaPersistida(funilId, { id: slugId(titulo), titulo }, posicao);
  }

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
            colunas={funil.colunas.map((c) => ({
              id: c.id,
              titulo: c.titulo,
              total: c.total,
              cor: c.cor,
              dicas: c.dicas,
            }))}
            semMoldura
            aoInserirEtapa={(posicao) => void inserirEtapa(funil.id, posicao)}
            aoReordenarEtapas={(ids) => void reordenarEtapas(funil.id, ids)}
            aoMudarAparencia={(etapaId, mudanca) =>
              void salvarAparenciaDaEtapa(funil.id, etapaId, mudanca)
            }
          />
        ) : (
          /*
            CONTA NOVA NÃO TEM FUNIL, e esta é a primeira tela que o cliente abre em Automações.
            Era uma faixa branca colada no topo com uma frase cinza dentro — a tela parecia ter
            quebrado. Agora o vazio diz o que falta e oferece o caminho, num clique.
          */
          <EstadoVazio
            icone={<IconPipeline />}
            titulo={traduzir("Nenhum funil criado ainda")}
            descricao={traduzir(
              "A automação acontece nas etapas do funil: cada etapa pode disparar mensagem, tarefa ou etiqueta. Crie o primeiro funil pra começar.",
            )}
            acao={
              <Link className="btn primary" href="/funil">
                {traduzir("Criar funil")}
              </Link>
            }
          />
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
