"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { conversas, type Funil, type NegocioCard } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import {
  CanalBadge,
  IconConfiguracoes,
  IconDoc,
} from "@/components/icons";
import { RadioList, Toggle, Topbar } from "@/components/ui";

/** Mesmo dia de referência usado em todo o app (ver `today` em lib/data.ts). */
const HOJE_ISO = "2026-07-30";

function localizarNoFunil(
  listaFunis: Funil[],
  nomeContato: string,
): { funilId: string; etapa: string } | null {
  for (const f of listaFunis) {
    for (const coluna of f.colunas) {
      if (coluna.cards.some((c) => c.nome === nomeContato)) {
        return { funilId: f.id, etapa: coluna.titulo };
      }
    }
  }
  return null;
}

export default function ConversasPage() {
  return (
    <Suspense fallback={null}>
      <ConversasPageInner />
    </Suspense>
  );
}

function ConversasPageInner() {
  const searchParams = useSearchParams();
  const { funis, atribuirContatoAoFunil } = useFunis();
  const { contatos, salvarDadosContato, atribuirAtendente } = useContatos();
  const [selectedId, setSelectedId] = useState(() => {
    const nomeContato = searchParams.get("contato");
    const encontrada = nomeContato
      ? conversas.find((c) => c.nome === nomeContato)
      : null;
    return (encontrada ?? conversas[0]).id;
  });
  const [infoAberto, setInfoAberto] = useState(false);

  const aberta = conversas.find((c) => c.id === selectedId) ?? conversas[0];
  const { tarefa } = aberta;
  const localizacao = localizarNoFunil(funis, aberta.nome);

  const contatoDaConversa = contatos.find((c) => c.nome === aberta.nome) ?? null;

  // Opções de atendente pra atribuir: as da conversa + quem já é responsável
  // por algum funil (todo funil novo vira uma opção automaticamente aqui).
  const nomesFunilAtendentes = funis
    .map((f) => f.responsavel)
    .filter((nome): nome is string => Boolean(nome));
  const opcoesAtendente = [
    ...aberta.atendentes,
    ...nomesFunilAtendentes
      .filter((nome) => !aberta.atendentes.some((a) => a.nome === nome))
      .map((nome) => ({ nome, papel: "Responsável por um funil" })),
  ];

  function etapaPadraoPara(funilId: string) {
    const f = funis.find((x) => x.id === funilId);
    return localizacao && localizacao.funilId === funilId
      ? localizacao.etapa
      : f?.colunas[0]?.titulo ?? "";
  }

  // Troca o funil/etapa/atendente/dados selecionados toda vez que a conversa
  // aberta muda, pra sempre abrir já mostrando as atribuições desse contato
  // (ajuste de estado a partir de uma mudança de prop — ver docs do React).
  const [funilSelecionadoId, setFunilSelecionadoId] = useState(
    () => localizacao?.funilId ?? funis[0]?.id ?? "",
  );
  const [etapaSelecionada, setEtapaSelecionada] = useState(() =>
    etapaPadraoPara(localizacao?.funilId ?? funis[0]?.id ?? ""),
  );
  const [atendenteSelecionado, setAtendenteSelecionado] = useState(
    aberta.atendenteSelecionado,
  );
  const [emailContato, setEmailContato] = useState(contatoDaConversa?.email ?? "");
  const [whatsappContato, setWhatsappContato] = useState(
    contatoDaConversa?.whatsapp ?? "",
  );
  const [nascimentoContato, setNascimentoContato] = useState(
    contatoDaConversa?.nascimento ?? "",
  );
  const [enderecoContato, setEnderecoContato] = useState(
    contatoDaConversa?.endereco ?? "",
  );
  const [abertaIdAnterior, setAbertaIdAnterior] = useState(aberta.id);
  if (aberta.id !== abertaIdAnterior) {
    setAbertaIdAnterior(aberta.id);
    const funilId = localizacao?.funilId ?? funis[0]?.id ?? "";
    setFunilSelecionadoId(funilId);
    setEtapaSelecionada(etapaPadraoPara(funilId));
    setAtendenteSelecionado(aberta.atendenteSelecionado);
    setEmailContato(contatoDaConversa?.email ?? "");
    setWhatsappContato(contatoDaConversa?.whatsapp ?? "");
    setNascimentoContato(contatoDaConversa?.nascimento ?? "");
    setEnderecoContato(contatoDaConversa?.endereco ?? "");
  }

  const funilSelecionado =
    funis.find((f) => f.id === funilSelecionadoId) ?? funis[0];

  function trocarFunilSelecionado(novoFunilId: string) {
    setFunilSelecionadoId(novoFunilId);
    setEtapaSelecionada(etapaPadraoPara(novoFunilId));
  }

  // Atendente e funil andam juntos: se a pessoa escolhida é responsável por
  // um funil, atribuir a ela já move o card pra esse funil — sem isso, dava
  // pra escolher o atendente e a atribuição salvar no funil errado.
  function escolherAtendente(nome: string) {
    setAtendenteSelecionado(nome);
    const funilDoAtendente = funis.find((f) => f.responsavel === nome);
    if (funilDoAtendente) {
      trocarFunilSelecionado(funilDoAtendente.id);
    }
  }

  function salvarDados() {
    salvarDadosContato(aberta.nome, {
      email: emailContato.trim() || undefined,
      whatsapp: whatsappContato.trim() || undefined,
      nascimento: nascimentoContato.trim() || undefined,
      endereco: enderecoContato.trim() || undefined,
    });
  }

  function salvarAtribuicao() {
    atribuirAtendente(aberta.nome, atendenteSelecionado);
    if (funilSelecionado && etapaSelecionada) {
      const cardExistente = funilSelecionado.colunas
        .flatMap((c) => c.cards)
        .find((c) => c.nome === aberta.nome);
      const novoCard: Omit<NegocioCard, "id"> & { id?: string } = {
        id: cardExistente?.id,
        nome: aberta.nome,
        valor: cardExistente?.valor ?? "—",
        origem: cardExistente?.origem ?? aberta.origem,
        dias: cardExistente?.dias ?? "Hoje",
        data: cardExistente?.data ?? HOJE_ISO,
      };
      atribuirContatoAoFunil(funilSelecionado.id, etapaSelecionada, novoCard);
    }
  }

  return (
    <>
      <Topbar
        title="WhatsApp"
        sub="WhatsApp, Instagram e TikTok — todas as conversas num só lugar"
        actions={
          <>
            <span className="fsel">Atendente: Todos ▾</span>
            <span className="fsel">Canal: Todos ▾</span>
          </>
        }
      />

      <div className="content wa-content">
        <aside className="wa-list">
          {conversas.map((c) => {
            const active = c.id === aberta.id;
            const last = c.mensagens[c.mensagens.length - 1];
            return (
              <button
                type="button"
                key={c.id}
                className={`wa-row${active ? " active" : ""}`}
                aria-pressed={active}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="cr1">
                  <span className="avatar">
                    {c.initials}
                    <CanalBadge canal={c.canal} />
                  </span>
                  <span className="cname">{c.nome}</span>
                  <span className="ctime">{c.tempo}</span>
                </span>
                <span className="cmsg">
                  {last.tipo === "out" ? "Você: " : ""}
                  {last.texto}
                </span>
                <span className="cr3">
                  <span className="tag">{c.status}</span>
                  <span className="tag wa-tag-origem">{c.origem}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="wa-main">
          <div className="open-conv-h">
            <div className="avatar">{aberta.initials}</div>
            <div>
              <p className="n">{aberta.nome}</p>
              <p className="s">
                {aberta.canal} · {aberta.contato}
              </p>
            </div>
            <button
              type="button"
              className={`gear-btn wa-main-gear${infoAberto ? " active" : ""}`}
              aria-pressed={infoAberto}
              aria-label="Ver atributos do contato"
              onClick={() => setInfoAberto((v) => !v)}
            >
              <IconConfiguracoes />
            </button>
          </div>

          <div className="chat-body">
            {aberta.mensagens.map((msg, i) => (
              <div className={`bubble ${msg.tipo}`} key={i}>
                {msg.texto}
                {msg.hora ? <span className="tm">{msg.hora}</span> : null}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <div className="box">Escrever mensagem…</div>
          </div>
        </section>

        {infoAberto ? (
        <aside className="wa-info">
          <div className="panel-h">
            <h4>Atribuir atendente</h4>
          </div>
          <RadioList
            key={aberta.id}
            options={opcoesAtendente.map((a) => ({
              nome: a.nome,
              descricao: a.papel,
            }))}
            initial={atendenteSelecionado}
            onChange={escolherAtendente}
          />

          <div className="panel-h divided">
            <h4>Dados do contato</h4>
          </div>
          <div className="field">
            <label>Nome</label>
            <div className="input">{aberta.nome}</div>
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="email"
              value={emailContato}
              onChange={(e) => setEmailContato(e.target.value)}
              placeholder="Peça e preencha aqui"
            />
          </div>
          <div className="field">
            <label>Número do WhatsApp</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={whatsappContato}
              onChange={(e) => setWhatsappContato(e.target.value)}
              placeholder="Ex.: (62) 9XXXX-XXXX"
            />
          </div>
          <div className="field">
            <label>Data de aniversário</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={nascimentoContato}
              onChange={(e) => setNascimentoContato(e.target.value)}
              placeholder="Ex.: 14/03/1990"
            />
          </div>
          <div className="field">
            <label>Endereço</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="text"
              value={enderecoContato}
              onChange={(e) => setEnderecoContato(e.target.value)}
              placeholder="Onde ele mora"
            />
          </div>
          <div className="section-foot">
            <button
              type="button"
              className="btn ghost block"
              onClick={salvarDados}
            >
              Salvar dados do contato
            </button>
          </div>

          <div className="panel-h divided">
            <h4>Atribuir ao funil</h4>
          </div>
          <div className="field">
            <label>Funil</label>
            <select
              className="input"
              style={{ width: "100%", cursor: "pointer" }}
              value={funilSelecionado?.id}
              onChange={(e) => trocarFunilSelecionado(e.target.value)}
            >
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          {funilSelecionado ? (
            <RadioList
              key={`funil-${aberta.id}-${funilSelecionado.id}`}
              options={funilSelecionado.colunas.map((coluna) => ({
                nome: coluna.titulo,
                descricao: `${coluna.total} contatos nessa etapa`,
              }))}
              initial={etapaSelecionada}
              onChange={setEtapaSelecionada}
            />
          ) : null}

          <div className="panel-h divided">
            <h4>Tarefa</h4>
          </div>
          <div className="field">
            <label>Data da tarefa</label>
            <div className="input">{tarefa.data}</div>
          </div>
          <div className="field">
            <label>O que fazer</label>
            <div className="input">{tarefa.oQueFazer}</div>
          </div>
          <div className="field">
            <label>Valor combinado</label>
            <div className="input">{tarefa.valor}</div>
          </div>
          {tarefa.anexo ? (
            <div className="field">
              <label>Anexo</label>
              <div className="attach-chip">
                <IconDoc />
                <span className="fn">{tarefa.anexo.arquivo}</span>
                <span className="fs">{tarefa.anexo.detalhe}</span>
              </div>
              <button type="button" className="btn ghost block mt14">
                + Anexar outro documento
              </button>
            </div>
          ) : (
            <div className="field">
              <label>Anexo</label>
              <button type="button" className="btn ghost block">
                + Anexar documento
              </button>
            </div>
          )}
          <div className="field">
            <label>Atribuir tarefa para</label>
            <div className="input">{tarefa.responsavel}</div>
          </div>

          <div className="toggle-row">
            <span className="tl">Avisar por WhatsApp perto do vencimento</span>
            <Toggle defaultOn label="Avisar por WhatsApp perto do vencimento" />
          </div>
          <div className="toggle-row">
            <span className="tl">Mostrar essa tarefa no portal do cliente</span>
            <Toggle defaultOn label="Mostrar essa tarefa no portal do cliente" />
          </div>

          <div className="section-foot">
            <button
              type="button"
              className="btn primary block"
              onClick={salvarAtribuicao}
            >
              Salvar atribuição e tarefa
            </button>
          </div>
        </aside>
        ) : null}
      </div>
    </>
  );
}
