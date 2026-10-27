"use client";

import type { ReactNode } from "react";

import { horaDaMensagem } from "@/lib/conversas/hora-da-mensagem";
import type { ConvMensagem } from "@/lib/data";
import { AudioBubblePlayer } from "@/components/audio-player";
import { IconDoc, IconEscudo, IconImage, IconLocalizacao, IconVideoCam } from "@/components/icons";
import { StatusMensagemIcone } from "./StatusMensagem";
import { corDoAutor } from "@/lib/conversas/cor-do-autor";
import { traduzirRotuloDoSistema } from "@/lib/conversas/rotulos-do-sistema";
import { useIdioma } from "@/lib/idioma-context";

/**
 * Desenha UMA mensagem: em qualquer tela do CRM.
 *
 * Este é o único lugar que decide como uma mensagem se parece. Antes existiam duas
 * implementações: a tela de Conversas desenhava as bolhas inline (mais de 300 linhas, com dez
 * variantes no meio de sete mil) e o painel do Funil usava este componente. A mesma mensagem
 * aparecia diferente conforme a tela, e toda correção precisava ser feita duas vezes. Quando
 * alguém lembrava da segunda.
 *
 * O que é DESENHO mora aqui. O que é INTERAÇÃO DAQUELA TELA entra por props opcionais, com padrões
 * seguros: sem elas o componente funciona sozinho (é o caso do Funil), com elas ele ganha os
 * comportamentos da tela de Conversas (bloqueio de mídia pesada, visualizador de imagem, ficha do
 * contato, "Ler mais"). Misturar as duas coisas foi o que tornou o código antigo impossível de
 * reaproveitar.
 */
export function BolhaMensagem({
  msg,
  onTentarNovamente,
  chrome,
  chaveDom,
  velocidadeAudio,
  mostrarRemetenteGrupo = true,
  midiaLiberada,
  aoLiberarMidia,
  aoAbrirImagem,
  aoAbrirContato,
  renderizarTexto,
  aoResponderOpcao,
}: {
  msg: ConvMensagem;
  onTentarNovamente?: () => void;
  /** Menu, estrela e reação da tela de Conversas. Desenhados dentro da bolha, antes do conteúdo. */
  chrome?: ReactNode;
  /** Valor de `data-msg-chave`, usado pela tela de Conversas pra localizar a bolha no DOM. */
  chaveDom?: string;
  velocidadeAudio?: 1 | 1.5 | 2;
  mostrarRemetenteGrupo?: boolean;
  /** `false` esconde a mídia atrás de um botão. Economia de banda em conversa pesada. Padrão: mostra. */
  midiaLiberada?: (tipo: "imagem" | "video" | "documento", id?: string, url?: string) => boolean;
  aoLiberarMidia?: (id?: string) => void;
  /** Abre o visualizador de imagens. Sem isso, a imagem é só imagem. */
  aoAbrirImagem?: (urls: string[], indice: number) => void;
  aoAbrirContato?: (contato: NonNullable<ConvMensagem["contatoCompartilhado"]>) => void;
  /** Transforma o texto (links clicáveis, "Ler mais"). Padrão: texto puro. */
  renderizarTexto?: (texto: string) => ReactNode;
  /**
   * Clicou num botão que veio NA mensagem recebida (ver `msg.botoesRecebidos`).
   *
   * Opcional, e sem ela os botões viram etiquetas sem clique em vez de botões mortos: o painel do
   * Funil mostra a conversa mas não envia nada, e um botão que não faz nada ao ser clicado é pior
   * do que um botão que nem parece clicável.
   */
  aoResponderOpcao?: (botao: NonNullable<ConvMensagem["botoesRecebidos"]>[number]) => void;
}) {
  const { t: traduzir } = useIdioma();
  const liberada = (tipo: "imagem" | "video" | "documento") =>
    midiaLiberada ? midiaLiberada(tipo, msg.id, msg.imagens?.[0]?.url ?? msg.video?.url) : true;

  // O texto pode ser o que a PESSOA escreveu (sai como veio, sempre) ou uma frase que o próprio
  // CRM gravou no lugar de um anexo ("[Imagem]", "Você foi marcado em um story"). Só a segunda
  // passa pelo dicionário. Ver `rotulos-do-sistema.ts`.
  const textoCru = traduzirRotuloDoSistema(msg.texto, traduzir);
  const texto = renderizarTexto ? renderizarTexto(textoCru) : textoCru;

  if (msg.tipo === "system") {
    return (
      <div className="bubble sistema" data-msg-chave={chaveDom}>
        {textoCru}
      </div>
    );
  }

  /**
   * As opções que foram junto da mensagem, desenhadas como o contato as viu.
   *
   * Não são clicáveis de propósito: quem escolhe é o contato, no aparelho dele. Aqui é registro do
   * que saiu: clicar não faria nada e só geraria a expectativa de que faria.
   */
  const opcoesEnviadas = msg.botoes?.length ? (
    <div className="wa-bolha-opcoes" aria-label={traduzir("Opções enviadas com esta mensagem")}>
      {msg.botoes.map((rotulo, i) => (
        <span className="wa-bolha-opcao" key={`${rotulo}-${i}`}>
          {rotulo}
        </span>
      ))}
    </div>
  ) : null;

  /**
   * Quem escreveu, num grupo.
   *
   * ERA SÓ NO BALÃO DE TEXTO, e esse era o defeito: cada tipo de conteúdo tem o seu `return`, e o
   * nome do remetente estava escrito dentro do último deles. Áudio, imagem, figurinha, documento e
   * mídia ainda carregando saíam todos sem autor — num grupo de sete pessoas, um áudio chegava sem
   * dizer de quem era. É justamente na mídia que o nome faz mais falta: num texto dá pra deduzir
   * pelo assunto, num áudio não dá pra deduzir nada sem ouvir.
   *
   * Agora é uma const, igual ao `rodape`, e entra em todos os `return` — inclusive nos que ainda
   * vierem a existir, porque quem copiar um bloco existente leva as duas linhas junto.
   */
  const remetente =
    mostrarRemetenteGrupo && msg.tipo === "in" && msg.remetenteNome ? (
      // `data-autor` escolhe a cor; quem pinta é o CSS, que tem a paleta de cada tema. Ver
      // `corDoAutor`: a mesma pessoa cai sempre na mesma cor.
      <span className="wa-remetente-grupo" data-autor={corDoAutor(msg.remetenteNome)}>
        {msg.remetenteNome}
      </span>
    ) : null;

  /**
   * QUEM MANDOU É UMA CONTA COMERCIAL.
   *
   * No celular o WhatsApp diz isso com todas as letras ("esta empresa usa um serviço seguro da
   * Meta para gerenciar esta conversa") e desenha o cartão da empresa. No CRM a mesma mensagem
   * chegava com a cara de um cliente escrevendo — e quem atende decide o tom da resposta por essa
   * diferença.
   *
   * SÓ O QUE VEIO NO PAYLOAD. O nome aparece quando a Meta o verificou; quando não verificou,
   * sobra a afirmação que o formato da mensagem sustenta sozinho — que ela saiu de um sistema. O
   * cartão do celular (foto, seguidores, categoria) não chega aqui e por isso não é desenhado:
   * ver `mensagem-de-empresa.ts`.
   */
  const marcaDeEmpresa =
    msg.tipo === "in" && msg.contaComercial && typeof msg.contaComercial === "object" ? (
      <span
        className="wa-marca-empresa"
        title={traduzir("Mensagem enviada por uma conta comercial pela API de negócios da Meta.")}
      >
        <IconEscudo width={11} height={11} aria-hidden="true" />
        {msg.contaComercial.nome
          ? `${msg.contaComercial.nome} · ${traduzir("conta comercial verificada")}`
          : traduzir("Conta comercial · mensagem automática")}
      </span>
    ) : null;

  /**
   * OS BOTÕES QUE VIERAM NA MENSAGEM, pra responder com um clique.
   *
   * Diferente de `opcoesEnviadas` logo acima, que é registro do que o CRM MANDOU e por isso não
   * clica: aqui quem recebeu a pergunta é quem atende, e o clique é a resposta.
   *
   * Botão de link e de ligar saem como link de verdade — eles não respondem nada, levam a algum
   * lugar, e desenhá-los iguais ao de responder faria clicar em "Ver ingresso" parecer que mandou
   * uma mensagem escrita "Ver ingresso".
   */
  const opcoesParaResponder = Array.isArray(msg.botoesRecebidos) && msg.botoesRecebidos.length ? (
    <div className="wa-bolha-botoes" aria-label={traduzir("Opções de resposta desta mensagem")}>
      {msg.botoesRecebidos.map((botao, i) => {
        if (!botao || typeof botao.rotulo !== "string" || !botao.rotulo.trim()) return null;
        const chave = `${botao.rotulo}-${i}`;
        if (botao.url) {
          return (
            <a className="wa-bolha-botao link" key={chave} href={botao.url} target="_blank" rel="noopener noreferrer">
              {botao.rotulo}
            </a>
          );
        }
        if (botao.telefone) {
          return (
            <a className="wa-bolha-botao link" key={chave} href={`tel:${botao.telefone}`}>
              {botao.rotulo}
            </a>
          );
        }
        // Sem quem receba o clique (o painel do Funil), vira etiqueta: ver `aoResponderOpcao`.
        if (!aoResponderOpcao) {
          return (
            <span className="wa-bolha-opcao" key={chave}>
              {botao.rotulo}
            </span>
          );
        }
        return (
          <button
            type="button"
            className="wa-bolha-botao"
            key={chave}
            // O QUE VAI SAIR DAQUI, dito antes do clique. O CRM manda o TEXTO do botão, não a
            // resposta de botão do WhatsApp (a conexão por QR Code não tem como mandá-la). Quase
            // todo fluxo do outro lado aceita texto, porque precisa aceitar quem digita — mas
            // quem clica tem o direito de saber o que está mandando. Ver `responderComOpcao`.
            title={`${traduzir("Responder com")} "${botao.rotulo}"`}
            onClick={() => aoResponderOpcao(botao)}
          >
            {botao.rotulo}
          </button>
        );
      })}
    </div>
  ) : null;

  /** Hora + tiquinhos, o rodapé que toda bolha tem. */
  const rodape = (
    <>
      <span className="tm">
        {horaDaMensagem(msg)}
        {msg.tipo === "out" ? <StatusMensagemIcone status={msg.status} onTentarNovamente={onTentarNovamente} /> : null}
      </span>
      {/*
        O motivo da falha, com as palavras da Meta.
        
        FORA do `.tm`, e não dentro: `.tm` é a linha de hora e tiquinhos, um span em linha, e um
        bloco de duas linhas dentro dele escapava por cima da bolha em vez de empurrar a altura.
        Aqui ele é irmão, então a bolha cresce pra caber.
        
        O motivo é o que separa "a automação está quebrada" de "a janela de 24 horas fechou".
      */}
      {msg.tipo === "out" && msg.erroEnvio ? (
        <span className="msg-erro-motivo" title={msg.erroEnvio}>
          {msg.erroEnvio}
        </span>
      ) : null}
    </>
  );

  /**
   * Trecho citado quando a mensagem responde outra. Quando o que foi respondido era mídia. Foto,
   * story, reel), a miniatura entra ao lado do texto: sem ela a citação de uma foto aparecia
   * praticamente vazia, porque aquela mensagem não tinha texto nenhum pra citar.
   */
  const citacao = msg.respondendoA ? (
    <span className="wa-citacao">
      {msg.respondendoA.miniatura ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura já baixada e servida pelo CRM
        <img src={msg.respondendoA.miniatura} alt="" className="wa-citacao-thumb" />
      ) : null}
      <span className="wa-citacao-corpo">
        <span className="wa-citacao-autor">{msg.respondendoA.autor}</span>
        <span className="wa-citacao-texto">
          {msg.respondendoA.texto || traduzir(msg.respondendoA.tipoConteudo ?? "Mídia")}
        </span>
      </span>
    </span>
  ) : null;

  /** Cabeçalho do conteúdo compartilhado: tipo (STORY/REEL) e autor da publicação. */
  const topoDoShare =
    msg.tipoConteudo || msg.compartilhadoPor ? (
      <span className="bubble-share-topo">
        {msg.tipoConteudo ? <em className="bubble-tipo-conteudo">{traduzir(msg.tipoConteudo)}</em> : null}
        {msg.compartilhadoPor ?? null}
      </span>
    ) : null;

  /** Botão que abre a publicação (ou a conversa) no Instagram. */
  const botaoExterno = msg.linkExterno ? (
    <a className="bubble-acao-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
      {msg.linkEhConversa ? "Abrir conversa no Instagram ↗" : traduzir("Ver publicação no Instagram ↗")}
    </a>
  ) : null;

  const abrir = (classe: string) => ({
    className: `bubble ${msg.tipo} ${classe}`.trim(),
    "data-msg-chave": chaveDom,
  });

  // ----------------------------------------------------------------- localização
  if (msg.localizacao) {
    const { lat, lng, endereco } = msg.localizacao;
    return (
      <div {...abrir("bubble-localizacao")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        {citacao}
        <a
          className="bubble-localizacao-link-area"
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- mapa estático externo */}
          <img
            className="bubble-localizacao-mapa"
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=280x140&maptype=mapnik&markers=${lat},${lng},red-pushpin`}
            alt={traduzir("Mapa com a localização compartilhada")}
            loading="lazy"
          />
          <div className="bubble-localizacao-info">
            <span
              className="bubble-localizacao-titulo"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <IconLocalizacao width={12} height={12} /> {traduzir("Localização compartilhada")}
            </span>
            <span className="bubble-localizacao-endereco">
              {endereco ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </span>
            <span className="bubble-localizacao-link">{traduzir("Abrir no mapa →")}</span>
          </div>
        </a>
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ------------------------------------------------------------ contato compartilhado
  if (msg.contatoCompartilhado) {
    const ficha = (
      <>
        <span className="avatar">{msg.contatoCompartilhado.initials}</span>
        <span className="bubble-contato-info">
          <span className="bubble-contato-nome">{msg.contatoCompartilhado.nome}</span>
          {msg.contatoCompartilhado.whatsapp ? (
            <span className="bubble-contato-numero">{msg.contatoCompartilhado.whatsapp}</span>
          ) : null}
        </span>
      </>
    );
    return (
      <div {...abrir("bubble-contato")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        {citacao}
        {aoAbrirContato ? (
          <button type="button" className="bubble-contato-area" onClick={() => aoAbrirContato(msg.contatoCompartilhado!)}>
            {ficha}
          </button>
        ) : (
          // Sem o manipulador (Funil), o cartão é só leitura. Não um botão que não faz nada.
          <span className="bubble-contato-area" style={{ cursor: "default" }}>
            {ficha}
          </span>
        )}
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- imagens
  if (msg.imagens?.length) {
    return (
      <div {...abrir("bubble-midia")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        {topoDoShare}
        {liberada("imagem") ? (
          <div className={`bubble-imagens${msg.imagens.length > 1 ? " grade" : ""}`}>
            {msg.imagens.map((img, ix) =>
              // Publicação compartilhada: a miniatura é a porta pro Instagram, não uma foto pra
              // ampliar: o conteúdo (inclusive o carrossel inteiro) está lá, não aqui.
              msg.linkExterno ? (
                <a
                  key={`${msg.id}-img-${ix}`}
                  href={msg.linkExterno}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={traduzir("Abrir a publicação no Instagram")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM */}
                  <img src={img.url} alt={img.nome ?? "imagem"} loading="lazy" decoding="async" />
                </a>
              ) : aoAbrirImagem ? (
                <button
                  type="button"
                  key={`${msg.id}-img-${ix}`}
                  className="bubble-imagem-btn"
                  onClick={() => aoAbrirImagem(msg.imagens!.map((im) => im.url), ix)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM */}
                  <img src={img.url} alt={img.nome ?? "imagem"} loading="lazy" decoding="async" />
                </button>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM
                <img
                  key={`${msg.id}-img-${ix}`}
                  src={img.url}
                  alt={img.nome ?? "imagem"}
                  loading="lazy"
                  decoding="async"
                />
              ),
            )}
          </div>
        ) : (
          <button type="button" className="bubble-midia-bloqueada" onClick={() => aoLiberarMidia?.(msg.id)}>
            <IconImage width={18} height={18} />
            Baixar {msg.imagens.length > 1 ? "imagens" : "imagem"}
          </button>
        )}
        {msg.legendaPublicacao ? <p className="bubble-share-legenda">{msg.legendaPublicacao}</p> : null}
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {botaoExterno}
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- vídeo
  if (msg.video) {
    return (
      <div {...abrir("bubble-midia")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        {topoDoShare}
        {msg.linkExterno ? (
          // Vídeo que vive no Instagram: o CRM não guarda cópia, então o que existe é a porta pra
          // lá. "Baixar vídeo" aqui seria uma promessa falsa. Não há o que baixar.
          <a className="bubble-midia-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            <IconVideoCam width={18} height={18} />
            {msg.linkEhConversa ? "Abrir conversa no Instagram" : traduzir("Ver publicação no Instagram")}
          </a>
        ) : liberada("video") ? (
          <video className="bubble-video" src={msg.video.url} controls preload="metadata" muted={!msg.video.comAudio} />
        ) : (
          <button type="button" className="bubble-midia-bloqueada" onClick={() => aoLiberarMidia?.(msg.id)}>
            <IconVideoCam width={18} height={18} />
            {traduzir("Baixar vídeo")}
          </button>
        )}
        {msg.legendaPublicacao ? <p className="bubble-share-legenda">{msg.legendaPublicacao}</p> : null}
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {botaoExterno}
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- figurinha
  /* Figurinha não é foto: no WhatsApp ela aparece pequena, sem moldura e sem fundo de balão. Tratá-la
     como imagem comum daria um balão grande com um desenho minúsculo esticado dentro. */
  if (msg.figurinha) {
    return (
      <div {...abrir("bubble-figurinha")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bubble-figurinha-img" src={msg.figurinha.url} alt="Figurinha" />
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- documento
  if (msg.documento) {
    return (
      <div {...abrir("bubble-documento")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        <a
          className="bubble-documento-cartao"
          /*
            `baixar` faz o servidor pedir ao R2 que o arquivo venha como download, com este nome.
            O atributo `download` abaixo continua valendo pro formato antigo (anexo servido pelo
            próprio CRM); pro arquivo que vem do R2 ele é ignorado, porque é outro domínio, e sem
            o `baixar` o documento abriria numa aba sem nome nenhum.
          */
          href={`${msg.documento.url}${msg.documento.nome ? `&baixar=${encodeURIComponent(msg.documento.nome)}` : ""}`}
          download={msg.documento.nome}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="bubble-documento-icone">
            <IconDoc width={20} height={20} />
          </span>
          <span className="bubble-documento-info">
            <span className="bubble-documento-nome">{msg.documento.nome}</span>
            <span className="bubble-documento-meta">
              {msg.documento.formato} · {formatarTamanho(msg.documento.tamanho)}
            </span>
          </span>
        </a>
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ------------------------------------------------- mídia ainda sendo buscada
  if (msg.midiaPendente) {
    const pendente = msg.midiaPendente.tipo;
    const rotuloCarregando =
      pendente === "audio"
        ? "Carregando áudio…"
        : pendente === "imagem"
          ? "Carregando imagem…"
          : pendente === "figurinha"
            ? "Carregando figurinha…"
            : "Carregando documento…";
    return (
      <div {...abrir("")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        <span className="wa-carregar-midia">
          <span className="wa-participante-foto-carregando" />
          {rotuloCarregando}
        </span>
        <span className="tm">{horaDaMensagem(msg)}</span>
      </div>
    );
  }

  // ----------------------------------------------------------------- áudio
  if (msg.audio) {
    return (
      <div {...abrir("bubble-audio")}>
        {chrome}
        {remetente}
        {marcaDeEmpresa}
        <AudioBubblePlayer
          audio={msg.audio}
          tipo={msg.tipo === "in" ? "in" : "out"}
          velocidadeInicial={velocidadeAudio}
        />
        {opcoesParaResponder}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- texto
  return (
    <div {...abrir("")}>
      {chrome}
      {remetente}
      {marcaDeEmpresa}
      {citacao}
      {texto}
      {opcoesEnviadas}
      {botaoExterno}
      {opcoesParaResponder}
      {rodape}
    </div>
  );
}

/** Tamanho legível de arquivo. */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
