"use client";

import { useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { useFecharMenuDeLinha } from "@/lib/menu-de-linha";
import { relogioDaGravacao, useGravadorDeAudio } from "@/lib/audio/gravador";
import { VARIAVEIS_MENSAGEM, inserirTokenNoTexto } from "../forms/variaveis";
import { canaisDaAreaParaBloco } from "../forms/canais";
import { useBibliotecaDocumentos } from "@/lib/biblioteca-documentos-context";
import { PlayerDeAudio } from "./PlayerDeAudio";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { resumoIndicaIncompleto, resumoNo, saidasDoNo, temEntrada } from "@/lib/automation-flow/resumo";
import type { FlowNode as FlowNodeDominio, FlowNodeCategory } from "@/lib/automation-flow/types";
import { useFunis } from "@/lib/funis-context";
import type { FlowRFNode } from "../utils";
import { useIdioma } from "@/lib/idioma-context";
import {
  IconAlerta,
  IconAutomacoes,
  IconBandeira,
  IconConfiguracoes,
  IconConversas,
  IconEquipe,
  IconLampada,
  IconPlug,
  IconDuplicar,
  IconInstagram,
  IconLixeira,
  IconRaio,
  IconRamificacao,
  IconRelogio,
  IconAnexo,
  IconEdit,
  IconMaisOpcoes,
  IconMic,
  IconPlay,
} from "@/components/icons";

/** Ícone por categoria de bloco. Eram emojis: cada um com desenho, peso e cor de uma fonte
 * diferente, e o conjunto nunca ia parecer uma família só. Agora saem todos da mesma biblioteca
 * do CRM: mesmo traço, mesma proporção, e herdam a cor do tema. */
const ICONE_CATEGORIA: Record<FlowNodeCategory, typeof IconAutomacoes> = {
  gatilho: IconAutomacoes,
  condicao: IconRamificacao,
  mensagem: IconConversas,
  espera: IconRelogio,
  acao: IconConfiguracoes,
  humano: IconEquipe,
  integracao: IconPlug,
  fim: IconBandeira,
};

/** Nome da categoria mostrado em cima do título. A leitura do tipo de bloco precisa funcionar sem abrir o nó. */
const NOME_CATEGORIA: Record<FlowNodeCategory, string> = {
  gatilho: "Gatilho",
  condicao: "Condição",
  mensagem: "Mensagem",
  espera: "Espera",
  acao: "Ação",
  humano: "Humano",
  integracao: "Integração",
  fim: "Fim",
};

/**
 * O TEXTO QUE A PESSOA DO OUTRO LADO VAI VER, quando o bloco manda um.
 *
 * O resumo do nó serve pra outra coisa: ele descreve o bloco ("texto · Canal: instagram", "2
 * opções"), entre aspas e truncado. Quem monta uma automação de Instagram precisa conferir o
 * contrário — a mensagem como ela chega no Direct. Por isso a bolha usa o texto CRU, com as
 * quebras de linha que foram escritas, e devolve `null` quando o bloco não manda texto nenhum
 * (uma espera, uma condição, uma etiqueta): aí o resumo continua sendo o que se mostra.
 */
function textoDaMensagem(node: FlowNodeDominio): string | null {
  const d = (node.data ?? {}) as Record<string, unknown>;
  const campo =
    node.type === "mensagem_texto" || node.type === "mensagem_botoes" || node.type === "mensagem_lista"
      ? d.texto
      : node.type === "mensagem_imagem" ||
          node.type === "mensagem_video" ||
          node.type === "mensagem_audio" ||
          node.type === "mensagem_documento"
        ? d.legenda
        : null;
  const texto = typeof campo === "string" ? campo.trim() : "";
  return texto ? texto : null;
}

/**
 * Renderizador único de nó, reaproveitado pelos 8 componentes registrados em
 * `nodeTypes` (um por `FlowNodeCategory`). A diferença visual/comportamental
 * entre tipos dentro da mesma categoria vem só de `saidasDoNo`/`resumoNo`,
 * então não faz sentido duplicar esse JSX 8 vezes.
 */
export function NodeShell({ id, data, selected }: NodeProps<FlowRFNode>) {
  const { t: traduzir } = useIdioma();
  const {
    flowNode,
    problemas,
    saidasConectadas,
    caminhosConvergindo,
    ordemNarrativa,
    explicacao,
    onAdicionarApos,
    area,
    aoDuplicar,
    aoRemover,
    numero,
    aoEditarTexto,
    aoRenomear,
    aoTestar,
    aoAnexar,
    aoMudarOpcoes,
    aoDesligarSaida,
    aoMudarCanal,
    aoMudarCronometro,
  } = data;

  const [menuAberto, setMenuAberto] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [variaveisAbertas, setVariaveisAbertas] = useState(false);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  const campoDoTexto = useRef<HTMLTextAreaElement>(null);
  const { documentos } = useBibliotecaDocumentos();
  const fecharMenus = useCallback(() => {
    setMenuAberto(false);
    setVariaveisAbertas(false);
  }, []);
  useFecharMenuDeLinha(menuAberto || variaveisAbertas, fecharMenus);

  const gravador = useGravadorDeAudio((audio) => {
    aoAnexar?.({
      dataUrl: audio.dataUrl,
      nome: `audio-${audio.segundos}s.webm`,
      mimeType: audio.mimeType,
      // O tamanho sai do base64: 4 caracteres por 3 bytes. Serve pro rótulo, não pra cobrança.
      bytes: Math.round((audio.dataUrl.length - audio.dataUrl.indexOf(",") - 1) * 0.75),
    });
  });

  /** "1h", "30min", "2d": o prazo da pergunta, curto o bastante pra caber ao lado da saída. */
  const prazoDeEspera = (() => {
    const minutos = ((flowNode.data ?? {}) as { esperaMinutos?: number }).esperaMinutos;
    if (!minutos) return null;
    if (minutos % 1440 === 0) return `${minutos / 1440}d`;
    if (minutos % 60 === 0) return `${minutos / 60}h`;
    return `${minutos}min`;
  })();

  /** O tempo do bloco de espera em minutos, quando ele é um cronômetro simples. */
  const minutosDaEspera = (() => {
    const d = (flowNode.data ?? {}) as {
      modo?: string;
      valor?: number;
      tempoMaximo?: { valor?: number; unidade?: string };
    };
    const emMinutos = (valor: number, unidade?: string) =>
      unidade === "horas" ? valor * 60 : unidade === "dias" ? valor * 1440 : valor;
    // "Até a resposta" também tem cronômetro: é o prazo máximo de espera, e ele vive em
    // `tempoMaximo` em vez de `valor`. É o bloco do follow-up — espera a resposta, e se ela não
    // vier dentro do prazo, segue pela outra saída.
    if (d.modo === "ate_resposta") {
      return d.tempoMaximo?.valor ? emMinutos(d.tempoMaximo.valor, d.tempoMaximo.unidade) : 0;
    }
    if (d.modo === "minutos" || d.modo === "horas" || d.modo === "dias") {
      return emMinutos(d.valor ?? 0, d.modo);
    }
    return null;
  })();

  const canaisPossiveis = canaisDaAreaParaBloco(area ?? "comercial");
  const canalDoBloco = ((flowNode.data ?? {}) as { canal?: string }).canal;

  /** Os botões gravados no bloco, do jeito que a bolha os edita. */
  const opcoesDoBloco = (((flowNode.data ?? {}) as Record<string, unknown>).opcoes ?? []) as {
    id: string;
    rotulo: string;
    url?: string;
  }[];

  function trocarOpcao(indice: number, mudanca: Partial<{ rotulo: string; url: string }>) {
    aoMudarOpcoes?.(opcoesDoBloco.map((o, i) => (i === indice ? { ...o, ...mudanca } : o)));
  }

  function acrescentarOpcao(comUrl: boolean) {
    // O id precisa ser único e ESTÁVEL: é ele que amarra a aresta que sai deste botão. O prefixo
    // "op-" é o que deixa o editor saber, ao apagar, quais arestas eram de opção.
    const id = `op-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    aoMudarOpcoes?.([...opcoesDoBloco, comUrl ? { id, rotulo: "", url: "" } : { id, rotulo: "" }]);
  }

  function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo || !aoAnexar) return;
    const leitor = new FileReader();
    leitor.onload = () =>
      aoAnexar({
        dataUrl: String(leitor.result),
        nome: arquivo.name,
        mimeType: arquivo.type || "application/octet-stream",
        bytes: arquivo.size,
      });
    leitor.readAsDataURL(arquivo);
  }
  /*
   * A CARA DO INSTAGRAM só no Social Seller, e só nos blocos que falam com a rede.
   *
   * Gatilho e mensagem são os dois que tocam o Direct: um recebe o evento, o outro manda o texto.
   * Uma condição, uma espera ou uma etiqueta acontecem dentro do CRM e não têm nada de Instagram
   * — marcá-las com a marca da rede faria a marca querer dizer "bloco", e aí ela não diria nada.
   */
  const caraDoInstagram = area === "social" && (flowNode.category === "gatilho" || flowNode.category === "mensagem");
  const { funis } = useFunis();
  const bloco = BLOCOS_DISPONIVEIS.find((b) => b.tipo === flowNode.type);
  const saidas = saidasDoNo(flowNode);
  /*
   * O CARTÃO DE MENSAGEM, no modelo da referência.
   *
   * Um bloco de mensagem não é "mais um bloco": ele é a própria conversa. O cartão mostra a
   * mensagem como ela sai — bolha, texto editável no lugar, os botões de resposta rápida dentro
   * dela — e pendura à direita os caminhos que ela abre ("Outra resposta", "Sem resposta",
   * "Falha ao enviar a mensagem"). Antes isso era uma linha de resumo entre aspas e uma pilha de
   * rótulos cinzas: dava pra saber que existia uma mensagem, não dava pra LER a mensagem.
   *
   * Os outros blocos (condição, espera, etiqueta) continuam no cartão comum: eles não têm
   * conteúdo pra mostrar, têm configuração — e configuração se lê melhor em resumo.
   */
  const ehCartaoDeMensagem = flowNode.category === "mensagem";
  const textoDoBloco = (() => {
    const d = (flowNode.data ?? {}) as Record<string, unknown>;
    const bruto = flowNode.type === "mensagem_texto" || flowNode.type === "mensagem_botoes" || flowNode.type === "mensagem_lista" ? d.texto : d.legenda;
    return typeof bruto === "string" ? bruto : "";
  })();
  /** As saídas que são BOTÃO de resposta rápida: elas moram dentro da bolha, como na referência. */
  const saidasDeOpcao = ehCartaoDeMensagem
    ? saidas.filter(
        (sa) =>
          (flowNode.type === "mensagem_botoes" || flowNode.type === "mensagem_lista") &&
          sa.handleId !== undefined &&
          !["outra_resposta", "nao_respondeu", "tentativas_esgotadas", "falha"].includes(sa.handleId),
      )
    : [];
  const saidasDeCaminho = saidas.filter((sa) => !saidasDeOpcao.includes(sa));
  const temErro = problemas.some((p) => p.severidade === "erro");
  const temAviso = !temErro && problemas.some((p) => p.severidade === "aviso");
  const classes = [
    "flow-node",
    ehCartaoDeMensagem ? "msg-cartao" : "",
    `flow-cat-${flowNode.category}`,
    selected ? "is-selected" : "",
    temErro ? "has-error" : temAviso ? "has-warning" : "",
    flowNode.desativado ? "is-desativado" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-node-id={id}>
      {/*
        O LADO POR ONDE A LIGAÇÃO ENTRA depende do sentido do canvas.
        
        O funil lê de cima pra baixo: a ligação entra por cima. O Social Seller lê da esquerda pra
        direita, como no ManyChat — a conversa acontece numa linha, e o passo seguinte fica ao
        lado. Mudar o lado do ponto muda também por onde a curva sai e entra, porque é dele que o
        React Flow tira a direção da aresta.
      */}
      {temEntrada(flowNode.category) ? (
        <Handle
          type="target"
          position={area === "social" ? Position.Left : Position.Top}
          className="flow-handle"
        />
      ) : null}

      {/*
        AS ABAS DE CIMA, só no Social Seller.
        
        "Gatilho" numa aba escura acima do cartão e "Selecionado" numa aba azul no lugar dela.
        Vêm de fora da borda porque o cartão inteiro é conteúdo: a aba diz O QUE ele é e em que
        estado está sem gastar uma linha de dentro — e num canvas com oito blocos, achar o que
        começa tudo vira um relance em vez de uma leitura.
      */}
      {/*
        COPIAR E APAGAR EM CIMA DO BLOCO SELECIONADO.
        
        Antes os dois caminhos eram o menu do botão direito e a tecla Delete — nenhum dos dois se
        descobre olhando. Com o bloco selecionado, os dois ficam onde a pessoa acabou de clicar.
      */}
      {area === "social" && selected && (aoDuplicar || aoRemover) ? (
        <div className="flow-node-ferramentas">
          {aoDuplicar ? (
            <button
              type="button"
              aria-label={traduzir("Duplicar este bloco")}
              title={traduzir("Duplicar este bloco")}
              onClick={(e) => {
                e.stopPropagation();
                aoDuplicar();
              }}
            >
              <IconDuplicar width={14} height={14} />
            </button>
          ) : null}
          {aoRemover ? (
            <button
              type="button"
              className="perigo"
              aria-label={traduzir("Apagar este bloco")}
              title={traduzir("Apagar este bloco")}
              onClick={(e) => {
                e.stopPropagation();
                aoRemover();
              }}
            >
              <IconLixeira width={14} height={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      {area === "social" ? (
        selected ? (
          <span className="flow-node-aba selecionado">{traduzir("Selecionado")}</span>
        ) : flowNode.category === "gatilho" ? (
          <span className="flow-node-aba">
            <IconRaio width={11} height={11} aria-hidden="true" /> {traduzir("Gatilho")}
          </span>
        ) : null
      ) : null}

      {ordemNarrativa ? (
        <span className="flow-node-ordem" aria-hidden="true">
          {ordemNarrativa}
        </span>
      ) : null}

      {caminhosConvergindo && caminhosConvergindo > 1 ? (
        <div className="flow-node-convergencia" title={`${caminhosConvergindo} caminhos diferentes se encontram aqui`}>
          ⤵ {caminhosConvergindo} caminhos se encontram aqui
        </div>
      ) : null}

      {/*
        O MESMO CABEÇALHO EM TODO BLOCO.
        
        Era só do cartão de mensagem; os outros ficaram com o desenho antigo — faixa colorida na
        lateral, categoria escrita em cima do nome, sem número e sem "⋯". "Eu preciso que esse
        quadrado seja igual aos outros", e tinha razão: duas linguagens no mesmo canvas fazem o
        olho procurar diferença onde não há nenhuma.
      */}
      <div className="msg-cab" data-menu-de-linha="">
            {numero ? <span className="msg-num">{numero}</span> : null}
            {/* O ícone da categoria substitui a faixa colorida que ficava na lateral: diz o tipo
                do bloco sem pintar o cartão inteiro nem gastar uma linha escrevendo. */}
            <span className="msg-cat" aria-hidden="true">
              {(() => {
                if (caraDoInstagram) return <IconInstagram width={13} height={13} />;
                const IconeCategoria = ICONE_CATEGORIA[flowNode.category];
                return <IconeCategoria width={13} height={13} />;
              })()}
            </span>
            {renomeando && aoRenomear ? (
              <input
                className="msg-nome-input nodrag"
                autoFocus
                defaultValue={flowNode.titulo ?? (bloco?.label ? traduzir(bloco.label) : flowNode.type)}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  aoRenomear(e.target.value.trim());
                  setRenomeando(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenomeando(false);
                }}
              />
            ) : (
              <span className="msg-nome">
                {flowNode.titulo || (bloco?.label ? traduzir(bloco.label) : flowNode.type)}
              </span>
            )}
            {/*
              O CANAL NO CABEÇALHO, como na referência ("Canais: Todos").
              
              Ele morava só no painel da direita, e é a primeira coisa que muda a mensagem: o
              mesmo texto sai diferente no WhatsApp e no Direct. Quando a área tem um canal só,
              ele é informação e não escolha — e aí não vira um seletor que não escolhe nada.
            */}
            {canalDoBloco ? (
              canaisPossiveis.length > 1 && aoMudarCanal ? (
                <select
                  className="msg-canal nodrag"
                  value={canalDoBloco}
                  aria-label={traduzir("Canal da mensagem")}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => aoMudarCanal(e.target.value)}
                >
                  {canaisPossiveis.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="msg-canal-fixo">
                  {canaisPossiveis.find((c) => c.valor === canalDoBloco)?.label ?? canalDoBloco}
                </span>
              )
            ) : null}
            {flowNode.desativado ? <span className="flow-node-pausado-badge">{traduzir("Pausado")}</span> : null}
            {temErro || temAviso ? (
              <span className="flow-node-warn" title={problemas.map((p) => p.mensagem).join(" · ")}>
                <IconAlerta width={13} height={13} />
              </span>
            ) : null}
            {/*
              O "⋯" DO BLOCO.
              
              Renomear, duplicar, testar e excluir estavam espalhados: o nome só no painel da
              direita, duplicar e apagar em botões que só apareciam no Social Seller com o bloco
              selecionado, e excluir também na tecla Delete — que ninguém descobre olhando. Aqui
              ficam os quatro, no mesmo lugar em que a referência os põe.
            */}
            {aoRenomear || aoDuplicar || aoRemover || aoTestar ? (
              <div className="msg-mais-caixa">
                <button
                  type="button"
                  className="msg-mais nodrag"
                  aria-label={traduzir("Mais opções deste bloco")}
                  aria-expanded={menuAberto}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAberto((v) => !v);
                  }}
                >
                  <IconMaisOpcoes width={14} height={14} />
                </button>
                {menuAberto ? (
                  <div className="msg-menu" role="menu">
                    {aoTestar ? (
                      <button type="button" role="menuitem" onClick={() => { setMenuAberto(false); aoTestar(); }}>
                        <IconPlay width={12} height={12} aria-hidden="true" />
                        {traduzir("Testar a automação")}
                      </button>
                    ) : null}
                    {aoRenomear ? (
                      <button type="button" role="menuitem" onClick={() => { setMenuAberto(false); setRenomeando(true); }}>
                        <IconEdit width={12} height={12} aria-hidden="true" />
                        {traduzir("Renomear")}
                      </button>
                    ) : null}
                    {aoDuplicar ? (
                      <button type="button" role="menuitem" onClick={() => { setMenuAberto(false); aoDuplicar(); }}>
                        <IconDuplicar width={12} height={12} aria-hidden="true" />
                        {traduzir("Duplicar")}
                      </button>
                    ) : null}
                    {aoRemover ? (
                      <button type="button" role="menuitem" className="perigo" onClick={() => { setMenuAberto(false); aoRemover(); }}>
                        <IconLixeira width={12} height={12} aria-hidden="true" />
                        {traduzir("Excluir")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
      </div>

      {ehCartaoDeMensagem ? (
        <>
          <div className="msg-bolha">
            <span className="msg-avatar" aria-hidden="true">
              {caraDoInstagram ? <IconInstagram width={14} height={14} /> : <IconAutomacoes width={14} height={14} />}
            </span>
            {/*
              A MENSAGEM SE ESCREVE AQUI.
              
              `nodrag` e `nowheel` são do React Flow: sem eles, arrastar pra selecionar texto
              arrasta o bloco, e rolar dentro do campo dá zoom no canvas.
              
              Sem `aoEditarTexto` (modo "só visualizar") o campo vira leitura: desabilitar o
              editor inteiro e deixar um campo editável no meio dele seria mentir sobre o modo.
            */}
            <textarea
              ref={campoDoTexto}
              className="msg-texto nodrag nowheel"
              value={textoDoBloco}
              readOnly={!aoEditarTexto}
              rows={Math.min(8, Math.max(1, textoDoBloco.split("\n").length))}
              placeholder={traduzir("Escreva a mensagem do robô…")}
              onChange={(e) => aoEditarTexto?.(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />

            {/*
              O CLIPE E O MICROFONE, dentro da bolha.
              
              Prender um arquivo TROCA o tipo do bloco (texto vira imagem, áudio, documento),
              porque é assim que o motor sabe o que enviar — e o texto que já estava escrito vira
              a legenda, em vez de se perder. Quem faz essa troca é o editor; aqui só se escolhe
              o arquivo.
            */}
            {aoAnexar ? (
              <div className="msg-ferramentas nodrag">
                {gravador.estado === "gravando" ? (
                  <>
                    <span className="msg-gravando">
                      <span className="msg-gravando-ponto" aria-hidden="true" />
                      {/* Os tracinhos são o volume de verdade, lido do microfone: ver o
                          comentário em `gravador.ts` sobre por que não é uma animação solta. */}
                      <span className="msg-gravando-onda" aria-hidden="true">
                        {gravador.niveis.map((n, i) => (
                          <span key={i} style={{ height: `${Math.round(n * 100)}%` }} />
                        ))}
                      </span>
                      {relogioDaGravacao(gravador.segundos)}
                    </span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); gravador.parar(); }}>
                      {traduzir("Usar")}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); gravador.cancelar(); }}>
                      {traduzir("Descartar")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      title={traduzir("Anexar um arquivo")}
                      aria-label={traduzir("Anexar um arquivo")}
                      onClick={(e) => { e.stopPropagation(); entradaDeArquivo.current?.click(); }}
                    >
                      <IconAnexo width={14} height={14} />
                    </button>
                    <button
                      type="button"
                      title={traduzir("Gravar um áudio")}
                      aria-label={traduzir("Gravar um áudio")}
                      disabled={gravador.estado === "pedindo"}
                      onClick={(e) => { e.stopPropagation(); void gravador.comecar(); }}
                    >
                      <IconMic width={14} height={14} />
                    </button>
                    {/*
                      INSERIR VARIÁVEL sem sair do cartão.
                      
                      O token entra na POSIÇÃO DO CURSOR e não no fim: quem quer "Oi {nome}, tudo
                      bem?" não quer "Oi , tudo bem?{nome}".
                    */}
                    {aoEditarTexto ? (
                      <div className="msg-vars-caixa" data-menu-de-linha="">
                        <button
                          type="button"
                          title={traduzir("Inserir variável")}
                          aria-label={traduzir("Inserir variável")}
                          aria-expanded={variaveisAbertas}
                          onClick={(e) => { e.stopPropagation(); setVariaveisAbertas((v) => !v); }}
                        >
                          {"{ }"}
                        </button>
                        {variaveisAbertas ? (
                          <div className="msg-menu msg-vars" role="menu">
                            {VARIAVEIS_MENSAGEM.map((v) => (
                              <button
                                key={v.token}
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVariaveisAbertas(false);
                                  aoEditarTexto(inserirTokenNoTexto(textoDoBloco, v.token, campoDoTexto.current));
                                }}
                              >
                                {v.label}
                                <em>{v.token}</em>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                <input
                  ref={entradaDeArquivo}
                  type="file"
                  hidden
                  onChange={(e) => {
                    escolherArquivo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}
            {gravador.erro ? <p className="msg-erro">{gravador.erro}</p> : null}

            {/*
              A IMAGEM (ou o arquivo) APARECE NO CARTÃO.
              
              Depois do upload o bloco só dizia "Enviar imagem": pra saber QUAL imagem era preciso
              abrir o painel da direita e ler o nome do arquivo. Com três blocos de imagem no
              fluxo, isso é abrir três painéis. A miniatura responde de relance, que é a mesma
              razão de a mensagem de texto aparecer escrita na bolha.
            */}
            {flowNode.type === "mensagem_imagem" || flowNode.type === "mensagem_video" || flowNode.type === "mensagem_documento" ? (
              (() => {
                const dados = (flowNode.data ?? {}) as { arquivoId?: string; arquivoNome?: string; arquivoTamanho?: string };
                const doc = documentos.find((d) => d.id === dados.arquivoId);
                if (!dados.arquivoId) return null;
                return (
                  <div className="msg-arquivo">
                    {flowNode.type === "mensagem_imagem" && doc?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a fonte é uma data URL da biblioteca, não uma URL remota que o otimizador do Next saiba buscar.
                      <img src={doc.url} alt="" className="msg-arquivo-mini" />
                    ) : (
                      <span className="msg-arquivo-mini msg-arquivo-icone" aria-hidden="true">
                        <IconAnexo width={16} height={16} />
                      </span>
                    )}
                    <span className="msg-arquivo-textos">
                      <strong>{dados.arquivoNome ?? doc?.nome ?? traduzir("Arquivo")}</strong>
                      {dados.arquivoTamanho ? <span>{dados.arquivoTamanho}</span> : null}
                    </span>
                  </div>
                );
              })()
            ) : null}

            {/* O ÁUDIO TOCA AQUI DENTRO: ver `PlayerDeAudio`. A fonte é o arquivo da biblioteca,
                que é o mesmo que o motor envia — ouvir aqui é ouvir o que vai sair. */}
            {flowNode.type === "mensagem_audio" ? (
              (() => {
                const dados = (flowNode.data ?? {}) as { arquivoId?: string; arquivoNome?: string };
                const doc = documentos.find((d) => d.id === dados.arquivoId);
                return doc?.url ? <PlayerDeAudio src={doc.url} nome={dados.arquivoNome} /> : null;
              })()
            ) : null}

            {/*
              OS BOTÕES DE RESPOSTA, editáveis na própria bolha.
              
              Cada um tem o seu ponto de ligação à direita, porque cada um abre um caminho
              próprio. O botão de URL não tem: quem clica sai pro site e não volta com resposta,
              então não existe "o que acontece depois" pra ligar.
            */}
            {opcoesDoBloco.map((opcao, indice) => {
              const saida = saidasDeOpcao.find((sa) => sa.handleId === opcao.id);
              const conectada = saidasConectadas?.has(opcao.id) ?? false;
              return (
                <div className={`msg-opcao${opcao.url !== undefined ? " msg-opcao-url" : ""}`} key={opcao.id}>
                  <input
                    className="msg-opcao-campo nodrag"
                    value={opcao.rotulo}
                    placeholder={traduzir(opcao.url !== undefined ? "Texto do botão" : "Resposta do contato")}
                    readOnly={!aoMudarOpcoes}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => trocarOpcao(indice, { rotulo: e.target.value })}
                  />
                  {opcao.url !== undefined ? (
                    <input
                      className="msg-opcao-campo msg-opcao-link nodrag"
                      value={opcao.url}
                      placeholder="https://…"
                      readOnly={!aoMudarOpcoes}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => trocarOpcao(indice, { url: e.target.value })}
                    />
                  ) : null}
                  {aoMudarOpcoes ? (
                    <button
                      type="button"
                      className="msg-opcao-tirar nodrag"
                      aria-label={traduzir("Tirar este botão")}
                      title={traduzir("Tirar este botão")}
                      onClick={(e) => {
                        e.stopPropagation();
                        aoMudarOpcoes(opcoesDoBloco.filter((_, i) => i !== indice));
                      }}
                    >
                      <IconLixeira width={12} height={12} />
                    </button>
                  ) : null}
                  {saida && !conectada && onAdicionarApos ? (
                    <button
                      type="button"
                      className="msg-opcao-add"
                      title={traduzir("O que acontece quando clicam aqui?")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdicionarApos(opcao.id, e.currentTarget.getBoundingClientRect());
                      }}
                    >
                      +
                    </button>
                  ) : null}
                  {/* Já ligada: o "+" vira "×", que desfaz a ligação. Achar a linha certa no meio
                      de vinte que se cruzam pra apertar Delete era sorte. */}
                  {saida && conectada && aoDesligarSaida ? (
                    <button
                      type="button"
                      className="msg-opcao-add msg-opcao-tirar-ligacao"
                      title={traduzir("Tirar a ligação desta saída")}
                      onClick={(e) => {
                        e.stopPropagation();
                        aoDesligarSaida(opcao.id);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  {saida ? (
                    <Handle type="source" position={Position.Right} id={opcao.id} className="flow-handle msg-handle" />
                  ) : null}
                </div>
              );
            })}

            {aoMudarOpcoes ? (
              <div className="msg-novos-botoes nodrag">
                <button type="button" onClick={(e) => { e.stopPropagation(); acrescentarOpcao(false); }}>
                  + {traduzir("Botão de ação")}
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); acrescentarOpcao(true); }}>
                  + {traduzir("Botão de URL")}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : flowNode.type === "aguardar" && aoMudarCronometro ? (
        /*
          O CRONÔMETRO EDITÁVEL NO CARTÃO, como na referência.
          
          "Aguardar 5 minutos" era uma frase de resumo: pra trocar o tempo era preciso abrir o
          painel da direita. Aqui os números são campos.
          
          SEM SEGUNDOS, e isso não é esquecimento: quem acorda as execuções paradas é uma varredura
          que roda de minuto em minuto. Um prazo de trinta segundos seria arredondado pra cima sem
          avisar, e o campo prometeria uma precisão que o motor não tem.
        */
        <div className="no-cronometro nodrag" onClick={(e) => e.stopPropagation()}>
          <IconRelogio width={13} height={13} aria-hidden="true" />
          <span>{traduzir("Cronômetro")}:</span>
          <input
            type="number"
            min={0}
            max={720}
            value={Math.floor((minutosDaEspera ?? 0) / 60)}
            aria-label={traduzir("Horas")}
            onChange={(e) => aoMudarCronometro(Number(e.target.value) * 60 + ((minutosDaEspera ?? 0) % 60))}
          />
          <span>{traduzir("horas")}</span>
          <input
            type="number"
            min={0}
            max={59}
            value={(minutosDaEspera ?? 0) % 60}
            aria-label={traduzir("Minutos")}
            onChange={(e) => aoMudarCronometro(Math.floor((minutosDaEspera ?? 0) / 60) * 60 + Number(e.target.value))}
          />
          <span>{traduzir("min")}</span>
        </div>
      ) : (
        (() => {
          const resumo = resumoNo(flowNode, funis);
          const incompleto = resumoIndicaIncompleto(resumo);
          return (
            <div className={`flow-node-body${incompleto ? " flow-node-body-incompleto" : ""}`}>
              {incompleto ? (
                <span aria-hidden="true" style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 4 }}>
                  <IconAlerta width={12} height={12} />
                </span>
              ) : null}
              {resumo}
            </div>
          );
        })()
      )}

      {explicacao ? (
        <div className="flow-node-explicacao">
          <IconLampada width={12} height={12} aria-hidden="true" /> {explicacao}
        </div>
      ) : null}

      {/* No cartão de mensagem, os botões de resposta já foram desenhados DENTRO da bolha: aqui
          sobram os caminhos de resultado ("Outra resposta", "Sem resposta", "Falha ao enviar"). */}
      {(ehCartaoDeMensagem ? saidasDeCaminho : saidas).length > 1 ? (
        <div className={`flow-node-handles${ehCartaoDeMensagem ? " msg-saidas" : ""}`}>
          {(ehCartaoDeMensagem ? saidasDeCaminho : saidas).map((s) => {
            const chave = s.handleId ?? "__default__";
            const conectada = saidasConectadas?.has(chave) ?? false;
            /* Condição binária (item 8): "Sim"/"Não" tem que ler como uma bifurcação clara, não só
               mais uma linha de opção igual às outras. Verde/vermelho reforça qual caminho é qual
               sem precisar ler o texto. */
            const corBifurcacao = flowNode.category === "condicao" ? (chave === "sim" ? "sim" : chave === "nao" ? "nao" : undefined) : undefined;
            /* Pergunta com várias opções (item 8): visual de "menu" (pill azulado). Diferente da
               bifurcação binária de condição, pra não parecer o mesmo tipo de componente. */
            const ehOpcaoDePergunta =
              !ehCartaoDeMensagem &&
              (flowNode.type === "mensagem_botoes" || flowNode.type === "mensagem_lista") &&
              chave !== "outra_resposta" &&
              chave !== "nao_respondeu";
            /* O caminho de falha é o único em vermelho, como na referência: ele não é "mais uma
               resposta possível", é o que fazer quando o envio não saiu. */
            const ehFalha = chave === "falha";
            return (
              <div
                className={`flow-node-handle-row${corBifurcacao ? ` is-bifurcacao-${corBifurcacao}` : ""}${ehOpcaoDePergunta ? " is-opcao-pergunta" : ""}${ehFalha ? " is-falha" : ""}`}
                key={chave}
              >
                <span className="flow-handle-label">
                  {traduzir(s.label)}
                  {/* O prazo escrito ao lado de "Sem resposta": sem ele, quanto tempo o robô
                      espera antes de desistir é uma informação que só existe no painel. */}
                  {chave === "nao_respondeu" && prazoDeEspera ? (
                    <em className="flow-handle-prazo">{prazoDeEspera}</em>
                  ) : null}
                </span>
                {!conectada && onAdicionarApos ? (
                  <button
                    type="button"
                    className="flow-node-add-inline"
                    title={traduzir("O que acontece agora?")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdicionarApos(s.handleId, e.currentTarget.getBoundingClientRect());
                    }}
                  >
                    +
                  </button>
                ) : null}
                {conectada && aoDesligarSaida ? (
                  <button
                    type="button"
                    className="flow-node-add-inline flow-node-tirar-ligacao"
                    title={traduzir("Tirar a ligação desta saída")}
                    onClick={(e) => {
                      e.stopPropagation();
                      aoDesligarSaida(s.handleId);
                    }}
                  >
                    ×
                  </button>
                ) : null}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={s.handleId}
                  className="flow-handle flow-handle-inline"
                />
              </div>
            );
          })}
        </div>
      ) : (ehCartaoDeMensagem ? saidasDeCaminho : saidas).length === 1 ? (
        <div className="flow-node-saida-unica">
          {/* "Próximo passo" escrito: o ponto de conexão sozinho não diz o que ele é, e quem
              nunca montou um fluxo não descobre que se arrasta dali pra ligar no bloco seguinte. */}
          <span className="flow-node-proximo">{traduzir("Próximo passo")}</span>
          <Handle
            type="source"
            position={area === "social" ? Position.Right : Position.Bottom}
            className="flow-handle"
          />
          {!(saidasConectadas?.has("__default__") ?? false) && onAdicionarApos ? (
            <button
              type="button"
              className="flow-node-add-btn"
              title={traduzir("O que acontece agora?")}
              onClick={(e) => {
                e.stopPropagation();
                onAdicionarApos(undefined, e.currentTarget.getBoundingClientRect());
              }}
            >
              +
            </button>
          ) : (saidasConectadas?.has("__default__") ?? false) && aoDesligarSaida ? (
            <button
              type="button"
              className="flow-node-add-btn flow-node-tirar-ligacao"
              title={traduzir("Tirar a ligação desta saída")}
              onClick={(e) => {
                e.stopPropagation();
                aoDesligarSaida(undefined);
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
