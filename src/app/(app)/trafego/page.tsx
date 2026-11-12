"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ORIGENS, type Campanha, type Origem } from "@/lib/data";
import { IconClose } from "@/components/icons";
import { useContatos } from "@/lib/contatos-context";
import { ORIGENS_PAGAS } from "@/lib/contatos/origem-do-lead";
import { situacaoDaCampanha } from "@/lib/integracoes/conta-de-anuncios";
import { formatarEspera, tomDaEspera } from "@/lib/trafego/tempo-de-resposta";
import { useFunis } from "@/lib/funis-context";
import { useIntegracaoMeta } from "@/components/configuracoes/useIntegracaoMeta";
import { useGoogleAds } from "@/components/trafego/useGoogleAds";
import { SeletorDeContaDeAnuncios } from "@/components/trafego/SeletorDeContaDeAnuncios";
import { acharNoCrm, normalizarNome, usePorCampanha } from "@/components/trafego/usePorCampanha";
import { Ajuda, FilterBar, KpiCard, PERIODO_PADRAO, type PeriodoValor } from "@/components/ui";
import { ChartCard, FunnelSteps } from "@/components/charts";
import { useIdioma } from "@/lib/idioma-context";
import {
  calcularInvestimentoTrafego,
  calcularLeadsTrafego,
  calcularRoasMedio,
  calcularValorVendido,
  formatarMoeda,
  funilDeTrafego,
  negociosDasOrigens,
  parseSubCampanha,
} from "@/lib/metrics";

type ColunaOrdenavel = "nome" | "investido" | "leads" | "vendas" | "cpl" | "roas";

/** O que a rota do Meta conta sobre a conta de anúncios. Ver o diagnóstico em `route.ts`. */
type DiagnosticoDeCampanhas = {
  conta?: string;
  naConta?: number;
  descartadasPausadasSemGasto?: number;
  nomesDescartados?: string[];
  linhasDeGasto?: number;
};

type RespostaDeCampanhas = {
  campanhas?: Campanha[];
  diagnostico?: DiagnosticoDeCampanhas;
  erro?: string;
};

/*
 * `ORIGENS_PAGAS` vem de `contatos/origem-do-lead.ts`, junto das opções que a ficha do contato
 * oferece — de propósito. Marcar "Meta Ads" na ficha e ver o lead aparecer aqui tem que ser a
 * MESMA decisão: duas listas em dois arquivos combinariam por acaso, e divergiriam no primeiro
 * dia em que alguém acrescentasse uma plataforma só de um lado.
 */

/** A origem que corresponde à letra de plataforma guardada no filtro. */
function origemDaPlataforma(letra: string): string | null {
  if (letra === "M") return "Meta Ads";
  if (letra === "G") return "Google Ads";
  return null;
}

/**
 * Visão completa da aquisição: do investimento até a receita. Campos que o
 * modelo de dados atual não liga de verdade (ex.: venda por campanha
 * específica, Google Ads sem integração própria) mostram "Dados não
 * conectados" em vez de número inventado. Inclusive a lista de campanhas
 * fica vazia até o Meta Ads ser conectado (antes mostrava mock inteiro).
 */
/**
 * O nome da plataforma de uma campanha.
 *
 * Antes era `plataforma === "M" ? "Meta Ads" : "Google Ads"`, o que rotulava como Google Ads
 * qualquer coisa que nao fosse Meta, inclusive o que o CRM nao sabe identificar. Agora o Google
 * tem integracao propria, entao "G" quer dizer Google Ads DE VERDADE; o que nao for nenhum dos
 * dois continua sendo "Outra", porque afirmar uma origem que o CRM nao sabe e o defeito original.
 */
function rotuloPlataforma(plataforma: string): string {
  if (plataforma === "M") return "Meta Ads";
  if (plataforma === "G") return "Google Ads";
  return "Outra";
}

/** O nome que a barra de filtro mostra pra letra guardada no estado. */
function rotuloDoFiltro(valor: string): string {
  if (valor === "M") return "Meta Ads";
  if (valor === "G") return "Google Ads";
  return "Todas";
}

export default function TrafegoPage() {
  const { t: traduzir } = useIdioma();
  const { funis } = useFunis();
  const { contatos } = useContatos();
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [plataformaFiltro, setPlataformaFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<ColunaOrdenavel>("investido");
  const [ordemDesc, setOrdemDesc] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [campanhaAberta, setCampanhaAberta] = useState<string | null>(null);

  const {
    integracao: adsIntegracao,
    desconectando: adsDesconectando,
    desconectar: desconectarAds,
    recarregar: recarregarAds,
  } = useIntegracaoMeta("meta_ads");
  const [campanhasReais, setCampanhasReais] = useState<Campanha[] | null>(null);
  /*
   * O QUE A META RESPONDEU, quando ela não respondeu campanhas.
   *
   * "O meu Meta já está conectado, eu já estou rodando campanha, mas não estou vendo nada aqui.
   * 'Conecte o Meta Ads ou o Google para ver' — mas eu já conectei."
   *
   * Ela estava certa, e o defeito é de DIAGNÓSTICO: três situações diferentes caíam na mesma
   * frase, e a frase acusava a única que não era o caso.
   *
   *   1. Não conectado          → "Conecte o Meta Ads"  (certo)
   *   2. Conectado, consulta FALHOU (token vencido, permissão `ads_read` ausente, conta de
   *      anúncios errada) → dizia "Conecte o Meta Ads" (errado, e sem saída: reconectar não
   *      conserta permissão faltando, e a mensagem da Meta, que diz o que fazer, era jogada fora)
   *   3. Conectado, consulta OK, zero campanhas no período → também dizia "conecte"
   *
   * A rota já devolvia o motivo (`{ erro }`, com o texto da própria Meta). A tela fazia
   * `Array.isArray(dados) ? ... : null` e descartava. Agora o motivo fica, e cada caso diz a
   * verdade dele.
   */
  const [erroDasCampanhas, setErroDasCampanhas] = useState<string | null>(null);
  /*
   * O QUE A CONTA DE ANÚNCIOS TEM, quando a lista vem vazia.
   *
   * "Tem que entender o porquê. Me explica porque tem que aparecer aqui."
   *
   * A resposta honesta não é uma frase só: lista vazia tem três causas, e cada uma pede uma coisa
   * diferente de quem está olhando. A rota agora conta o que viu (quantas campanhas a conta
   * devolveu, quantas foram descartadas e por quê), e a tela repete isso em português.
   */
  const [diagnostico, setDiagnostico] = useState<DiagnosticoDeCampanhas | null>(null);

  // Ajusta durante a renderização (não num efeito) quando o status muda pra "não conectado". Evita
  // setState síncrono dentro do corpo do efeito (regra `react-hooks/set-state-in-effect`).
  const [ultimoStatusAds, setUltimoStatusAds] = useState<string | null | undefined>(undefined);
  if (adsIntegracao?.status !== ultimoStatusAds) {
    setUltimoStatusAds(adsIntegracao?.status ?? null);
    if (adsIntegracao?.status !== "conectado") setCampanhasReais(null);
  }

  // Virou função nomeada porque agora tem dois gatilhos: a conexão ficar de pé (o efeito abaixo)
  // e a pessoa TROCAR a conta de anúncios — e trocar a conta sem recarregar deixaria a tela
  // mostrando as campanhas da conta anterior, que é a confusão que o seletor existe pra acabar.
  const recarregarCampanhas = useCallback(() => {
    fetch("/api/integracoes/meta/ads/campanhas")
      .then((r) => r.json())
      .then((dados: RespostaDeCampanhas) => {
        if (Array.isArray(dados?.campanhas)) {
          setCampanhasReais(dados.campanhas);
          setDiagnostico(dados.diagnostico ?? null);
          setErroDasCampanhas(null);
          return;
        }
        setCampanhasReais(null);
        setDiagnostico(null);
        setErroDasCampanhas(dados?.erro ?? "O Meta não explicou o motivo.");
      })
      .catch((erro: unknown) => {
        console.error("Falha ao carregar campanhas do Meta Ads:", erro);
        setErroDasCampanhas("Não deu pra falar com o Meta agora.");
      });
  }, []);

  useEffect(() => {
    if (adsIntegracao?.status !== "conectado") return;
    recarregarCampanhas();
  }, [adsIntegracao?.status, recarregarCampanhas]);

  const { statusGoogle, campanhasGoogle, desconectando: googleDesconectando, desconectar: desconectarGoogle } = useGoogleAds();
  const { linhasDoCrm, leadsSemCampanha } = usePorCampanha();

  /*
   * Os dois canais na MESMA lista, e não em duas tabelas.
   *
   * Investimento, custo por lead, custo por venda e ROAS só querem dizer alguma coisa somando o
   * que a empresa gastou em toda parte. Separar em duas tabelas obrigaria quem olha a somar de
   * cabeça pra saber quanto custou um cliente, que é a única pergunta que essa tela existe pra
   * responder. A coluna "Plataforma" e o filtro é que separam, quando alguém quiser separar.
   *
   * Só entra campanha de verdade: sem nenhuma conexão a lista fica vazia (não mais um mock).
   */
  const campanhas = useMemo(() => {
    const daPlataforma = [...(campanhasReais ?? []), ...campanhasGoogle];

    /*
     * Campanha que o CRM conhece e a plataforma não devolveu.
     *
     * Sem isto a tabela inteira dependia de haver uma conexão de anúncio ativa: um cliente que usa
     * o link de rastreamento mas nunca conectou o Google Ads via a lista vazia, mesmo tendo dezenas
     * de leads com campanha identificada guardados no banco. O dado existia e ninguém mostrava.
     *
     * Entram sem investimento, porque investimento só a plataforma sabe. Leads, vendas e receita
     * são reais; o que falta fica em branco em vez de virar zero — zero afirma que não se gastou
     * nada, e não é isso que se sabe.
     */
    const jaNaPlataforma = new Set(
      daPlataforma.map((c) => `${c.plataforma === "M" ? "meta" : "google"}|${normalizarNome(c.nome)}`),
    );
    const soDoCrm: Campanha[] = linhasDoCrm
      .filter((l) => !jaNaPlataforma.has(`${l.plataforma}|${normalizarNome(l.campanhaNome)}`))
      .map((l) => ({
        plataforma: l.plataforma === "meta" ? "M" : "G",
        nome: l.campanhaNome,
        sub: `${l.leads} leads · R$ 0`,
        roas: "—",
        barra: 0,
        vendas: l.vendas,
        semPlataforma: true,
      }));

    return [...daPlataforma, ...soDoCrm];
  }, [campanhasReais, campanhasGoogle, linhasDoCrm]);

  // O filtro por Google Ads só existe quando o canal existe. Opção que devolve vazio SEMPRE faz
  // quem escolhe concluir que não houve investimento, e não que o canal não está ligado.
  const mostrarGoogle = statusGoogle.disponivel;

  const campanhasFiltradas = useMemo(
    () =>
      campanhas.filter((c) => {
        if (plataformaFiltro !== "Todas" && c.plataforma !== plataformaFiltro) return false;
        if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      }),
    [campanhas, plataformaFiltro, busca],
  );

  const linhasCampanha = useMemo(() => {
    const linhas = campanhasFiltradas.map((c) => {
      const { leads, investido } = parseSubCampanha(c.sub);
      const roasNum = Number(c.roas.replace(",", ".").replace("x", "")) || 0;
      const cpl = leads > 0 ? investido / leads : 0;
      /*
       * O mesmo par de colunas, contado duas vezes por fontes diferentes.
       *
       * A plataforma conta o que acontece dentro dela: clique, conversa iniciada, formulário
       * nativo. O CRM conta o que aconteceu depois: o lead virou contato, andou no funil, fechou.
       * Os dois números quase nunca batem, e a diferença é exatamente a informação que falta pra
       * decidir onde investir — plataforma dizendo 40 leads e CRM tendo 12 não é erro de conta, é
       * o custo real de aquisição aparecendo.
       *
       * Por isso nenhum dos dois substitui o outro na tabela: ficam lado a lado.
       */
      const crm = acharNoCrm(linhasDoCrm, c);
      // Linha que só o CRM conhece: a plataforma não foi consultada (ou não devolveu esta
      // campanha), então investimento, CPL e ROAS são DESCONHECIDOS, não zero. A diferença
      // importa: zero afirma que não se gastou nada, e afirmar isso sobre a campanha de alguém é
      // pior do que não dizer nada.
      const semPlataforma = (c as Campanha & { semPlataforma?: boolean }).semPlataforma === true;
      const receitaCrm = crm?.receita ?? 0;
      const leadsCrm = crm?.leads ?? 0;
      // A espera vem do CRM, não da plataforma: só o CRM sabe quando alguém respondeu.
      const esperaMediana = crm?.esperaMediana ?? null;
      const semResposta = crm?.semResposta ?? 0;
      return {
        ...c,
        leads,
        investido,
        cpl,
        roasNum,
        vendas: c.vendas ?? 0,
        leadsCrm,
        vendasCrm: crm?.vendas ?? 0,
        receitaCrm,
        assistidas: crm?.vendasAssistidas ?? 0,
        // ROAS de verdade: receita que o FUNIL registrou dividida pelo que a PLATAFORMA cobrou.
        // Só a plataforma sabe o gasto e só o CRM sabe a venda; é o cruzamento que produz o número.
        roasCrm: investido > 0 ? receitaCrm / investido : 0,
        cplCrm: leadsCrm > 0 ? investido / leadsCrm : 0,
        esperaMediana,
        semResposta,
        semPlataforma,
      };
    });
    const chave = (l: (typeof linhas)[number]) =>
      ordenarPor === "nome" ? l.nome : ordenarPor === "roas" ? l.roasNum : l[ordenarPor];
    linhas.sort((a, b) => {
      const av = chave(a);
      const bv = chave(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return ordemDesc ? -cmp : cmp;
    });
    return linhas;
  }, [campanhasFiltradas, ordenarPor, ordemDesc, linhasDoCrm]);

  function alternarOrdenacao(col: ColunaOrdenavel) {
    if (ordenarPor === col) setOrdemDesc((v) => !v);
    else {
      setOrdenarPor(col);
      setOrdemDesc(true);
    }
  }

  function alternarSelecao(nome: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  /*
   * ==========================================================================
   * O FUNIL DE TRÁFEGO: ELE NÃO ERA DE TRÁFEGO.
   *
   * "Qual que é a lógica desse funil de tráfego? Por exemplo, o novo, dois novos. Aonde foi esses
   * dois novos? Da onde que ele está pegando essas informações? Esse funil de tráfego é de um
   * WhatsApp ou de dois WhatsApp?"
   *
   * Pergunta certa, e a resposta era ruim. Estava assim:
   *
   *     const funilPrincipal = funis[0];
   *     ...(funilPrincipal?.colunas ?? []).map((coluna) => ({ quantidade: coluna.cards.length }))
   *
   * Ou seja: o PRIMEIRO funil da conta, com a contagem CRUA de cards de cada etapa. Nada de
   * tráfego nisso. "Novo: 2" queria dizer "o primeiro funil tem 2 cards na primeira etapa" — os
   * mesmos 2 que aparecem no Funil —, viessem eles de anúncio, de indicação, de alguém que mandou
   * mensagem sozinho ou de um card criado à mão. E o valor na última etapa era a receita de TODOS
   * os negócios ganhos da conta, não a dos que vieram de anúncio.
   *
   * Numa tela cujo trabalho é dizer quanto custa um cliente, isso é pior que não mostrar: todo
   * lead orgânico entrava no numerador e empurrava o custo por lead pra baixo.
   *
   * O QUE CONTA AGORA: negócio cuja ORIGEM é anúncio pago (Meta Ads, Google Ads, TikTok — ver
   * `ORIGENS_PAGAS`), em TODOS os funis da conta, não só no primeiro. O filtro de plataforma lá de
   * cima vale aqui também: escolhendo Meta Ads, o funil passa a contar só o que veio do Meta.
   *
   * SOBRE "É DE UM WHATSAPP OU DE DOIS": era de UM, e esse era metade do problema. Todo funil é
   * de um número (`Funil.contaCanal`, escolhido na criação e fixo), e a tela pegava `funis[0]` —
   * o funil do primeiro número, apresentado como se fosse o tráfego da empresa. Quem tem dois
   * números via metade da operação sem nada dizendo isso. Agora soma os dois, que é a leitura
   * certa aqui: anúncio não é comprado por número de WhatsApp.
   *
   * ETAPAS COM O MESMO NOME SOMAM NA MESMA BARRA. Dois funis com "Novo" viram um "Novo" só: a
   * pergunta aqui é em que altura do processo estão os leads pagos, e não em qual quadro.
   * ==========================================================================
   */
  const origemFiltrada = origemDaPlataforma(plataformaFiltro);
  const origensQueContam: readonly string[] = origemFiltrada ? [origemFiltrada] : ORIGENS_PAGAS;

  // A regra mora em `metrics.ts`, com teste (`__tests__/funil-de-trafego.test.ts`): a tela só
  // escolhe as origens e desenha. `origensQueContam` deriva de `plataformaFiltro`, então é dele
  // que a memória depende — do array, ela se refaria a cada render.
  const cardsPagos = useMemo(
    () => negociosDasOrigens(funis, origensQueContam),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funis, plataformaFiltro],
  );

  const receitaPaga = calcularValorVendido(cardsPagos);
  const totalPagos = cardsPagos.length;

  const investido = calcularInvestimentoTrafego(campanhasFiltradas);
  const leads = calcularLeadsTrafego(campanhasFiltradas);
  const roas = calcularRoasMedio(campanhasFiltradas);
  const custoPorLead = leads.valor > 0 ? investido.valor / leads.valor : 0;
  /*
   * VENDAS AQUI É VENDA QUE VEIO DE ANÚNCIO, pelo mesmo motivo do funil logo acima.
   *
   * Era `todosOsCards(funis).filter(ganho)`: TODA venda da conta, orgânica inclusive. E logo
   * abaixo `custoPorVenda = investido / vendas` — gasto de mídia dividido por vendas que em parte
   * não custaram mídia. O número saía otimista, e otimista por construção: quanto mais a empresa
   * vendesse por indicação, mais barato o anúncio parecia.
   */
  const vendas = cardsPagos.filter((c) => c.statusFechamento === "ganho").length;
  const custoPorVenda = vendas > 0 ? investido.valor / vendas : 0;

  const funilSteps = useMemo(() => {
    const etapas = funilDeTrafego(funis, origensQueContam);
    return etapas.map((etapa, i) => ({
      ...etapa,
      // O valor fica na última etapa, e é a receita dos negócios PAGOS ganhos — não a da conta
      // inteira, que era o que estava escrito ali.
      valorLabel: i === etapas.length - 1 ? receitaPaga.label : undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funis, plataformaFiltro, receitaPaga.label]);

  const origensComDados = ORIGENS.map((origem: Origem) => {
    const leadsOrigem = contatos.filter((c) => c.origem === origem).length;
    const vendasOrigem = negociosDasOrigens(funis, [origem]).filter(
      (card) => card.statusFechamento === "ganho",
    ).length;
    /*
     * Investimento só existe pra origem que tem campanha ligada. "Google Ads" fica em `null`
     * (traço na tela) enquanto o canal não estiver conectado: zero ali diria "anunciou e não
     * gastou", que é afirmação, e não ausência de dado.
     */
    const plataformaDaOrigem = origem === "Meta Ads" ? "M" : origem === "Google Ads" ? "G" : null;
    /*
     * "Origens, Meta Ads, investimento. Por que que não está aparecendo nos investimentos lá do
     * Meta Ads?"
     *
     * Estava aparecendo — como R$ 0,00, que é pior. Duas coisas erradas aqui:
     *
     * 1. `temConexao` para o Meta era `plataformaDaOrigem === "M"`, constante verdadeira: dizia
     *    "o Meta está conectado" sem nunca olhar a conexão. Agora olha, como já olhava a do
     *    Google.
     * 2. Com a conexão de pé e nenhuma campanha devolvida, a soma de uma lista vazia dá 0, e a
     *    célula escrevia R$ 0,00. Zero é uma AFIRMAÇÃO — "anunciou e não gastou nada" — e escrevê-la
     *    sobre a conta de alguém que está rodando campanha é exatamente o defeito que ela
     *    encontrou. Sem campanha pra somar, a célula fica em traço: não se sabe.
     */
    const conexaoDaOrigem =
      plataformaDaOrigem === "M"
        ? adsIntegracao?.status === "conectado"
        : plataformaDaOrigem === "G"
          ? statusGoogle.status === "conectado"
          : false;
    const campanhasDaOrigem = plataformaDaOrigem
      ? campanhas.filter((c) => c.plataforma === plataformaDaOrigem)
      : [];
    const investimentoOrigem =
      plataformaDaOrigem && conexaoDaOrigem && campanhasDaOrigem.length > 0
        ? campanhasDaOrigem.reduce((s, c) => s + parseSubCampanha(c.sub).investido, 0)
        : null;
    return { origem, leadsOrigem, vendasOrigem, investimentoOrigem };
  });

  const campanhaDetalhe = campanhaAberta ? campanhas.find((c) => c.nome === campanhaAberta) : null;

  return (
    <>
      {/*
        SEM O TÍTULO E SEM A FRASE.

        "Retire esse nome duplicado, Tráfego. E aí embaixo tem 'da aquisição de leads até a
        receita'. Pode tirar essa frase também."

        O nome já está aceso no menu ao lado, em azul, com o ícone. Repetir "Tráfego" em letra
        grande logo abaixo gasta a primeira linha da tela pra dizer o que a pessoa acabou de
        clicar. E a frase era descrição de catálogo, não informação de trabalho: não muda nunca e
        não ajuda a decidir nada.
      */}
      <div className="topbar topbar-so-acoes">
        {/*
          OS FILTROS SUBIRAM PRA FAIXA, E VIRARAM UMA LINHA SÓ.

          "Aqueles botões que tem ali em cima, período, plataforma, mais filtro, exportar, olha
          como não tem margem, olha como esses botões são feios, deixa esses botões em uma linha
          só. Ou se não, coloca lá em cima."

          Eram quatro controles numa tira solta logo abaixo da faixa, sem respiro em cima e
          encostando na borda esquerda do conteúdo. Na faixa eles ganham a margem que a faixa já
          tem (`--space-4` por `--space-6`) e ficam na mesma linha das conexões, à direita — uma
          linha de comando pra tela inteira em vez de duas tiras empilhadas.

          E "Mais filtros" SAIU: o único filtro dentro dele era Plataforma, que já é o botão ao
          lado. Era um botão que abria um painel pra oferecer o que estava visível. "O de filtro,
          coloca uma coisa só."
        */}
        <div className="trafego-filtros">
          <FilterBar
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            principalLabel="Plataforma"
            principalValor={rotuloDoFiltro(plataformaFiltro)}
            principalOpcoes={mostrarGoogle ? ["Todas", "Meta Ads", "Google Ads"] : ["Todas", "Meta Ads"]}
            onPrincipalChange={(v) => setPlataformaFiltro(v === "Meta Ads" ? "M" : v === "Google Ads" ? "G" : "Todas")}
            onLimpar={() => {
              setPeriodo(PERIODO_PADRAO);
              setPlataformaFiltro("Todas");
            }}
            onExportar={() => window.print()}
            viewKey="trafego"
          />
        </div>
        <div className="top-actions">
          {/* A CONEXÃO NUMA PÍLULA SÓ, por plataforma: o ponto diz o estado e o botão faz a
              ação. Eram duas peças soltas por plataforma — uma frase "Meta Ads conectado:
              fulano" e um botão "Desconectar Meta Ads" —, quatro elementos pra dizer duas
              coisas, e a frase repetia a palavra que já estava no botão. */}
          {adsIntegracao?.status === "conectado" ? (
            <span className="conexao-pill">
              <span className="conexao-ponto on" aria-hidden="true" />
              Meta Ads
              {/*
                QUAL CONTA DE ANÚNCIOS, e o jeito de trocar — na própria pílula.

                "E se essa campanha tiver errada? Eu tô achando que essa conta não é essa conta.
                Como que eu faço pra mudar?"

                Não fazia: o CRM escolhia a conta sozinho no fim do OAuth e nunca mais perguntava.
                A dúvida nasce olhando esta tela vazia, então a saída fica aqui, e não escondida em
                Configurações.
              */}
              <SeletorDeContaDeAnuncios
                contaAtualId={
                  typeof adsIntegracao?.metadados?.adAccountId === "string"
                    ? adsIntegracao.metadados.adAccountId
                    : undefined
                }
                contaAtualNome={
                  typeof adsIntegracao?.metadados?.adAccountNome === "string"
                    ? adsIntegracao.metadados.adAccountNome
                    : undefined
                }
                onTrocada={() => {
                  recarregarAds();
                  recarregarCampanhas();
                }}
              />
              <button type="button" className="conexao-acao" onClick={() => void desconectarAds()} disabled={adsDesconectando}>
                {adsDesconectando ? traduzir("Desconectando…") : traduzir("Desconectar")}
              </button>
            </span>
          ) : (
            <a className="btn ghost" href="/api/integracoes/meta/conectar?provedor=meta_ads">
              {traduzir("Conectar Meta Ads")}
            </a>
          )}
          {mostrarGoogle ? (
            statusGoogle.status === "conectado" ? (
              <span className="conexao-pill">
                <span className="conexao-ponto on" aria-hidden="true" />
                Google Ads
                <button
                  type="button"
                  className="conexao-acao"
                  onClick={() => void desconectarGoogle()}
                  disabled={googleDesconectando}
                >
                  {googleDesconectando ? traduzir("Desconectando…") : traduzir("Desconectar")}
                </button>
              </span>
            ) : (
              <a className="btn ghost" href="/api/integracoes/google-ads/conectar">
                {traduzir("Conectar Google Ads")}
              </a>
            )
          ) : null}
          {/* "Não precisa desse botão gerar relatório de tráfego, porque a gente já tem a aba de
              relatório, não faz sentido." Dois caminhos pra mesma tela, e um deles ocupando a
              ação principal da página. */}
        </div>
      </div>

      <div className="content trafego-view">
        {/*
          Conexão quebrada precisa DIZER que quebrou. Quando o cliente remove o acesso do CRM na
          conta Google dele, não há conserto automático: sem este aviso a tela mostraria campanha
          nenhuma, e a leitura natural seria "não investi nada".
        */}
        {mostrarGoogle && statusGoogle.status === "erro" ? (
          <div className="card mb14">
            <div className="dados-nao-conectados trafego-vazio">
              <strong>{traduzir("A conexão com o Google Ads parou de funcionar.")}</strong>
              <span>{statusGoogle.erroMensagem ?? "Conecte de novo para voltar a ler as campanhas."}</span>
            </div>
          </div>
        ) : null}
        {/*
          Sem campanha conectada, mostrar SO o aviso.
          Antes o aviso aparecia e os seis indicadores vinham logo abaixo, todos zerados. Dizia a
          mesma coisa duas vezes, e a segunda vez dizia errado: zero parece numero apurado, e quem
          olha conclui que investiu e nao teve retorno, em vez de que nada esta conectado.
        */}
        {campanhas.length === 0 ? (
          <div className="card mb14">
            <div className="dados-nao-conectados trafego-vazio">
              {erroDasCampanhas ? (
                <>
                  {/* CONECTADO, MAS A CONSULTA FALHOU. A mensagem é a da própria Meta, repassada
                      inteira: é ela que diz se o que falta é permissão, conta ou token. Resumir
                      em "deu erro" tiraria justamente a parte acionável. */}
                  <strong>{traduzir("O Meta Ads está conectado, mas não deu pra ler as campanhas.")}</strong>
                  <span>
                    {traduzir("O que o Meta respondeu:")} <b>{erroDasCampanhas}</b>
                  </span>
                  <span>
                    {traduzir(
                      "Quase sempre é uma destas três: o acesso expirou (reconecte em Configurações › Outras integrações), a permissão de leitura de anúncios não foi concedida na hora de conectar, ou a conta de anúncios que o CRM está lendo não é a que roda as campanhas — essa última dá pra conferir e trocar clicando no nome da conta, na faixa de cima.",
                    )}
                  </span>
                </>
              ) : adsIntegracao?.status === "conectado" ? (
                <>
                  {/* CONECTADO E SEM CAMPANHA NO PERÍODO. Não é falta de conexão, é falta de
                      campanha — dizer "conecte" aqui manda a pessoa refazer algo que já está
                      feito. */}
                  <strong>
                    {/*
                      O VAZIO AGORA TEM CAUSA, e cada causa tem uma saída diferente.

                      "Aqui fala que está conectado, mas o Meta não devolveu nenhuma campanha. Por
                      quê? Tem que entender o porquê."

                      A frase anterior era honesta e inútil: dizia que não veio nada e parava ali.
                      A rota passou a contar o que viu na conta, e são três situações:

                        · a conta não tem campanha nenhuma  → é quase sempre a conta errada
                        · tem campanha, toda pausada e sem gasto em 30 dias → está tudo parado
                        · tem campanha e nenhum gasto no período → nada rodou nos últimos 30 dias
                    */}
                    {diagnostico?.naConta === 0
                      ? traduzir("Essa conta de anúncios não tem nenhuma campanha.")
                      : (diagnostico?.descartadasPausadasSemGasto ?? 0) > 0
                        ? traduzir("As campanhas dessa conta estão todas pausadas e sem gasto nos últimos 30 dias.")
                        : traduzir("Conectado, mas o Meta não devolveu nenhuma campanha.")}
                  </strong>
                  {/*
                    QUAL CONTA DE ANÚNCIOS ESTÁ LIGADA — dita na tela, e não só guardada.

                    Com a consulta funcionando e voltando vazia, a causa quase certa é a conexão
                    estar apontando pra OUTRA conta de anúncios (quem administra várias tem isso o
                    tempo todo). Mostrar o id aqui transforma "não aparece nada" em "ah, é a conta
                    errada" sem precisar abrir o Gerenciador pra conferir.
                  */}
                  {typeof adsIntegracao?.metadados?.adAccountId === "string" ? (
                    <span>
                      {traduzir("Conta de anúncios ligada:")}{" "}
                      <b>{adsIntegracao.metadados.adAccountId}</b>
                    </span>
                  ) : null}
                  {/* O QUE A CONTA TEM, em número: é o que separa "conta errada" de "tudo
                      pausado", e é a informação que falta pra decidir o que fazer. */}
                  {typeof diagnostico?.naConta === "number" ? (
                    <span>
                      {traduzir("O que essa conta devolveu:")}{" "}
                      <b>
                        {diagnostico.naConta}{" "}
                        {diagnostico.naConta === 1 ? traduzir("campanha") : traduzir("campanhas")}
                      </b>
                      {(diagnostico.descartadasPausadasSemGasto ?? 0) > 0 ? (
                        <>
                          {", "}
                          {diagnostico.descartadasPausadasSemGasto}{" "}
                          {traduzir("pausada(s) e sem gasto no período")}
                          {diagnostico.nomesDescartados?.length
                            ? ` (${diagnostico.nomesDescartados.join(", ")})`
                            : ""}
                        </>
                      ) : null}
                      {". "}
                      {diagnostico.linhasDeGasto === 0
                        ? traduzir("Nenhum gasto registrado nos últimos 30 dias.")
                        : null}
                    </span>
                  ) : null}
                  <span>
                    {traduzir(
                      "O CRM busca, dessa conta, as campanhas ativas, em análise ou com problema, mais as pausadas que gastaram nos últimos 30 dias. Pausada e sem gasto fica de fora porque não há o que medir nela.",
                    )}{" "}
                    {/*
                      A SAÍDA FICA ONDE A DÚVIDA ESTÁ.

                      Este texto mandava pra "Configurações › Outras integrações › Meta Ads" —
                      e lá não havia nada pra trocar: a conta de anúncios era escolhida sozinha
                      no fim do OAuth e não tinha tela nenhuma. Era instrução pra um lugar que
                      não existia. Agora o seletor está na pílula de conexão, na faixa logo
                      acima, e é pra lá que o texto aponta.
                    */}
                    {diagnostico?.naConta === 0
                      ? traduzir(
                          "Como a conta não tem campanha nenhuma, quase certamente a conexão está lendo outra conta de anúncios — quem administra várias tem isso o tempo todo. Clique no nome da conta, ali na faixa de cima ao lado de “Meta Ads”, pra ver todas as contas que esse acesso enxerga e escolher a certa.",
                        )
                      : traduzir(
                          "Se as suas campanhas estão em outra conta de anúncios, clique no nome da conta ali na faixa de cima, ao lado de “Meta Ads”, e escolha a certa.",
                        )}
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    {mostrarGoogle
                      ? "Conecte o Meta Ads ou o Google Ads para ver esta tela com dados."
                      : traduzir("Conecte o Meta Ads para ver esta tela com dados.")}
                  </strong>
                  <span>{traduzir("Investimento, custo por lead, custo por venda e ROAS saem das suas campanhas. Sem a conexão não há o que calcular, então os números ficam de fora em vez de aparecerem zerados.")}</span>
                </>
              )}
            </div>
          </div>
        ) : (
        <div className="grid kpi6">
          <KpiCard label={traduzir("Investido")} value={investido.label} formula={investido.formula} />
          <KpiCard label={traduzir("Leads")} value={leads.label} formula={leads.formula} href="/funil" />
          {/*
            DIVISÃO POR ZERO NÃO É ZERO. É "não dá pra saber".

            Com nenhuma venda, "Custo / venda R$ 0,00" afirma que cada venda saiu de graça — e
            aparecia exatamente assim na tela dela, ao lado de "Vendas 0". É o mesmo defeito que a
            coluna de investimento em Origens tinha: o zero parece número apurado. Traço.
          */}
          <KpiCard
            label={traduzir("Custo / lead")}
            value={leads.valor > 0 ? formatarMoeda(custoPorLead) : "—"}
            formula="Investido em tráfego ÷ leads gerados, nas campanhas filtradas"
          />
          <KpiCard label={traduzir("Vendas")} value={String(vendas)} href="/performance-vendas" />
          <KpiCard
            label={traduzir("Custo / venda")}
            value={vendas > 0 ? formatarMoeda(custoPorVenda) : "—"}
            formula="Investido em tráfego ÷ vendas vindas de anúncio. Sem nenhuma venda de anúncio ainda, não há conta a fazer."
          />
          <KpiCard label={traduzir("ROAS")} value={roas.label} formula={roas.formula} />
        </div>
        )}

        <ChartCard title={traduzir("Funil de tráfego")}>
          {funilSteps.length === 0 ? (
            <p className="hint trafego-aviso">{traduzir("Crie um funil com etapas pra ver essa visão aqui.")}</p>
          ) : (
            <>
              <FunnelSteps etapas={funilSteps} />
              {/*
                A TELA DIZ O QUE ESTÁ CONTANDO.

                "Por exemplo, o novo, dois novos. Aonde foi esses dois novos? Da onde que ele está
                pegando essas informações?"

                Gráfico que não diz de onde tirou o número obriga quem olha a confiar ou a
                desconfiar, e nenhuma das duas é trabalho. Uma linha embaixo resolve: o que entra,
                de onde vem, e o que não entra.
              */}
              <p className="hint trafego-aviso">
                {totalPagos === 0 ? (
                  <>
                    {traduzir("Nenhum negócio com origem de anúncio ainda.")}{" "}
                    {traduzir(
                      "As barras contam negócios cuja origem está marcada como anúncio pago; os que vieram por indicação, formulário do site ou mensagem direta aparecem no Funil, mas não aqui.",
                    )}
                  </>
                ) : (
                  <>
                    <strong>
                      {totalPagos} {totalPagos === 1 ? traduzir("negócio") : traduzir("negócios")}
                    </strong>{" "}
                    {traduzir("com origem em")}{" "}
                    <strong>{origemFiltrada ?? traduzir("anúncio pago (Meta Ads, Google Ads, TikTok)")}</strong>
                    {traduzir(", somando todos os funis da conta. Etapas com o mesmo nome em funis diferentes somam na mesma barra, e o valor na última etapa é a receita só desses negócios.")}{" "}
                    {traduzir(
                      "Negócio que entrou por indicação, formulário ou mensagem direta não conta aqui — ele não custou mídia. E soma os seus números de WhatsApp: cada funil é de um número, e esta tela junta todos, porque anúncio não é comprado por número.",
                    )}
                  </>
                )}
              </p>
            </>
          )}
        </ChartCard>

        <div className="card mb14">
          <div className="panel-h">
            {/*
              O TEXTÃO VIROU UM "?".

              "Lá embaixo tem um texto. Esse texto pode muito bem colocar um sinal de interrogação
              e, quando passa o mouse, ele aparece. Não precisa ficar esse texto aqui."

              Eram seis linhas de explicação embaixo da tabela, lidas uma vez na vida e ocupando
              espaço todo dia. O balão de ajuda já existe no CRM (`Ajuda`, em `ui.tsx`) e é o que
              se usa em toda parte pra isso — era esta tela que estava fora do padrão.
            */}
            <h4 className="panel-h-titulo">
              {traduzir("Desempenho por campanha")}
              <Ajuda
                texto={traduzir(
                  "As colunas da esquerda são o que a plataforma de anúncio informa: ela só enxerga o que acontece dentro dela. As três da direita são o que o CRM registrou de verdade — lead que virou contato e negócio marcado como ganho no funil. O ROAS real cruza os dois: receita do seu funil dividida pelo que a plataforma cobrou. Assistida é venda em que a campanha participou sem ter trazido o lead: a pessoa viu o anúncio, não comprou, e voltou por outro caminho. Desligar uma campanha com muitas assistidas costuma derrubar junto a que estava fechando. A última coluna não fala do anúncio: é quanto tempo um lead desta campanha normalmente espera até alguém responder, contado da primeira mensagem dele até a primeira resposta de vocês. É mediana, não média, pra um lead de sexta à noite respondido na segunda não contaminar o número — e quem nunca foi respondido aparece em separado, porque ele não espera, ele desiste.",
                )}
              />
            </h4>
            <div className="filters-row" style={{ margin: 0 }}>
              <input
                className="input"
                placeholder={traduzir("Pesquisar campanha…")}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: 180 }}
              />
              {selecionadas.size > 1 ? (
                <span className="hint">{selecionadas.size} selecionadas pra comparar</span>
              ) : null}
            </div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th className="trafego-col-foto" aria-label={traduzir("Criativo")}></th>
                  <th>{traduzir("Plataforma")}</th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("nome")}>
                    Campanha {ordenarPor === "nome" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("investido")}>
                    Investimento {ordenarPor === "investido" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("leads")}>
                    Leads {ordenarPor === "leads" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("vendas")}>
                    Vendas {ordenarPor === "vendas" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("cpl")}>
                    CPL {ordenarPor === "cpl" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => alternarOrdenacao("roas")}>
                    ROAS {ordenarPor === "roas" ? (ordemDesc ? "↓" : "↑") : ""}
                  </th>
                  <th className="trafego-col-crm">{traduzir("Leads no CRM")}</th>
                  <th className="trafego-col-crm">{traduzir("Vendas no CRM")}</th>
                  <th className="trafego-col-crm">{traduzir("ROAS real")}</th>
                  {/*
                    A ÚNICA COLUNA DESTA TELA QUE NÃO FALA DO ANÚNCIO.

                    "Campanha que traz lead bom e demora 40 minutos pra ser atendida perde venda
                    por operação, não por mídia — e isso hoje fica invisível, aparecendo só como
                    'campanha ruim'."

                    Fica na ponta direita, depois do que o CRM registrou, porque é da mesma
                    natureza: é o que acontece DEPOIS que o anúncio fez a parte dele.
                  */}
                  <th className="trafego-col-crm">{traduzir("Espera p/ responder")}</th>
                </tr>
              </thead>
              <tbody>
                {linhasCampanha.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      {/*
                        "Esse desempenho por campanha. Não tá mostrando nada aqui por quê?"

                        Porque não havia campanha nenhuma pra mostrar — e a tabela dizia "nenhuma
                        campanha COM ESSES FILTROS", acusando os filtros. Quem lê vai mexer no
                        filtro, não achar nada, e concluir que a tela está quebrada. Filtro só é a
                        causa quando há campanha e o filtro a esconde; as duas situações passam a
                        dizer a sua.
                      */}
                      <p className="hint trafego-aviso">
                        {campanhas.length === 0
                          ? traduzir(
                              "Esta tabela lista uma linha por campanha. Ainda não há nenhuma: ou as plataformas de anúncio não devolveram campanha (o aviso acima diz o motivo), ou nenhum lead do CRM chegou com campanha identificada no link de rastreamento.",
                            )
                          : busca
                            ? traduzir("Nenhuma campanha com esse nome.")
                            : traduzir("Nenhuma campanha com esses filtros.")}
                      </p>
                    </td>
                  </tr>
                ) : null}
                {linhasCampanha.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selecionadas.has(c.nome)}
                        onChange={() => alternarSelecao(c.nome)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </td>
                    <td className="trafego-col-foto">
                      {/*
                        A MINIATURA DO CRIATIVO. "Se tem como colocar a miniatura ali da campanha,
                        se dá para fazer, então faz."

                        Nome de campanha é código interno — "[11/11] - [Leads] - [Formulário]" não
                        diz qual peça está rodando. A foto diz, e é o jeito de reconhecer a
                        campanha sem abrir o Gerenciador.

                        `<img>` cru e não `next/image`: a URL é de um domínio da Meta que muda e
                        expira, e o otimizador do Next exigiria cadastrar o domínio e ficaria
                        quebrando quando ele mudasse.
                      */}
                      {c.miniatura ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="trafego-foto" src={c.miniatura} alt="" loading="lazy" />
                      ) : (
                        <span className="trafego-foto trafego-foto-vazia" aria-hidden="true" />
                      )}
                    </td>
                    <td>{rotuloPlataforma(c.plataforma)}</td>
                    <td className="trafego-col-nome">
                      <button
                        type="button"
                        className="link"
                        onClick={() => setCampanhaAberta((atual) => (atual === c.nome ? null : c.nome))}
                      >
                        {c.nome}
                      </button>
                      {/* A ETIQUETA DIZ POR QUE NÃO ESTÁ ENTREGANDO, não só que não está. Ver
                          `situacaoDaCampanha`: pausada é escolha, "com problema" é conta travada. */}
                      {(() => {
                        const situacao = situacaoDaCampanha(c.situacao, c.pausada);
                        return situacao ? (
                          <span className={`trafego-situacao ${situacao.tom}`} title={traduzir(situacao.explicacao)}>
                            {traduzir(situacao.rotulo)}
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td>{c.semPlataforma ? "—" : formatarMoeda(c.investido)}</td>
                    <td>{c.semPlataforma ? "—" : c.leads}</td>
                    <td>{c.semPlataforma ? "—" : c.vendas}</td>
                    <td>{c.semPlataforma ? "—" : formatarMoeda(c.cpl)}</td>
                    <td>{c.semPlataforma ? "—" : c.roas}</td>
                    <td className="trafego-col-crm">
                      {c.leadsCrm}
                      {c.leadsCrm > 0 && !c.semPlataforma ? (
                        <span className="trafego-cpl-crm">{formatarMoeda(c.cplCrm)}/lead</span>
                      ) : null}
                    </td>
                    <td className="trafego-col-crm">
                      {c.vendasCrm}
                      {c.assistidas > 0 ? (
                        <span
                          className="trafego-cpl-crm"
                          title={traduzir("Vendas em que esta campanha participou sem ter trazido o lead")}
                        >
                          +{c.assistidas} assistida{c.assistidas === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </td>
                    <td className="trafego-col-crm">
                      {c.receitaCrm > 0 ? (
                        <>
                          {/* ROAS só existe com os dois lados: receita daqui e gasto de lá. Sem o
                              gasto, mostra só a receita — que é verdade — e omite a divisão. */}
                          {c.semPlataforma ? "—" : `${c.roasCrm.toFixed(2).replace(".", ",")}x`}
                          <span className="trafego-cpl-crm">{formatarMoeda(c.receitaCrm)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="trafego-col-crm">
                      {(() => {
                        const tom = tomDaEspera(c.esperaMediana);
                        return (
                          <>
                            <span className={tom ? `trafego-espera ${tom}` : undefined}>
                              {formatarEspera(c.esperaMediana)}
                            </span>
                            {/*
                              OS DOIS NÚMEROS ANDAM JUNTOS, SEMPRE.

                              Lead sem resposta não entra na mediana — senão um lead ignorado
                              viraria "espera infinita" e arrastaria a campanha inteira. Mas
                              escondê-lo seria pior: uma campanha com dez leads e nove ignorados
                              mostraria a espera ótima do único que alguém respondeu, e passaria
                              por bem atendida. Por isso o "sem resposta" fica colado na mediana.
                            */}
                            {c.semResposta > 0 ? (
                              <span
                                className="trafego-sem-resposta"
                                title={traduzir(
                                  "Leads desta campanha que escreveram e ainda não receberam nenhuma resposta. Eles não entram na mediana ao lado.",
                                )}
                              >
                                {c.semResposta} {traduzir("sem resposta")}
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* SÓ O QUE MUDA FICA ESCRITO. A explicação foi pro "?" lá em cima; esta linha é dado
              vivo — um número que muda toda semana e que não aparece em nenhuma outra parte da
              tela. */}
          {leadsSemCampanha > 0 ? (
            <p className="hint trafego-aviso">
              <strong>{leadsSemCampanha}</strong>{" "}
              {leadsSemCampanha === 1
                ? traduzir("lead veio de anúncio mas sem identificação de campanha")
                : traduzir("leads vieram de anúncio mas sem identificação de campanha")}
              {traduzir(", então não aparecem em nenhuma linha acima.")}
            </p>
          ) : null}
        </div>

        {campanhaDetalhe ? (
          <div className="card mb14">
            <div className="panel-h">
              <h4>{campanhaDetalhe.nome}</h4>
              <button type="button" className="link" onClick={() => setCampanhaAberta(null)}>
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </button>
            </div>
            <div className="trafego-detalhe-corpo">
              <div className="stat-row">
                <span className="sl">{traduzir("Plataforma")}</span>
                <span className="sv">{rotuloPlataforma(campanhaDetalhe.plataforma)}</span>
              </div>
              <div className="stat-row">
                <span className="sl">{traduzir("Investimento")}</span>
                <span className="sv">{formatarMoeda(parseSubCampanha(campanhaDetalhe.sub).investido)}</span>
              </div>
              <div className="stat-row">
                <span className="sl">{traduzir("Leads")}</span>
                <span className="sv">{parseSubCampanha(campanhaDetalhe.sub).leads}</span>
              </div>
              <div className="stat-row">
                <span className="sl">{traduzir("Vendas")}</span>
                <span className="sv">{campanhaDetalhe.vendas ?? 0}</span>
              </div>
              <div className="stat-row">
                <span className="sl">{traduzir("ROAS")}</span>
                <span className="sv">{campanhaDetalhe.roas}</span>
              </div>
              <div className="stat-row">
                <span className="sl">{traduzir("Status")}</span>
                <span className="sv">{campanhaDetalhe.pausada ? "Pausada" : "Ativa"}</span>
              </div>
              <Link
                href={`/contatos`}
                className="link"
                style={{ display: "inline-block", marginTop: 8 }}
              >
                {traduzir("Ver leads dessa plataforma →")}
              </Link>
              <p className="hint" style={{ marginTop: 10 }}>{traduzir("Evolução no período, anúncios individuais e motivos de perda por campanha entram aqui quando o back-end ligar cada negociação à campanha que a originou.")}</p>
            </div>
          </div>
        ) : null}

        {/* Mesmo tratamento do bloco de cima: a explicação vai pro "?" do cabeçalho, e o espaço
            embaixo da tabela volta a ser espaço. */}
        <ChartCard
          title={traduzir("Origens")}
          action={
            <Ajuda
              texto={traduzir(
                "Leads e vendas vêm da origem gravada em cada contato e em cada negócio do CRM — a mesma que dá pra marcar à mão na ficha do contato, em “De onde veio”. Investimento só existe para origem que é campanha paga, e sai da plataforma: traço quer dizer que o CRM não sabe o valor, porque o canal não está conectado ou porque a plataforma não devolveu campanha — nunca que foi zero. Site, indicação e WhatsApp não têm investimento por natureza.",
              )}
            />
          }
        >
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{traduzir("Origem")}</th>
                  <th>{traduzir("Leads")}</th>
                  <th>{traduzir("Vendas")}</th>
                  <th>{traduzir("Investimento")}</th>
                </tr>
              </thead>
              <tbody>
                {origensComDados.map((o) => (
                  <tr key={o.origem}>
                    <td>{o.origem}</td>
                    <td>{o.leadsOrigem}</td>
                    <td>{o.vendasOrigem}</td>
                    {/*
                      Traco, e nao "Dados nao conectados" escrito em cada linha.
                      Investimento so existe pra origem que veio de campanha paga; nas outras (site,
                      indicacao, WhatsApp) nao ha o que investir, entao nao e falta de conexao, e
                      ausencia legitima. Repetir uma frase de erro linha a linha fazia a tabela
                      parecer quebrada e empurrava as colunas de numero pra fora do alinhamento.
                    */}
                    <td className="trafego-sem-valor">
                      {o.investimentoOrigem !== null ? formatarMoeda(o.investimentoOrigem) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </>
  );
}
