"use client";

import type { ConvMensagem } from "@/lib/data";
import { IconLocalizacao } from "@/components/icons";
import { StatusMensagemIcone } from "./StatusMensagem";

/**
 * Desenha UMA mensagem — texto, imagem, vídeo, documento, áudio ou localização.
 *
 * Primeiro passo da extração do painel de conversa em componentes reaproveitáveis. Hoje a tela de
 * Conversas desenha as bolhas inline, com dez variantes espalhadas no meio de 7 mil linhas, e o
 * popup do Funil desenhava só `msg.texto` — então uma foto, um PDF ou um áudio apareciam como
 * bolha vazia pra quem respondia pelo Funil, que é justamente onde o vendedor mais responde.
 *
 * Aqui mora só o DESENHO. Menu de ações, curtida, favorito e seleção continuam na tela de
 * Conversas: são interações daquela tela, não da mensagem em si — misturar as duas coisas foi o
 * que tornou aquele trecho impossível de reaproveitar.
 */
export function BolhaMensagem({
  msg,
  onTentarNovamente,
}: {
  msg: ConvMensagem;
  onTentarNovamente?: () => void;
}) {
  if (msg.tipo === "system") {
    return <div className="bubble sistema">{msg.texto}</div>;
  }

  /** Hora + tiquinhos, o rodapé que toda bolha tem. */
  const rodape = (
    <span className="tm">
      {msg.hora}
      {msg.tipo === "out" ? <StatusMensagemIcone status={msg.status} onTentarNovamente={onTentarNovamente} /> : null}
    </span>
  );

  /** Trecho citado quando a mensagem responde outra — mesmo desenho da tela de Conversas. */
  const citacao = msg.respondendoA ? (
    <span className="wa-citacao">
      <span className="wa-citacao-autor">{msg.respondendoA.autor}</span>
      <span className="wa-citacao-texto">{msg.respondendoA.texto}</span>
    </span>
  ) : null;

  /** A reação que a pessoa (ou você) deixou, grudada na bolha. */
  const reacao =
    msg.reacaoContato || msg.reacaoMinha ? (
      <span className="wa-msg-reacao">
        {msg.reacaoContato ?? msg.reacaoMinha}
        {msg.reacaoContato && msg.reacaoMinha ? <span className="wa-msg-reacao-2">❤️</span> : null}
      </span>
    ) : null;

  // Localização: cartão com prévia do mapa, e não uma linha de texto com um emoji. O mapa estático
  // vem do OpenStreetMap — sem chave de API, sem custo, sem dependência nova.
  if (msg.localizacao) {
    const { lat, lng, endereco } = msg.localizacao;
    return (
      <div className={`bubble ${msg.tipo} bubble-localizacao`}>
        {reacao}
        {citacao}
        <a
          className="bubble-localizacao-link-area"
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- mapa estático externo, sem otimização do Next */}
          <img
            className="bubble-localizacao-mapa"
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=280x140&maptype=mapnik&markers=${lat},${lng},red-pushpin`}
            alt="Mapa com a localização compartilhada"
          />
          <div className="bubble-localizacao-info">
            <span className="bubble-localizacao-titulo" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconLocalizacao width={12} height={12} /> Localização compartilhada
            </span>
            <span className="bubble-localizacao-endereco">
              {endereco ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </span>
            <span className="bubble-localizacao-link">Abrir no mapa →</span>
          </div>
        </a>
        {rodape}
      </div>
    );
  }

  // Contato compartilhado — cartão com iniciais e número, igual à tela de Conversas.
  if (msg.contatoCompartilhado) {
    return (
      <div className={`bubble ${msg.tipo} bubble-contato`}>
        {reacao}
        {citacao}
        <span className="bubble-contato-area" style={{ cursor: "default" }}>
          <span className="avatar">{msg.contatoCompartilhado.initials}</span>
          <span className="bubble-contato-info">
            <span className="bubble-contato-nome">{msg.contatoCompartilhado.nome}</span>
            {msg.contatoCompartilhado.whatsapp ? (
              <span className="bubble-contato-numero">{msg.contatoCompartilhado.whatsapp}</span>
            ) : null}
          </span>
        </span>
        {rodape}
      </div>
    );
  }

  const legenda = msg.legenda ?? (msg.texto || undefined);

  if (msg.imagens?.length) {
    // Conteúdo que vive no Instagram (post, reel, story): a miniatura é a porta pra publicação.
    // Sem isso a prévia era decorativa — dava contexto e não levava a lugar nenhum.
    const imagens = msg.imagens.map((img, i) => {
      // eslint-disable-next-line @next/next/no-img-element
      // `lazy` porque uma conversa antiga pode ter dezenas de fotos: sem isso, abrir a conversa
      // dispara o download de todas de uma vez, mesmo as que estão muito acima da rolagem.
      const figura = (
        <img
          key={i}
          src={img.url}
          alt={img.nome ?? "imagem"}
          className="bubble-imagem"
          loading="lazy"
          decoding="async"
        />
      );
      return msg.linkExterno ? (
        <a key={i} href={msg.linkExterno} target="_blank" rel="noopener noreferrer" title="Abrir no Instagram">
          {figura}
        </a>
      ) : (
        figura
      );
    });
    return (
      <div className={`bubble ${msg.tipo} bubble-midia`}>
        {/* Cabeçalho do cartão de publicação, no formato que o Instagram usa: quem compartilhou em
            cima, a prévia no meio, o texto embaixo. Sem ele, uma imagem solta no meio da conversa
            não diz se é uma foto da pessoa ou uma publicação que ela encaminhou. */}
        {msg.tipoConteudo || msg.compartilhadoPor ? (
          <span className="bubble-share-topo">
            {msg.tipoConteudo ? <em className="bubble-tipo-conteudo">{msg.tipoConteudo}</em> : null}
            {msg.compartilhadoPor ?? null}
          </span>
        ) : null}
        <span className={`bubble-imagens${msg.imagens.length > 1 ? " grade" : ""}`}>{imagens}</span>
        {msg.legendaPublicacao ? (
          <span className="bubble-share-legenda">{msg.legendaPublicacao}</span>
        ) : null}
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        {msg.linkExterno ? (
          <a className="bubble-acao-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            {msg.linkEhConversa ? "Abrir conversa no Instagram ↗" : "Ver publicação no Instagram ↗"}
          </a>
        ) : null}
        {rodape}
      </div>
    );
  }

  if (msg.video) {
    // Vídeo que vive no Instagram: o CRM não guarda cópia, então o que existe é a porta pra lá.
    if (msg.linkExterno) {
      return (
        <div className={`bubble ${msg.tipo} bubble-midia`}>
          <a className="bubble-midia-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            ▶ {msg.linkEhConversa ? "Abrir conversa no Instagram" : "Ver publicação no Instagram"}
          </a>
          {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
          {rodape}
        </div>
      );
    }
    return (
      <div className={`bubble ${msg.tipo} bubble-midia`}>
        <video className="bubble-video" src={msg.video.url} controls preload="metadata" />
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        {rodape}
      </div>
    );
  }

  if (msg.audio) {
    return (
      <div className={`bubble ${msg.tipo} bubble-audio`}>
        <audio src={msg.audio.url} controls preload="metadata" style={{ maxWidth: "100%" }} />
        {rodape}
      </div>
    );
  }

  if (msg.documento) {
    return (
      <div className={`bubble ${msg.tipo} bubble-documento`}>
        <a
          href={msg.documento.url}
          target="_blank"
          rel="noopener noreferrer"
          download={msg.documento.nome}
          className="bubble-doc-link"
        >
          <span className="bubble-doc-nome">{msg.documento.nome}</span>
          <span className="bubble-doc-meta">{msg.documento.formato}</span>
        </a>
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        {rodape}
      </div>
    );
  }

  return (
    <div className={`bubble ${msg.tipo}`}>
      {reacao}
      {citacao}
      {/* Nome de quem escreveu DENTRO de um grupo — sem isso não dá pra distinguir os balões. */}
      {msg.tipo === "in" && msg.remetenteNome ? (
        <span className="wa-remetente-grupo">{msg.remetenteNome}</span>
      ) : null}
      {msg.texto}
      {rodape}
    </div>
  );
}
