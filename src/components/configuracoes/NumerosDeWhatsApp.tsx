"use client";

import { useCallback, useEffect, useState } from "react";

import { IconAlerta } from "@/components/icons";
import { ImportarConversas } from "./ImportarConversas";
import { SaudeQrCode } from "./SaudeQrCode";
import type { HistoricoSync } from "@/lib/integracoes/historico-tipos";
import { useEquipe } from "@/lib/equipe-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * OS NÚMEROS DE WHATSAPP DA EMPRESA, numa lista — os dois canais juntos.
 *
 * Até aqui o CRM tinha "o WhatsApp": um número, um botão de conectar, um de desconectar. Quem
 * vende com equipe não trabalha assim — a empresa tem o número principal na API oficial, a
 * vendedora tem o dela e o closer tem o dele, e os três precisam cair no mesmo CRM sem que as
 * conversas se misturem.
 *
 * O desenho é o dos CRMs que já resolveram isso (Kommo, Take, Zenvia): uma linha por número, com
 * NOME, número, estado e o que dá pra fazer com ele. O nome é o que faz a lista servir: com três
 * linhas de treze dígitos lado a lado, desconectar o número errado é questão de tempo.
 *
 * Cada linha também diz PRA ONDE VAI o que chega nela: em qual funil o lead nasce e quem atende.
 * Sem isso, dois vendedores no mesmo CRM dividem um quadro só e passam o dia separando na mão o
 * que é de quem.
 *
 * O canal OFICIAL aparece na lista, mas não se conecta nem se desconecta por aqui: ele tem o
 * cadastro da Meta por trás, e um botão "Conectar" ao lado dele prometeria um fluxo que não é
 * este. O que vale pros dois — nome, funil, responsável — vale pros dois.
 */

const CANAL_OFICIAL = "meta_whatsapp";

type Numero = {
  chave: string;
  provedor: string;
  slot: number;
  nome: string;
  apelido: string | null;
  numeroLegivel: string;
  status: string;
  erroMensagem: string | null;
  qrDataUrl: string | null;
  funilId: string | null;
  responsavel: string | null;
};

type Resposta = {
  numeros: Numero[];
  funis: { id: string; nome: string }[];
  limite: number;
  proximoLivre: number | null;
};

const ROTULO: Record<string, string> = {
  conectado: "Conectado",
  aguardando_qr: "Esperando o QR Code",
  desconectado: "Desconectado",
  erro: "Com erro",
};

export function NumerosDeWhatsApp({ aoMudar }: { aoMudar?: () => void }) {
  const { t: traduzir } = useIdioma();
  const { membros } = useEquipe();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [historicos, setHistoricos] = useState<Record<number, HistoricoSync>>({});

  /* Encadeada em vez de `async`: o `setDados` precisa cair num callback de promessa, e não no
     corpo do efeito — chamar `setState` direto dentro dele dispara renderização em cascata. */
  const carregar = useCallback(
    () =>
      fetch("/api/integracoes/numeros")
        .then((r) => r.json())
        .then((corpo: Resposta) => {
          if (corpo?.numeros) setDados(corpo);
        })
        .catch(() => undefined),
    [],
  );

  /*
   * O RITMO SEGUE O QUE ESTÁ ACONTECENDO.
   *
   * Enquanto alguém está com o celular na mão lendo um QR Code, a tela precisa virar pra
   * "Conectado" quase na hora. No resto do tempo a lista não muda por dias, e bater de quatro em
   * quatro segundos o dia inteiro é consulta ao banco sem ninguém olhando.
   */
  const esperandoQr = dados?.numeros.some((n) => n.status === "aguardando_qr") ?? false;
  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, esperandoQr ? 4000 : 30000);
    return () => clearInterval(intervalo);
  }, [carregar, esperandoQr]);

  async function conectar(alvo: number | "novo") {
    setOcupado(alvo);
    setErro(null);
    const r = await fetch("/api/integracoes/whatsapp-nao-oficial/conectar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alvo === "novo" ? { novo: true } : { slot: alvo }),
    }).catch(() => null);
    const corpo = (await r?.json().catch(() => null)) as { erro?: string } | null;
    if (!r?.ok) setErro(corpo?.erro ?? traduzir("Não deu pra conectar agora."));
    setOcupado(null);
    await carregar();
    aoMudar?.();
  }

  async function desconectar(slot: number, nome: string) {
    /*
     * Pergunta antes, e a pergunta diz o NOME do número.
     *
     * Desconectar derruba o atendimento de quem está atrás daquele número. Com uma lista de
     * vários, "tem certeza?" sem dizer qual é o convite para derrubar o errado.
     */
    const limpar = window.confirm(
      traduzir(
        `Desconectar "${nome}"?\n\nOK = desconectar e apagar as conversas que vieram deste WhatsApp · Cancelar = só desconectar, mantendo tudo.`,
      ),
    );
    setOcupado(slot);
    const r = await fetch("/api/integracoes/whatsapp-nao-oficial/desconectar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, limparDados: limpar }),
    }).catch(() => null);
    const corpo = (await r?.json().catch(() => null)) as { limpezaRecusada?: string | null } | null;
    // A limpeza é por canal, não por número: com outro ainda ligado ela não acontece, e quem
    // pediu precisa saber disso agora, não descobrir depois que as conversas continuam lá.
    if (corpo?.limpezaRecusada) setErro(corpo.limpezaRecusada);
    setOcupado(null);
    await carregar();
    aoMudar?.();
  }

  /** Nome, funil e responsável vão pela mesma rota: são a mesma decisão sobre a mesma conexão. */
  async function salvar(n: Numero, mudancas: { apelido?: string; funilId?: string | null; responsavel?: string | null }) {
    const r = await fetch("/api/integracoes/numeros", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provedor: n.provedor, slot: n.slot, ...mudancas }),
    }).catch(() => null);
    const corpo = (await r?.json().catch(() => null)) as { erro?: string } | null;
    if (!r?.ok) setErro(corpo?.erro ?? traduzir("Não deu pra salvar."));
    await carregar();
  }

  if (!dados) return <p className="hint" style={{ margin: 0 }}>{traduzir("Carregando os números…")}</p>;

  const cheio = dados.proximoLivre === null;
  const conectados = dados.numeros.filter((n) => n.status === "conectado").length;

  return (
    <div className="wa-numeros">
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
        </p>
      ) : null}

      {dados.numeros.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>{traduzir("Nenhum número conectado ainda.")}</p>
      ) : null}

      {dados.numeros.map((n) => {
        const id = `${n.provedor}:${n.slot}`;
        const ehOficial = n.provedor === CANAL_OFICIAL;
        return (
          <div key={id} className={`wa-numero${n.status === "conectado" ? " on" : ""}`}>
            <div className="wa-numero-linha">
              <span className={`wa-numero-ponto ${n.status}`} aria-hidden="true" />

              <div className="wa-numero-textos">
                {renomeando === id ? (
                  <input
                    className="input"
                    autoFocus
                    value={rascunho}
                    placeholder={traduzir("Ex.: Vendas — Marina")}
                    onChange={(e) => setRascunho(e.target.value)}
                    onBlur={() => {
                      setRenomeando(null);
                      void salvar(n, { apelido: rascunho });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenomeando(null);
                    }}
                    aria-label={traduzir("Nome deste número")}
                  />
                ) : (
                  <button
                    type="button"
                    className="wa-numero-nome"
                    onClick={() => {
                      setRascunho(n.apelido ?? "");
                      setRenomeando(id);
                    }}
                    title={traduzir("Dar um nome a este número")}
                  >
                    {n.nome}
                  </button>
                )}
                <span className="wa-numero-sub">
                  {n.numeroLegivel && n.numeroLegivel !== n.nome ? `${n.numeroLegivel} · ` : ""}
                  {ehOficial ? `${traduzir("API oficial")} · ` : ""}
                  {traduzir(ROTULO[n.status] ?? n.status)}
                </span>
              </div>

              <div className="wa-numero-acoes">
                {ehOficial ? (
                  // A conexão oficial não se liga nem se desliga daqui: ela vive no cadastro da
                  // Meta, e um botão aqui prometeria um fluxo que não é este.
                  <span className="hint">{traduzir("Gerenciado pela Meta")}</span>
                ) : n.status === "conectado" ? (
                  <>
                    <button type="button" className="btn ghost pequeno" onClick={() => setAberta(aberta === id ? null : id)}>
                      {aberta === id ? traduzir("Fechar") : traduzir("Detalhes")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost pequeno wa-desconectar"
                      disabled={ocupado === n.slot}
                      onClick={() => void desconectar(n.slot, n.nome)}
                    >
                      {ocupado === n.slot ? traduzir("Desconectando…") : traduzir("Desconectar")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn primary pequeno"
                    disabled={ocupado === n.slot}
                    onClick={() => void conectar(n.slot)}
                  >
                    {ocupado === n.slot ? traduzir("Gerando QR Code…") : traduzir("Conectar")}
                  </button>
                )}
              </div>
            </div>

            {/*
              * PRA ONDE VAI O QUE CHEGA POR AQUI.
              *
              * Fica na linha, e não escondido em "Detalhes", porque é a pergunta que se faz NO
              * momento de conectar um número novo — "e os leads dele, caem onde?". Escondida, a
              * resposta viraria uma descoberta de semanas depois, com o funil já embaralhado.
              */}
            {n.status === "conectado" ? (
              <div className="wa-numero-destino">
                <label className="wa-numero-campo">
                  <span className="flow-rotulo-micro">{traduzir("Funil dos leads")}</span>
                  <select
                    className="input"
                    value={n.funilId ?? ""}
                    onChange={(e) => void salvar(n, { funilId: e.target.value || null })}
                  >
                    <option value="">{traduzir("O funil padrão da conta")}</option>
                    {dados.funis.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </label>

                <label className="wa-numero-campo">
                  <span className="flow-rotulo-micro">{traduzir("Responsável")}</span>
                  <select
                    className="input"
                    value={n.responsavel ?? ""}
                    onChange={(e) => void salvar(n, { responsavel: e.target.value || null })}
                  >
                    <option value="">{traduzir("Ninguém em especial")}</option>
                    {membros.map((m) => (
                      <option key={m.id} value={m.nome}>{m.nome}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {n.erroMensagem ? (
              <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
                <IconAlerta width={12} height={12} aria-hidden="true" /> {n.erroMensagem}
              </p>
            ) : null}

            {n.qrDataUrl ? (
              <div className="wa-numero-qr">
                {/* Fundo branco explícito: o PNG da Evolution é TRANSPARENTE, e sem isso o card
                    azulado do CRM aparece por trás e o leitor do celular não reconhece o código. */}
                <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL gerado na hora pela Evolution, não é asset */}
                  <img src={n.qrDataUrl} alt={traduzir("QR Code de conexão do WhatsApp")} width={180} height={180} />
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  {traduzir("Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.")}
                </p>
              </div>
            ) : null}

            {aberta === id ? (
              <div className="wa-numero-detalhes">
                {/* O diagnóstico e a importação são DESTE número: cada celular tem a conexão e a
                    fila dele. Antes eram painéis da empresa, e com dois números passariam a
                    responder pelo número errado. */}
                <SaudeQrCode slot={n.slot} />
                <ImportarConversas
                  slot={n.slot}
                  conectada
                  historico={historicos[n.slot]}
                  aoMudar={(h) => setHistoricos((atual) => ({ ...atual, [n.slot]: h }))}
                />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="wa-numeros-rodape">
        <button
          type="button"
          className="btn ghost"
          disabled={cheio || ocupado === "novo"}
          onClick={() => void conectar("novo")}
        >
          {ocupado === "novo"
            ? traduzir("Gerando QR Code…")
            : dados.numeros.length === 0
              ? traduzir("Conectar um número")
              : traduzir("Conectar outro número")}
        </button>
        <span className="hint">
          {cheio
            ? traduzir("Limite de {n} números atingido.", { n: String(dados.limite) })
            : traduzir("{usados} de {limite} números", {
                usados: String(conectados),
                limite: String(dados.limite),
              })}
        </span>
      </div>
    </div>
  );
}
