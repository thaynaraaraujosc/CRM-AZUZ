"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AcoesNoTopo } from "@/lib/topo-da-pagina";
import { AbasSocial } from "@/components/social/AbasSocial";
import { useAutomationFlows } from "@/lib/automation-flow-context";
import { modelosDaArea } from "@/lib/automacoes/modelos-de-robo";
import {
  IconAutomacoes,
  IconCheck,
  IconContatos,
  IconConversas,
  IconGlobo,
  IconInstagram,
  IconPlay,
} from "@/components/icons";
import { ColumnChart } from "@/components/charts";
import { SeletorDePeriodo } from "@/components/social/SeletorDePeriodo";
import {
  agrupamentosPossiveis,
  agrupar,
  type Agrupamento,
} from "@/lib/social/serie-de-interacoes";
import { useIdioma } from "@/lib/idioma-context";
import type { PainelSocial } from "@/app/api/social/metricas/route";

/**
 * Os modelos de Instagram, lidos do catálogo único (`modelos-de-robo.ts`).
 *
 * Eram uma lista paralela (`lib/social/modelos-rapidos.ts`, apagado), com outro formato. Duas listas
 * significam um modelo novo aparecendo num lugar e não no outro, e ninguém percebe até precisar.
 */
const MODELOS_DO_INSTAGRAM = modelosDaArea("social");

/**
 * SÓ OS QUATRO PRIMEIROS NA ABERTURA.
 *
 * Esta seção é um atalho pra quem ainda não tem robô nenhum, não o catálogo. Despejar os oito na
 * tela inicial empurraria o painel de interações pra baixo da dobra — e quem quer ver tudo tem o
 * "Ver todos os modelos" ao lado do título.
 */
const ATALHOS_DE_MODELO = MODELOS_DO_INSTAGRAM.slice(0, 4);

/**
 * RESUMO DA CONTA: a primeira tela do Social Seller.
 *
 * Quem clica em "Social Seller" no menu caía direto na LISTA de automações — a tela de quem já
 * sabe o que vai editar. Quem abre o módulo quase sempre quer outra coisa antes: saber como foi o
 * dia e, se ainda não tem robô nenhum, saber por onde começar. A lista continua existindo, agora
 * em `/social-seller/automacoes`, a um clique no menu.
 *
 * SÓ NÚMERO QUE EXISTE, a mesma regra do painel. Tudo aqui sai de `/api/social/metricas`, que
 * conta linha de banco deste workspace. Não há "economia de tempo", não há "cliques em links",
 * não há "sentimento das interações": o CRM não mede nenhum dos três, e inventá-los seria
 * transformar a tela de abertura do módulo numa tela que mente logo no primeiro olhar.
 *
 * SOBRE A COR. A referência que inspirou esta tela usa um gradiente roxo-azul de ponta a ponta no
 * cartão de primeiros passos. Aqui ele é um bloco CHAPADO no navy da marca: é a mesma ideia —
 * um cartão que se destaca de todos os outros por ser o único colorido — dentro da regra do
 * produto, que evita gradiente pesado, glow e arredondamento exagerado.
 */

/*
 * DIA, SEMANA E MÊS, e não 7/30/90 dias.
 *
 * É a janela em que se pensa o Instagram ("como foi hoje?"), e é a mesma escada do painel por
 * baixo — a API recebe dias e não sabe que a tela chama de "semana".
 */
const PERIODOS = [
  { dias: 1, label: "Dia" },
  { dias: 7, label: "Semana" },
  { dias: 30, label: "Mês" },
  { dias: 90, label: "Trimestre" },
] as const;

/*
 * O TRIMESTRE ENTROU junto com o gráfico, e não é enfeite: num recorte de uma semana, "agrupar
 * por mês" é uma barra só. Os três agrupamentos que a referência mostra só fazem sentido se
 * existir um período longo o bastante pra caber mais de um mês dentro.
 */
const NOME_DO_AGRUPAMENTO: Record<Agrupamento, string> = {
  hora: "Por hora",
  dia: "Diário",
  semana: "Semanal",
  mes: "Mensal",
};


type Icone = typeof IconAutomacoes;

/**
 * Um número, com o ícone do assunto e a explicação do que ele conta.
 *
 * A EXPLICAÇÃO FICA, e é a diferença entre este cartão e o da referência. Lá se lê "Mensagens
 * respondidas por automações: 0" e não há como saber se o zero é "não respondeu ninguém" ou "não
 * medimos isso". Aqui cada número diz de onde vem, em uma linha.
 */
function Tile({ Icone, valor, label, ajuda }: { Icone: Icone; valor: number; label: string; ajuda?: string }) {
  const { t: traduzir, localeNumero } = useIdioma();
  return (
    <div className="ss-tile">
      <span className="ss-tile-icone" aria-hidden="true">
        <Icone width={15} height={15} />
      </span>
      <strong>{valor.toLocaleString(localeNumero)}</strong>
      <span className="ss-tile-label">{traduzir(label)}</span>
      {ajuda ? <em>{traduzir(ajuda)}</em> : null}
    </div>
  );
}

export default function ResumoSocialPage() {
  const { t: traduzir } = useIdioma();
  const router = useRouter();
  const { criarFluxo } = useAutomationFlows();
  const [dias, setDias] = useState<number>(7);
  /*
   * O INTERVALO ESCOLHIDO À MÃO, quando há um.
   *
   * Guardado ao lado de `dias` e não no lugar dele: voltar de um recorte escolhido pra "Semana" é
   * um clique na pastilha, e a pastilha que estava marcada antes continua lembrada. Quem manda
   * é o intervalo enquanto ele existe.
   */
  const [intervalo, setIntervalo] = useState<{ de: string; ate: string } | null>(null);
  /* O agrupamento do gráfico é guardado como PEDIDO e resolvido no render: trocar o período pode
     tirar do ar a opção escolhida ("Mensal" não existe numa semana), e corrigir isso num efeito
     significaria um quadro desenhado com um agrupamento impossível antes da correção chegar. */
  const [agrupamentoPedido, setAgrupamentoPedido] = useState<Agrupamento>("dia");
  /* O período pedido viaja JUNTO com a resposta, como no painel: assim "carregando" é derivado
     (a resposta que tenho não é do período que estou mostrando) em vez de ser um segundo estado
     que precisa ser ligado e desligado na mão, e que erra sozinho quando duas buscas se cruzam.
     A própria string de busca é o que viaja, porque agora o período tem duas formas. */
  const busca = intervalo ? `de=${intervalo.de}&ate=${intervalo.ate}` : `dias=${dias}`;
  const [resposta, setResposta] = useState<{ paraBusca: string; dados: PainelSocial | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/social/metricas?${busca}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<PainelSocial>) : null))
      .then((dados) => {
        if (!cancelado) setResposta({ paraBusca: busca, dados });
      })
      .catch(() => {
        if (!cancelado) setResposta({ paraBusca: busca, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [busca]);

  const carregando = resposta?.paraBusca !== busca;
  const painel = resposta?.dados ?? null;

  /** Um modelo vira rascunho e abre no editor. Nunca publicado: ver `/social-seller/novo`. */
  function comecarPor(modeloId: string) {
    const modelo = MODELOS_DO_INSTAGRAM.find((m) => m.id === modeloId);
    if (!modelo) return;
    const { nodes, edges, configuracoes } = modelo.construir();
    const novo = criarFluxo({
      nome: modelo.nome,
      descricao: modelo.objetivo,
      area: "social",
      nodes,
      edges,
      configuracoes,
    });
    router.push(`/social-seller/editor/${novo.id}`);
  }

  /* Só os agrupamentos que rendem mais de uma barra no período escolhido. Quando sobra um, ele
     vira legenda: um botão único, que não desliga, é um botão que engana. */
  const agrupamentos = painel
    ? agrupamentosPossiveis(painel.serie.granularidade, painel.periodoDias)
    : [];
  const agrupamento = agrupamentos.includes(agrupamentoPedido) ? agrupamentoPedido : agrupamentos[0];
  const colunas =
    painel && agrupamento
      ? agrupar(painel.serie.pontos, agrupamento).map((ponto) => ({
          chave: ponto.chave,
          rotulo: ponto.rotulo,
          titulo: ponto.titulo,
          valor: ponto.total,
        }))
      : [];

  const interacoes = painel
    ? painel.crm.directs +
      painel.crm.comentarios +
      painel.crm.storiesRespondidos +
      painel.crm.mencoes +
      painel.crm.reacoes
    : 0;
  const noAr = painel?.robos.filter((r) => r.ligado).length ?? 0;

  /*
   * OS PRÓXIMOS PASSOS, todos lidos do estado real — nenhum é uma caixinha que a pessoa marca.
   *
   * A referência põe recompensas nessa trilha ("+100 contatos", "10% OFF"). Aqui não há nenhuma
   * pra dar, e desenhar o selo de um prêmio que não existe é pior do que não ter trilha.
   */
  const passos = painel
    ? [
        {
          titulo: "Conectar o Instagram",
          detalhe: "Sem a conta ligada, nenhum evento chega e nenhum robô dispara.",
          feito: painel.conectado,
          href: "/configuracoes?secao=integracoes",
          acao: "Conectar",
        },
        {
          titulo: "Montar a primeira automação",
          detalhe: "Comece por um modelo pronto e troque só o texto.",
          feito: painel.robos.length > 0,
          href: "/social-seller/novo",
          acao: "Criar",
        },
        {
          titulo: "Publicar e ligar",
          detalhe: "Rascunho não responde ninguém. Publicado e ligado, sim.",
          feito: noAr > 0,
          href: "/social-seller/automacoes",
          acao: "Ver automações",
        },
        {
          titulo: "Receber a primeira interação",
          detalhe: "Comentário, Direct, resposta a story ou menção.",
          feito: interacoes > 0,
          href: "/social-seller/painel",
          acao: "Acompanhar",
        },
      ]
    : [];
  const proximo = passos.find((p) => !p.feito) ?? null;
  const feitos = passos.filter((p) => p.feito).length;

  return (
    <>
      {/*
        O BOTÃO VAI PRA BARRA DO CRM, e a faixa do módulo deixa de existir.

        Eram duas faixas empilhadas: a do CRM, com a busca e metade vazia, e logo abaixo uma só
        pra escrever "Social Seller" — o nome que o menu lateral já mostra marcado — e segurar um
        botão. Juntas tiravam uns 120px do alto da tela. O botão é o único conteúdo que a segunda
        faixa tinha de próprio, então ele sobe e ela some. Ver `topo-da-pagina.tsx`.
      */}
      <AcoesNoTopo>
        <Link className="btn primary" href="/social-seller/novo">
          {traduzir("+ Criar automação")}
        </Link>
      </AcoesNoTopo>

      <div className="content social-layout">
        <AbasSocial />
        <div className="social-conteudo">
          {/*
            SEM CABEÇALHO DE PÁGINA.

            Aqui houve uma saudação ("Olá, Emilly!"), depois um título grande "Resumo" com uma
            linha explicando. Os dois saíram pelo mesmo motivo: o menu à esquerda já mostra
            "Resumo" marcado, e repetir o nome da tela dentro dela empurra os números — que são o
            conteúdo — pra baixo da dobra. A tela abre no que ela tem a dizer.
          */}
          {/*
            A CONTA DESCONECTADA É A PRIMEIRA COISA, e não um aviso no rodapé: com ela fora do ar
            todo número desta tela é zero por falta de conexão, não por falta de movimento, e os
            dois zeros são visualmente idênticos.
          */}
          {painel && !painel.conectado ? (
            <section className="ss-faixa alerta">
              <IconInstagram width={20} height={20} aria-hidden="true" />
              <div>
                <strong>{traduzir("O Instagram não está conectado.")}</strong>
                <p>
                  {painel.motivoDesconectado ? traduzir(painel.motivoDesconectado) : null}{" "}
                  {traduzir("Enquanto isso nenhum evento chega e nenhum robô daqui dispara.")}
                </p>
              </div>
              <Link className="btn primary" href="/configuracoes?secao=integracoes">
                {traduzir("Conectar")}
              </Link>
            </section>
          ) : null}

          {/*
            SEM TÍTULO E SEM A LINHA DE PERÍODO.
            
            "Resumo da sua conta" dizia o que os quatro números logo abaixo já dizem, e a linha
            "Período 27/10 – 03/11 · Horário de Brasília" repetia em texto o que o seletor ao lado
            mostra escolhido. Duas linhas de moldura em cima de quatro números: a tela abria com
            mais explicação do que conteúdo.
          */}
          <section className="ss-secao">
            {/*
              O PERÍODO ESCRITO POR EXTENSO, e não só o botão marcado.
              
              "Semana" marcado não diz QUAIS sete dias, e o recorte fecha por dia de calendário no
              fuso da conta — uma interação das 23h entra no dia dela, não no seguinte. Quem lê um
              número de painel precisa poder conferir o que ele cobre; a linha aqui é a conferência.
            */}
            <div className="ss-secao-topo ss-periodo">
              <div className="ss-seg" role="group" aria-label={traduzir("Período")}>
                {PERIODOS.map((p) => {
                  const marcado = !intervalo && dias === p.dias;
                  return (
                    <button
                      key={p.dias}
                      type="button"
                      className={`ss-seg-item${marcado ? " on" : ""}`}
                      aria-pressed={marcado}
                      onClick={() => {
                        setIntervalo(null);
                        setDias(p.dias);
                      }}
                    >
                      {traduzir(p.label)}
                    </button>
                  );
                })}
              </div>
              {painel ? (
                <div className="ss-periodo-info">
                  {/* O recorte escrito É o botão que o troca: ler "29/10 – 04/11" e não poder
                      mexer nele é a reclamação que trouxe este seletor. */}
                  <SeletorDePeriodo
                    primeiroDia={painel.periodo.primeiroDia}
                    ultimoDia={painel.periodo.ultimoDia}
                    personalizado={!!intervalo}
                    aoEscolher={setIntervalo}
                  />
                  <span>
                    <IconGlobo width={13} height={13} aria-hidden="true" />
                    {traduzir("Horário de Brasília")}
                  </span>
                </div>
              ) : null}
            </div>

            {carregando || !painel ? (
              <p className="hint">{traduzir("Carregando…")}</p>
            ) : (
              <div className="ss-tiles">
                <Tile
                  Icone={IconAutomacoes}
                  valor={painel.crm.automacoesIniciadas}
                  label="Automações disparadas"
                  ajuda="Cada vez que um robô do Instagram começou a rodar."
                />
                <Tile
                  Icone={IconConversas}
                  valor={interacoes}
                  label="Interações recebidas"
                  ajuda="Directs, comentários, stories, menções e reações."
                />
                <Tile
                  Icone={IconContatos}
                  valor={painel.crm.leadsCriados}
                  label="Novos contatos capturados"
                  ajuda="Contatos que nasceram do Instagram no período."
                />
                <Tile
                  Icone={IconPlay}
                  valor={noAr}
                  label="Robôs no ar"
                  ajuda="Publicados e ligados agora. Não depende do período."
                />
              </div>
            )}
          </section>

          {/*
            SEUS PRÓXIMOS PASSOS some quando os quatro estão feitos.
            
            Uma trilha com tudo marcado não ensina nada e ocupa a parte mais nobre da tela de
            abertura. Quem já chegou lá quer ver os números, não o caminho que já andou.
          */}
          {painel && proximo ? (
            <section className="ss-passos">
              <div className="ss-passos-topo">
                <div>
                  <strong>{traduzir("Seus próximos passos")}</strong>
                  <p>{traduzir("O que falta para o atendimento do Instagram rodar sozinho.")}</p>
                </div>
                <span className="ss-passos-conta">
                  {feitos} {traduzir("de")} {passos.length} {traduzir("prontos")}
                </span>
              </div>

              {/*
                A TRILHA DEITADA, com os passos ligados por uma linha — a forma da referência.
                
                SEM CADEADO nos passos à frente, e isso é diferença de produto, não de desenho. Lá
                a trilha é um jogo: a missão seguinte está travada até a anterior fechar. Aqui não
                há nada travado — dá pra publicar um robô antes de conectar a conta, só não
                adianta. Desenhar cadeado seria prometer uma regra que o CRM não aplica.
                
                SEM RECOMPENSA, pelo mesmo motivo: a referência pendura "+100 contatos" e "10% OFF"
                em cada passo. Não temos nenhum prêmio pra dar, e o selo de um prêmio que não
                existe é pior do que trilha nenhuma.
              */}
              <ol className="ss-trilha">
                {passos.map((p, i) => (
                  <li key={p.titulo} className={`ss-passo${p.feito ? " feito" : ""}${p === proximo ? " agora" : ""}`}>
                    <span className="ss-passo-marca" aria-hidden="true">
                      {p.feito ? <IconCheck width={13} height={13} /> : i + 1}
                    </span>
                    <span className="ss-passo-textos">
                      <strong>{traduzir(p.titulo)}</strong>
                    </span>
                  </li>
                ))}
              </ol>

              {/* O passo da vez repetido embaixo, com o porquê e o botão: na trilha cabe o nome, e
                  é aqui que se decide se vale clicar agora. */}
              <div className="ss-passos-agora">
                <div>
                  <strong>{traduzir(proximo.titulo)}</strong>
                  <span>{traduzir(proximo.detalhe)}</span>
                </div>
                <Link className="ss-passos-botao" href={proximo.href}>
                  {traduzir(proximo.acao)} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>
          ) : null}

          {/*
            "COMECE POR UM OBJETIVO" é o atalho de quem ainda não tem robô. São os mesmos modelos
            de `/social-seller/novo`, em uma linha: a tela de abertura é onde a pergunta "e agora,
            o que eu faço?" aparece, e mandar pra outra tela só pra escolher é um clique a mais no
            exato momento em que se está decidindo se vale a pena.
          */}
          <section className="ss-secao">
            <div className="ss-secao-topo">
              <h3>{traduzir("Escolha um objetivo e comece em minutos")}</h3>
              {/* O link leva pra GALERIA, e não pra lista de robôs criados: esta seção é sobre
                  escolher um modelo, e "todas as automações" mandava pra outra pergunta. */}
              <Link className="btn ghost pequeno" href="/social-seller/novo">
                {traduzir("Ver todos os modelos")}
              </Link>
            </div>
            <div className="ss-objetivos">
              {ATALHOS_DE_MODELO.map((m) => (
                <button key={m.id} type="button" className="ss-objetivo" onClick={() => comecarPor(m.id)}>
                  <span className="ss-objetivo-icone" aria-hidden="true">
                    <IconInstagram width={17} height={17} />
                  </span>
                  <span className="ss-objetivo-textos">
                    <strong>{traduzir(m.nome)}</strong>
                    <span>{traduzir(m.objetivo)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="ss-secao">
            <div className="ss-secao-topo">
              <h3>{traduzir("Interações recebidas")}</h3>
              <Link className="btn ghost pequeno" href="/social-seller/painel">
                {traduzir("Ver painel completo")}
              </Link>
            </div>
            {carregando || !painel ? (
              <p className="hint">{traduzir("Carregando…")}</p>
            ) : (
              <>
                <div className="ss-tiles compactos">
                  <Tile Icone={IconConversas} valor={painel.crm.directs} label="Mensagens diretas" />
                  <Tile Icone={IconConversas} valor={painel.crm.comentarios} label="Comentários" />
                  <Tile Icone={IconConversas} valor={painel.crm.storiesRespondidos} label="Respostas a stories" />
                  <Tile Icone={IconConversas} valor={painel.crm.mencoes} label="Menções em stories" />
                  <Tile Icone={IconConversas} valor={painel.crm.reacoes} label="Reações" />
                </div>

                {/*
                  O GRÁFICO CONTA OS MESMOS EVENTOS dos cinco números acima — o total das barras
                  bate com a soma deles. Dois jeitos de olhar a mesma contagem, e não duas
                  contagens: um painel que mostra 262 em cima e 254 embaixo perde a confiança da
                  tela inteira, e nunca se descobre qual dos dois estava certo.
                */}
                <div className="ss-grafico">
                  <div className="ss-grafico-topo">
                    <h4>{traduzir("Quando elas chegaram")}</h4>
                    {agrupamentos.length > 1 ? (
                      <div className="ss-seg" role="group" aria-label={traduzir("Agrupar o gráfico")}>
                        {agrupamentos.map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={`ss-seg-item${agrupamento === a ? " on" : ""}`}
                            aria-pressed={agrupamento === a}
                            onClick={() => setAgrupamentoPedido(a)}
                          >
                            {traduzir(NOME_DO_AGRUPAMENTO[a])}
                          </button>
                        ))}
                      </div>
                    ) : agrupamento ? (
                      <span className="hint">{traduzir(NOME_DO_AGRUPAMENTO[agrupamento])}</span>
                    ) : null}
                  </div>
                  <ColumnChart colunas={colunas} />
                </div>

                {!interacoes && painel.conectado ? (
                  <p className="hint">
                    {traduzir("Nada ainda neste período. Um robô ligado é o que faz a interação virar atendimento.")}
                  </p>
                ) : null}
              </>
            )}
            {/*
              O QUE A META INFORMA (alcance, visitas ao perfil) fica no painel, e não aqui. São
              números de outra procedência e outra confiabilidade: dependem de permissão, de tipo
              de conta e da API estar de pé. Lado a lado com os nossos, na tela de abertura, os
              dois pareceriam a mesma coisa.
            */}
          </section>
        </div>
      </div>
    </>
  );
}
