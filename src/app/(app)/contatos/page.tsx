"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { classeOrigem, conversas, oportunidadesPerdidas, currentUser, filtrosContatos } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import { useTarefas } from "@/lib/tarefas-context";
import { IconSearch } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { gerarLinhaDoTempo } from "@/lib/timeline";

export default function ContatosPage() {
  return (
    <Suspense fallback={null}>
      <ContatosPageInner />
    </Suspense>
  );
}

function ContatosPageInner() {
  const searchParams = useSearchParams();
  const { contatos, criarContato, atualizarContato, excluirContato } = useContatos();
  const { funis } = useFunis();
  const { colunas: tarefas } = useTarefas();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [novoContatoAberto, setNovoContatoAberto] = useState(
    () => searchParams.get("novoContato") === "1",
  );
  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [whatsappNovo, setWhatsappNovo] = useState("");
  const [nascimentoNovo, setNascimentoNovo] = useState("");
  const [enderecoNovo, setEnderecoNovo] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState(filtrosContatos[0]);

  const [editandoContato, setEditandoContato] = useState(false);
  const [emailEdit, setEmailEdit] = useState("");
  const [whatsappEdit, setWhatsappEdit] = useState("");
  const [nascimentoEdit, setNascimentoEdit] = useState("");
  const [enderecoEdit, setEnderecoEdit] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  function abrirEdicao() {
    if (!contato) return;
    setEmailEdit(contato.email ?? "");
    setWhatsappEdit(contato.whatsapp ?? "");
    setNascimentoEdit(contato.nascimento ?? "");
    setEnderecoEdit(contato.endereco ?? "");
    setEditandoContato(true);
  }

  function salvarEdicao() {
    if (!contato) return;
    atualizarContato(contato.id, {
      email: emailEdit.trim() || undefined,
      whatsapp: whatsappEdit.trim() || undefined,
      nascimento: nascimentoEdit.trim() || undefined,
      endereco: enderecoEdit.trim() || undefined,
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

  const contatosFiltrados = contatos.filter((c) => {
    if (filtroOrigem === "Todos") return true;
    if (filtroOrigem === "Meus leads") return c.responsavel === currentUser.name;
    return c.origem === filtroOrigem;
  });

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
    });
    setNomeNovo("");
    setEmailNovo("");
    setWhatsappNovo("");
    setNascimentoNovo("");
    setEnderecoNovo("");
    setNovoContatoAberto(false);
  }

  return (
    <>
      <Topbar
        title="Contatos"
        sub={
          filtroOrigem === "Todos"
            ? `${contatos.length} contatos · visão 360° de cada lead`
            : `${contatosFiltrados.length} de ${contatos.length} contatos · filtrado por ${filtroOrigem}`
        }
        actions={
          <>
            <label className="search">
              <IconSearch />
              <input placeholder="Buscar contato…" aria-label="Buscar contato" />
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
                <p className="n">Novo contato</p>
                <p className="s">
                  Esses dados também podem ser preenchidos depois, direto na
                  conversa dele no WhatsApp
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoContatoAberto(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Nome</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Ex.: Marina Costa"
              />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="email"
                value={emailNovo}
                onChange={(e) => setEmailNovo(e.target.value)}
                placeholder="Ex.: marina@email.com"
              />
            </div>
            <div className="field">
              <label>Número do WhatsApp</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={whatsappNovo}
                onChange={(e) => setWhatsappNovo(e.target.value)}
                placeholder="Ex.: (62) 9XXXX-XXXX"
              />
            </div>
            <div className="field">
              <label>Data de aniversário</label>
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
              <label>Endereço</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={enderecoNovo}
                onChange={(e) => setEnderecoNovo(e.target.value)}
                placeholder="Onde ele mora"
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={salvarNovoContato}
              >
                Criar contato
              </button>
            </div>
          </section>
        ) : null}

        <ChipFilters
          options={filtrosContatos}
          initial={0}
          onChange={(v) => setFiltroOrigem(v)}
        />

        <div className="card mb14">
          <div className="table-wrap">
            <table className="tbl contatos-tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Origem</th>
                  <th>Etapa</th>
                  <th>Responsável</th>
                  <th>Última interação</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {contatosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="hint" style={{ padding: 17 }}>
                        Nenhum contato nessa origem ainda.
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
                    <td>{c.responsavel}</td>
                    <td>{c.ultima}</td>
                    <td>{c.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {contato ? (
          <section className="open-conv">
            <div className="open-conv-h">
              <div className="avatar">{contato.initials}</div>
              <div>
                <p className="n">{contato.nome}</p>
                <p className="s">
                  {contato.origem} · última interação {contato.ultima.toLowerCase()}
                </p>
              </div>
              <div className="filters-row" style={{ margin: "0 0 0 auto" }}>
                {!editandoContato ? (
                  <button type="button" className="btn ghost" onClick={abrirEdicao}>
                    Editar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmandoExclusao(true)}
                >
                  Excluir
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
                Fechar ✕
              </span>
            </div>

            {confirmandoExclusao ? (
              <div className="field" style={{ background: "var(--danger-soft)", borderRadius: "var(--radius-md)", padding: 12, margin: "0 17px 14px" }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--danger)" }}>
                  Excluir {contato.nome}? Essa ação não pode ser desfeita.
                </p>
                <div className="filters-row" style={{ margin: 0 }}>
                  <button type="button" className="btn danger" onClick={confirmarExclusao}>
                    Excluir contato
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setConfirmandoExclusao(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>Funil</label>
              <div className="input">
                {noFunil ? noFunil.funil : "Ainda não entrou em nenhum funil"}
              </div>
            </div>
            <div className="field">
              <label>Etapa no funil</label>
              <div className="input">{noFunil ? noFunil.etapa : "—"}</div>
            </div>
            <div className="field">
              <label>Origem</label>
              <div className="input">{contato.origem}</div>
            </div>
            <div className="field">
              <label>Responsável</label>
              <div className="input">{contato.responsavel}</div>
            </div>
            <div className="field">
              <label>Valor</label>
              <div className="input">{contato.valor}</div>
            </div>
            {editandoContato ? (
              <>
                <div className="field">
                  <label>E-mail</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="email"
                    value={emailEdit}
                    onChange={(e) => setEmailEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Número do WhatsApp</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={whatsappEdit}
                    onChange={(e) => setWhatsappEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Data de aniversário</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={nascimentoEdit}
                    onChange={(e) => setNascimentoEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Endereço</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="text"
                    value={enderecoEdit}
                    onChange={(e) => setEnderecoEdit(e.target.value)}
                  />
                </div>
                <div className="filters-row" style={{ padding: "0 17px 14px" }}>
                  <button type="button" className="btn primary" onClick={salvarEdicao}>
                    Salvar alterações
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setEditandoContato(false)}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>E-mail</label>
                  <div className="input">{contato.email || "—"}</div>
                </div>
                <div className="field">
                  <label>Número do WhatsApp</label>
                  <div className="input">{contato.whatsapp || "—"}</div>
                </div>
                <div className="field">
                  <label>Data de aniversário</label>
                  <div className="input">{contato.nascimento || "—"}</div>
                </div>
                <div className="field">
                  <label>Endereço</label>
                  <div className="input">{contato.endereco || "—"}</div>
                </div>
              </>
            )}

            <div className="panel-h divided">
              <h4>Linha do tempo</h4>
              <a href={`/jornada-cliente?contato=${contato.id}`} className="link">
                Ver jornada completa
              </a>
            </div>
            <Timeline
              eventos={gerarLinhaDoTempo(contato.id, {
                contatos,
                conversas,
                tarefas,
                funis,
                oportunidadesPerdidas,
              })}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
