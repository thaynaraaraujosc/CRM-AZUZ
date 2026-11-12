"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import {
  canalDoNumero,
  precisaEscolherNumero,
  type NumeroConectado,
} from "@/lib/conversas/numeros-conectados";
import { useSearchParams } from "next/navigation";

import { classeOrigem, filtrosContatos, type Canal } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useFunis } from "@/lib/funis-context";
import { PAISES } from "@/lib/configuracoes/mock";
import { IconClose, IconSearch, IconWhatsApp } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";
import { OrigemDoLead } from "@/components/contatos/OrigemDoLead";
import { ConversoesDoLead } from "@/components/contatos/ConversoesDoLead";
import { RenomearOrigem } from "@/components/contatos/RenomearOrigem";
import { Timeline } from "@/components/timeline";
import { gerarLinhaDoTempo } from "@/lib/timeline";
import { rotuloDeAtividade } from "@/lib/funis/atividade";
import { VAZIO, ehVazio } from "@/lib/vazio";
import { ORDENS, ordenarContatos, origemNoFiltro, type OrdemContatos } from "@/lib/contatos/ordenacao";
import { contatoApareceEmContatos, contatoEsperaNome } from "@/lib/contatos/salvos";

/** O rótulo da aba de quem conversou e ainda não tem nome. Ver `contatoEsperaNome`. */
const FILTRO_SEM_NOME = "Sem nome";
import { formatarTelefoneParaExibicao } from "@/lib/telefone";
import { useIdioma } from "@/lib/idioma-context";

const CANAIS_PREFERIDOS = ["WhatsApp", "Instagram"] as const;

export default function ContatosPage() {
  return (
    <Suspense fallback={null}>
      <ContatosPageInner />
    </Suspense>
  );
}

/** Campos de texto/select simples cadastrados na ficha do contato. Mesmo conjunto usado no
 * painel de detalhes da conversa (`conversas/page.tsx`), agora também editável direto por aqui em
 * vez de só dentro de uma conversa aberta. */
type CamposExtras = {
  sobrenome: string;
  empresa: string;
  cargo: string;
  telefoneFixo: string;
  cidade: string;
  estado: string;
  pais: string;
  canalPreferido: string;
  melhorHorario: string;
};

const CAMPOS_EXTRAS_VAZIOS: CamposExtras = {
  sobrenome: "",
  empresa: "",
  cargo: "",
  telefoneFixo: "",
  cidade: "",
  estado: "",
  pais: "",
  canalPreferido: "",
  melhorHorario: "",
};

function CamposExtrasFieldset({
  valores,
  onChange,
}: {
  valores: CamposExtras;
  onChange: (patch: Partial<CamposExtras>) => void;
}) {
  const { t: traduzir } = useIdioma();
  return (
    <div className="config-grid-2">
      <div className="field">
        <label>{traduzir("Sobrenome")}</label>
        <input className="input" value={valores.sobrenome} onChange={(e) => onChange({ sobrenome: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Empresa")}</label>
        <input className="input" value={valores.empresa} onChange={(e) => onChange({ empresa: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Cargo")}</label>
        <input className="input" value={valores.cargo} onChange={(e) => onChange({ cargo: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Telefone fixo")}</label>
        <input className="input" value={valores.telefoneFixo} onChange={(e) => onChange({ telefoneFixo: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Cidade")}</label>
        <input className="input" value={valores.cidade} onChange={(e) => onChange({ cidade: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Estado")}</label>
        <input className="input" value={valores.estado} onChange={(e) => onChange({ estado: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("País")}</label>
        <select className="input" value={valores.pais} onChange={(e) => onChange({ pais: e.target.value })}>
          <option value="">{traduzir("Selecione…")}</option>
          {PAISES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{traduzir("Canal preferido")}</label>
        <select className="input" value={valores.canalPreferido} onChange={(e) => onChange({ canalPreferido: e.target.value })}>
          <option value="">{traduzir("Selecione…")}</option>
          {CANAIS_PREFERIDOS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{traduzir("Melhor horário pra contato")}</label>
        <input
          className="input"
          value={valores.melhorHorario}
          onChange={(e) => onChange({ melhorHorario: e.target.value })}
          placeholder={traduzir("Ex.: Tardes, depois das 14h")}
        />
      </div>
    </div>
  );
}

function ContatosPageInner() {
  const { t: traduzir } = useIdioma();
  const searchParams = useSearchParams();
  const { contatos, criarContato, atualizarContato, excluirContato } = useContatos();
  const { conversas } = useConversas();
  /* "Última interação" era o campo `ultima`, uma string gravada como "Agora" quando o contato
     nasce e nunca mais atualizada: a lista inteira dizia "Agora", inclusive contato de semanas
     atrás. Mesmo defeito que o funil tinha na coluna de dias, e mesma correção: calcular na hora
     a partir da última mensagem real. `ultimaMensagemEm` e não `atualizadoEm`, porque o segundo
     sobe a cada escrita na conversa e uma importação deixaria todo mundo com cara de recente. */
  const atividadePorNome = useMemo(
    () => new Map(conversas.map((c) => [c.nome, c.ultimaMensagemEm ?? null])),
    [conversas],
  );
  const { mensagensExtraPorContato } = useMensagensExtra();
  const { funis } = useFunis();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  /*
   * OS NÚMEROS DE WHATSAPP DA EMPRESA, pro botão "Enviar WhatsApp" saber se há o que escolher.
   *
   * "Às vezes eu tenho vários números de QR Code instalado, então é pra eu escolher." Com um
   * número só, a pergunta não existe e o botão continua levando direto pra conversa — perguntar
   * "por qual dos um?" é um clique a mais pra ninguém.
   */
  const [numerosConectados, setNumerosConectados] = useState<NumeroConectado[]>([]);
  /** De qual contato o seletor de número está aberto. */
  const [escolhendoNumero, setEscolhendoNumero] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/integracoes/numeros")
      .then((r) => (r.ok ? r.json() : { numeros: [] }))
      .then((dados: { numeros?: NumeroConectado[] }) => {
        if (vivo) setNumerosConectados(dados.numeros ?? []);
      })
      .catch(() => {
        /* Sem a lista, o botão volta a levar direto pra conversa: é o comportamento de sempre. */
      });
    return () => {
      vivo = false;
    };
  }, []);
  const [novoContatoAberto, setNovoContatoAberto] = useState(
    () => searchParams.get("novoContato") === "1",
  );
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [whatsappNovo, setWhatsappNovo] = useState("");
  const [nascimentoNovo, setNascimentoNovo] = useState("");
  const [enderecoNovo, setEnderecoNovo] = useState("");
  const [extrasNovo, setExtrasNovo] = useState<CamposExtras>(CAMPOS_EXTRAS_VAZIOS);
  const [filtroOrigem, setFiltroOrigem] = useState(filtrosContatos[0]);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemContatos>("az");

  const [editandoContato, setEditandoContato] = useState(false);
  const [emailEdit, setEmailEdit] = useState("");
  const [whatsappEdit, setWhatsappEdit] = useState("");
  const [nascimentoEdit, setNascimentoEdit] = useState("");
  const [enderecoEdit, setEnderecoEdit] = useState("");
  const [extrasEdit, setExtrasEdit] = useState<CamposExtras>(CAMPOS_EXTRAS_VAZIOS);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  function abrirEdicao() {
    if (!contato) return;
    setEmailEdit(contato.email ?? "");
    setWhatsappEdit(contato.whatsapp ?? "");
    setNascimentoEdit(contato.nascimento ?? "");
    setEnderecoEdit(contato.endereco ?? "");
    setExtrasEdit({
      sobrenome: contato.sobrenome ?? "",
      empresa: contato.empresa ?? "",
      cargo: contato.cargo ?? "",
      telefoneFixo: contato.telefoneFixo ?? "",
      cidade: contato.cidade ?? "",
      estado: contato.estado ?? "",
      pais: contato.pais ?? "",
      canalPreferido: contato.canalPreferido ?? "",
      melhorHorario: contato.melhorHorario ?? "",
    });
    setEditandoContato(true);
  }

  function salvarEdicao() {
    if (!contato) return;
    atualizarContato(contato.id, {
      email: emailEdit.trim() || undefined,
      whatsapp: whatsappEdit.trim() || undefined,
      nascimento: nascimentoEdit.trim() || undefined,
      endereco: enderecoEdit.trim() || undefined,
      sobrenome: extrasEdit.sobrenome.trim() || undefined,
      empresa: extrasEdit.empresa.trim() || undefined,
      cargo: extrasEdit.cargo.trim() || undefined,
      telefoneFixo: extrasEdit.telefoneFixo.trim() || undefined,
      cidade: extrasEdit.cidade.trim() || undefined,
      estado: extrasEdit.estado.trim() || undefined,
      pais: extrasEdit.pais.trim() || undefined,
      canalPreferido: (extrasEdit.canalPreferido.trim() || undefined) as Canal | undefined,
      melhorHorario: extrasEdit.melhorHorario.trim() || undefined,
    });
    setEditandoContato(false);
  }

  function confirmarExclusao() {
    if (!contato) return;
    excluirContato(contato.id);
    setSelecionado(null);
    setConfirmandoExclusao(false);
  }

  const contato = contatos.find((c) => c.nome === selecionado) ?? null;

  /*
   * Filtro por canal e BUSCA são independentes e se somam.
   *
   * Buscar "Maria" com o filtro em Instagram procura Maria só entre os contatos do Instagram; com
   * o filtro em Todos, procura em todo mundo. O campo de busca existia na barra de cima mas não
   * estava ligado a nada: era uma caixa que aceitava texto e não fazia diferença nenhuma.
   *
   * A busca olha nome, @ do Instagram, WhatsApp e e-mail. Telefone é comparado só por dígito, pra
   * "9 8888-7777", "988887777" e "+55 11 98888-7777" acharem a mesma pessoa.
   */
  // Quantos estão esperando nome. Fica fora do `useMemo` do filtro porque não depende dele: é a
  // conta da aba, e ela precisa estar certa mesmo quando a aba aberta é outra.
  const esperandoNome = useMemo(() => contatos.filter(contatoEsperaNome).length, [contatos]);

  /* A aba só existe enquanto há fila. Esvaziou com ela aberta (alguém batizou o último número),
     a tela volta pra "Todos" — senão ficaria uma lista vazia sem nenhuma aba acesa, e sem nada
     explicando por quê. Ajustado na renderização, não num efeito. */
  if (filtroOrigem === FILTRO_SEM_NOME && esperandoNome === 0) setFiltroOrigem(filtrosContatos[0]);

  const contatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    const filtrados = contatos.filter((c) => {
      /**
       * CONTATOS É A LISTA DE DISPARO.
       *
       * "Os contatos que entram em contato com a gente, as pessoas que conversam com a gente, os
       * números que a gente salva manualmente, tudo tem que aparecer aqui, porque é as pessoas
       * que a gente vai fazer disparo. A Lidiane mandou mensagem, já salva o número dela."
       *
       * Duas condições, as duas dela: tem telefone (senão não recebe disparo — "apenas os números
       * de WhatsApp") e tem nome (senão "a gente não sabe pra quem tá enviando"). A regra mora em
       * `salvos.ts`, com teste; aqui só se aplica.
       *
       * A ABA "SEM NOME" é a exceção, e existe pra número nenhum sumir em silêncio: quem conversou
       * mas o WhatsApp não deu nome de perfil fica ali, esperando batismo.
       */
      if (filtroOrigem === FILTRO_SEM_NOME) {
        if (!contatoEsperaNome(c)) return false;
      } else {
        if (!contatoApareceEmContatos(c)) return false;
        if (!(filtroOrigem === "Todos" || origemNoFiltro(c.origem) === filtroOrigem)) return false;
      }
      if (!termo) return true;

      const campos = [c.nome, c.instagram, c.email].filter(Boolean).map((t) => String(t).toLowerCase());
      if (campos.some((t) => t.includes(termo))) return true;

      // Só compara telefone quando o termo TEM dígito: senão "ana" casaria com qualquer número,
      // porque a string vazia está contida em tudo.
      if (digitos && c.whatsapp && String(c.whatsapp).replace(/\D/g, "").includes(digitos)) return true;
      return false;
    });

    return ordenarContatos(filtrados, ordem);
  }, [contatos, filtroOrigem, busca, ordem]);

  function localizarNoFunilAtual(nomeContato: string) {
    for (const f of funis) {
      for (const coluna of f.colunas) {
        if (coluna.cards.some((c) => c.nome === nomeContato)) {
          return { funil: f.nome, etapa: coluna.titulo };
        }
      }
    }
    return null;
  }

  const noFunil = contato ? localizarNoFunilAtual(contato.nome) : null;

  function salvarNovoContato() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    criarContato({
      nome,
      email: emailNovo.trim() || undefined,
      whatsapp: whatsappNovo.trim() || undefined,
      nascimento: nascimentoNovo.trim() || undefined,
      endereco: enderecoNovo.trim() || undefined,
      sobrenome: extrasNovo.sobrenome.trim() || undefined,
      empresa: extrasNovo.empresa.trim() || undefined,
      cargo: extrasNovo.cargo.trim() || undefined,
      telefoneFixo: extrasNovo.telefoneFixo.trim() || undefined,
      cidade: extrasNovo.cidade.trim() || undefined,
      estado: extrasNovo.estado.trim() || undefined,
      pais: extrasNovo.pais.trim() || undefined,
      canalPreferido: (extrasNovo.canalPreferido.trim() || undefined) as Canal | undefined,
      melhorHorario: extrasNovo.melhorHorario.trim() || undefined,
    });
    setNomeNovo("");
    setEmailNovo("");
    setWhatsappNovo("");
    setNascimentoNovo("");
    setEnderecoNovo("");
    setExtrasNovo(CAMPOS_EXTRAS_VAZIOS);
    setNovoContatoAberto(false);
  }

  return (
    <>
      <Topbar
        title={traduzir("Contatos")}
        actions={
          <>
            <label className="search">
              <IconSearch />
              <input
                placeholder={traduzir("Buscar nome, @, telefone ou e-mail…")}
                aria-label={traduzir("Buscar contato")}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn primary"
              onClick={() => setNovoContatoAberto((v) => !v)}
            >
              {novoContatoAberto ? "Cancelar" : "+ Novo contato"}
            </button>
          </>
        }
      />

      <div className="content">
        {novoContatoAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">{traduzir("Novo contato")}</p>
                <p className="s">{traduzir("Esses dados também podem ser preenchidos depois, direto na conversa dele no WhatsApp")}</p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoContatoAberto(false)}
              >
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </span>
            </div>
            <div className="field">
              <label>{traduzir("Nome")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder={traduzir("Ex.: Marina Costa")}
              />
            </div>
            <div className="field">
              <label>{traduzir("E-mail")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="email"
                value={emailNovo}
                onChange={(e) => setEmailNovo(e.target.value)}
                placeholder={traduzir("Ex.: marina@email.com")}
              />
            </div>
            <div className="field">
              <label>{traduzir("Número do WhatsApp")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={whatsappNovo}
                onChange={(e) => setWhatsappNovo(e.target.value)}
                placeholder={traduzir("Ex.: (62) 9XXXX-XXXX")}
              />
            </div>
            <div className="field">
              <label>{traduzir("Data de aniversário")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nascimentoNovo}
                onChange={(e) => setNascimentoNovo(e.target.value)}
                placeholder="Ex.: 14/03/1990"
              />
            </div>
            <div className="field">
              <label>{traduzir("Endereço")}</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={enderecoNovo}
                onChange={(e) => setEnderecoNovo(e.target.value)}
                placeholder={traduzir("Onde ele mora")}
              />
            </div>
            <CamposExtrasFieldset valores={extrasNovo} onChange={(patch) => setExtrasNovo((prev) => ({ ...prev, ...patch }))} />
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={salvarNovoContato}
              >
                {traduzir("Criar contato")}
              </button>
            </div>
          </section>
        ) : null}

        {/* Some sozinho quando não há mais nada com a origem antiga. */}
        <RenomearOrigem aoRenomear={() => window.location.reload()} />

        <div className="contatos-barra">
          {/*
            A FILA DE BATISMO ENTRA COMO ABA, com a conta na frente.

            "Se não tiver nome, não coloque aqui em contato." Tirar da lista é o pedido — mas
            apagar da tela seria outra coisa: o número existe, conversou, e vai ser preciso um dia.
            Como aba ele fica fora da lista de disparo e a um clique de ganhar nome. A aba só
            aparece quando há alguém nela: aba vazia é ruído permanente.
          */}
          <ChipFilters
            options={esperandoNome > 0 ? [...filtrosContatos, `${FILTRO_SEM_NOME} (${esperandoNome})`] : filtrosContatos}
            initial={0}
            onChange={(v) => setFiltroOrigem(v.startsWith(FILTRO_SEM_NOME) ? FILTRO_SEM_NOME : v)}
          />
          <label className="contatos-ordenar">
            <span>{traduzir("Ordenar por")}</span>
            <select className="input" value={ordem} onChange={(e) => setOrdem(e.target.value as OrdemContatos)}>
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {traduzir(o.label)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb14">
          <div className="table-wrap">
            <table className="tbl contatos-tbl">
              <thead>
                <tr>
                  <th>{traduzir("Nome")}</th>
                  <th>{traduzir("Origem")}</th>
                  <th>{traduzir("Etapa")}</th>
                  <th>{traduzir("Responsável")}</th>
                  <th>{traduzir("Última interação")}</th>
                  <th>{traduzir("Valor")}</th>
                </tr>
              </thead>
              <tbody>
                {contatosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="hint" style={{ padding: 17 }}>
                        {busca.trim()
                          ? traduzir("Nenhum contato encontrado com esse termo.")
                          : filtroOrigem === FILTRO_SEM_NOME
                            ? traduzir("Nenhum número esperando nome. Todo mundo que conversou já está identificado.")
                            : traduzir("Nenhum contato nessa origem ainda.")}
                      </p>
                    </td>
                  </tr>
                ) : null}
                {contatosFiltrados.map((c) => (
                  <tr key={c.nome}>
                    <td>
                      <button
                        type="button"
                        className="name-cell"
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelecionado((atual) => (atual === c.nome ? null : c.nome));
                          setEditandoContato(false);
                          setConfirmandoExclusao(false);
                        }}
                      >
                        <div className="avatar">{c.initials}</div>
                        <span
                          className="n"
                          style={{
                            color:
                              selecionado === c.nome ? "var(--blue)" : undefined,
                          }}
                        >
                          {c.nome}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`origin-tag ${classeOrigem(c.origem)}`}>
                        {c.origem}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`stage-tag${
                          c.etapa === "Fechado" ? " won" : ""
                        }`}
                      >
                        {c.etapa}
                      </span>
                    </td>
                    <td>{ehVazio(c.responsavel) ? VAZIO : c.responsavel}</td>
                    <td>{rotuloDeAtividade(atividadePorNome.get(c.nome) ?? c.criadoEm)}</td>
                    <td>{ehVazio(c.valor) ? VAZIO : c.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/*
          PAINEL LATERAL, e não uma seção no fim da página.
          Antes o detalhe do contato era renderizado ABAIXO da tabela: clicar numa linha no meio de
          uma lista longa não mudava nada na tela visível, e a pessoa precisava descobrir sozinha
          que havia algo lá embaixo. Quem compra o CRM não vai descobrir. O véu escurece a lista e
          fecha ao clique, que é o comportamento que todo mundo já espera de um painel.
        */}
        {contato ? <div className="contato-veu" onClick={() => setSelecionado(null)} aria-hidden="true" /> : null}
        {contato ? (
          <section className="open-conv contato-painel" role="dialog" aria-label={`Contato ${contato.nome}`}>
            <div className="open-conv-h">
              <div className="avatar">{contato.initials}</div>
              {/* Só o nome. "Salvo manualmente · última interação 03/09" dizia duas coisas que
                  ninguém abre um contato pra ler: a origem já está na lista, e a data da última
                  conversa está na linha do tempo logo abaixo. */}
              <div>
                <p className="n">{contato.nome}</p>
              </div>
              <div className="filters-row" style={{ margin: "0 0 0 auto" }}>
                {contato.whatsapp ? (
                  /*
                    POR QUAL NÚMERO, ANTES DE ABRIR A CONVERSA.
                    
                    "Na hora que eu clico em enviar mensagem, antes de me levar pro chat, é pra ele
                    abrir: por onde que é pra mandar essa mensagem?" É a hora certa de perguntar —
                    depois de aberto o chat, a escolha já está feita por quem recebeu a conversa, e
                    trocar vira correção em vez de decisão.
                    
                    Com UM número conectado, nada disso aparece: o botão leva direto, como sempre.
                    Perguntar "por qual dos um?" é um clique a mais pra ninguém.
                  */
                  <div className="ct-enviar-caixa" data-menu-de-linha="">
                    <button
                      type="button"
                      className="btn primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      aria-expanded={escolhendoNumero === contato.nome}
                      onClick={() => {
                        if (!precisaEscolherNumero(numerosConectados)) {
                          window.location.href = `/conversas?contato=${encodeURIComponent(contato.nome)}`;
                          return;
                        }
                        setEscolhendoNumero((atual) => (atual === contato.nome ? null : contato.nome));
                      }}
                    >
                      <IconWhatsApp width={14} height={14} /> {traduzir("Enviar WhatsApp")}
                    </button>
                    {escolhendoNumero === contato.nome ? (
                      <div className="ct-enviar-menu" role="menu">
                        <p className="ct-enviar-titulo">{traduzir("Enviar por qual número?")}</p>
                        {numerosConectados
                          .filter((n) => n.status === "conectado" && n.chave)
                          .map((n) => (
                            <a
                              key={n.chave}
                              role="menuitem"
                              className="ct-enviar-item"
                              href={`/conversas?contato=${encodeURIComponent(contato.nome)}&numero=${encodeURIComponent(n.chave)}`}
                            >
                              <strong>{n.apelido?.trim() || n.numeroLegivel || n.nome}</strong>
                              <span>
                                {traduzir(canalDoNumero(n.provedor))}
                                {n.apelido?.trim() && n.numeroLegivel ? ` · ${n.numeroLegivel}` : ""}
                              </span>
                            </a>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!editandoContato ? (
                  <button type="button" className="btn ghost" onClick={abrirEdicao}>
                    {traduzir("Editar")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmandoExclusao(true)}
                >
                  {traduzir("Excluir")}
                </button>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setSelecionado(null);
                  setEditandoContato(false);
                  setConfirmandoExclusao(false);
                }}
              >
                {traduzir("Fechar")} <IconClose width={11} height={11} />
              </span>
            </div>

            {contato.id ? <OrigemDoLead contatoId={contato.id} /> : null}
            {/* Logo embaixo da origem de propósito: "de onde veio" e "o que já foi devolvido pra
                lá" são a mesma conversa, e separá-las obrigaria a procurar a segunda. */}
            {contato.id ? <ConversoesDoLead contatoId={contato.id} /> : null}

            {confirmandoExclusao ? (
              <div className="field" style={{ background: "var(--danger-soft)", borderRadius: "var(--radius-md)", padding: 12, margin: "0 17px 14px" }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--danger)" }}>
                  Excluir {contato.nome}? Essa ação não pode ser desfeita.
                </p>
                <div className="filters-row" style={{ margin: 0 }}>
                  <button type="button" className="btn danger" onClick={confirmarExclusao}>
                    {traduzir("Excluir contato")}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setConfirmandoExclusao(false)}>
                    {traduzir("Cancelar")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>{traduzir("Funil")}</label>
              <div className="input">
                {noFunil ? noFunil.funil : traduzir("Ainda não entrou em nenhum funil")}
              </div>
            </div>
            <div className="field">
              <label>{traduzir("Etapa no funil")}</label>
              <div className="input">{noFunil ? noFunil.etapa : "-"}</div>
            </div>
            <div className="field">
              <label>{traduzir("Origem")}</label>
              <div className="input">{contato.origem}</div>
            </div>
            <div className="field">
              <label>{traduzir("Responsável")}</label>
              <div className="input">{contato.responsavel}</div>
            </div>
            <div className="field">
              <label>{traduzir("Valor")}</label>
              <div className="input">{contato.valor}</div>
            </div>
            {editandoContato ? (
              <>
                <div className="field">
                  <label>{traduzir("E-mail")}</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="email"
                    value={emailEdit}
                    onChange={(e) => setEmailEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>{traduzir("Número do WhatsApp")}</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={whatsappEdit}
                    onChange={(e) => setWhatsappEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>{traduzir("Data de aniversário")}</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={nascimentoEdit}
                    onChange={(e) => setNascimentoEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>{traduzir("Endereço")}</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={enderecoEdit}
                    onChange={(e) => setEnderecoEdit(e.target.value)}
                  />
                </div>
                <CamposExtrasFieldset valores={extrasEdit} onChange={(patch) => setExtrasEdit((prev) => ({ ...prev, ...patch }))} />
                <div className="filters-row" style={{ padding: "0 17px 14px" }}>
                  <button type="button" className="btn primary" onClick={salvarEdicao}>
                    {traduzir("Salvar alterações")}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setEditandoContato(false)}>
                    {traduzir("Cancelar")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>{traduzir("E-mail")}</label>
                  <div className="input">{contato.email || "-"}</div>
                </div>
                <div className="field">
                  <label>{traduzir("Número do WhatsApp")}</label>
                  {/* Formatado, e não os dígitos crus: "41984877482" não se lê nem se confere, e
                      cliente de fora do Brasil aparecia como uma sequência de doze dígitos sem um
                      espaço. `formatarTelefoneParaExibicao` devolve null no que não é telefone, e
                      aí o valor aparece como está em vez de virar um número inventado. */}
                  <div className="input">
                    {(contato.whatsapp && formatarTelefoneParaExibicao(contato.whatsapp)) || contato.whatsapp || "-"}
                  </div>
                </div>
                <div className="field">
                  <label>{traduzir("Data de aniversário")}</label>
                  <div className="input">{contato.nascimento || "-"}</div>
                </div>
                <div className="field">
                  <label>{traduzir("Endereço")}</label>
                  <div className="input">{contato.endereco || "-"}</div>
                </div>
                <div className="config-grid-2">
                  <div className="field">
                    <label>{traduzir("Sobrenome")}</label>
                    <div className="input">{contato.sobrenome || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Empresa")}</label>
                    <div className="input">{contato.empresa || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Cargo")}</label>
                    <div className="input">{contato.cargo || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Telefone fixo")}</label>
                    <div className="input">{contato.telefoneFixo || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Cidade")}</label>
                    <div className="input">{contato.cidade || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Estado")}</label>
                    <div className="input">{contato.estado || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("País")}</label>
                    <div className="input">{contato.pais || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Canal preferido")}</label>
                    <div className="input">{contato.canalPreferido || "-"}</div>
                  </div>
                  <div className="field">
                    <label>{traduzir("Melhor horário pra contato")}</label>
                    <div className="input">{contato.melhorHorario || "-"}</div>
                  </div>
                </div>
              </>
            )}

            <div className="panel-h divided">
              <h4>{traduzir("Linha do tempo")}</h4>
              <a href={`/jornada-cliente?contato=${contato.id}`} className="link">
                {traduzir("Ver jornada completa")}
              </a>
            </div>
            <Timeline
              eventos={gerarLinhaDoTempo(contato.id, {
                contatos,
                conversas,
                mensagensPorContato: mensagensExtraPorContato,
                funis,
              })}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
