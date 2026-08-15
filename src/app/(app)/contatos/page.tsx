"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { classeOrigem, oportunidadesPerdidas, filtrosContatos, type Canal } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useFunis } from "@/lib/funis-context";
import { useTarefas } from "@/lib/tarefas-context";
import { PAISES } from "@/lib/configuracoes/mock";
import { IconClose, IconSearch, IconWhatsApp } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { gerarLinhaDoTempo } from "@/lib/timeline";

const CANAIS_PREFERIDOS = ["WhatsApp", "Instagram", "TikTok"] as const;

export default function ContatosPage() {
  return (
    <Suspense fallback={null}>
      <ContatosPageInner />
    </Suspense>
  );
}

/** Campos de texto/select simples cadastrados na ficha do contato — mesmo conjunto usado no
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
  return (
    <div className="config-grid-2">
      <div className="field">
        <label>Sobrenome</label>
        <input className="input" value={valores.sobrenome} onChange={(e) => onChange({ sobrenome: e.target.value })} />
      </div>
      <div className="field">
        <label>Empresa</label>
        <input className="input" value={valores.empresa} onChange={(e) => onChange({ empresa: e.target.value })} />
      </div>
      <div className="field">
        <label>Cargo</label>
        <input className="input" value={valores.cargo} onChange={(e) => onChange({ cargo: e.target.value })} />
      </div>
      <div className="field">
        <label>Telefone fixo</label>
        <input className="input" value={valores.telefoneFixo} onChange={(e) => onChange({ telefoneFixo: e.target.value })} />
      </div>
      <div className="field">
        <label>Cidade</label>
        <input className="input" value={valores.cidade} onChange={(e) => onChange({ cidade: e.target.value })} />
      </div>
      <div className="field">
        <label>Estado</label>
        <input className="input" value={valores.estado} onChange={(e) => onChange({ estado: e.target.value })} />
      </div>
      <div className="field">
        <label>País</label>
        <select className="input" value={valores.pais} onChange={(e) => onChange({ pais: e.target.value })}>
          <option value="">Selecione…</option>
          {PAISES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Canal preferido</label>
        <select className="input" value={valores.canalPreferido} onChange={(e) => onChange({ canalPreferido: e.target.value })}>
          <option value="">Selecione…</option>
          {CANAIS_PREFERIDOS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Melhor horário pra contato</label>
        <input
          className="input"
          value={valores.melhorHorario}
          onChange={(e) => onChange({ melhorHorario: e.target.value })}
          placeholder="Ex.: Tardes, depois das 14h"
        />
      </div>
    </div>
  );
}

function ContatosPageInner() {
  const searchParams = useSearchParams();
  const { data: sessao } = useSession();
  const nomeUsuario = sessao?.user?.name ?? "";
  const { contatos, criarContato, atualizarContato, excluirContato } = useContatos();
  const { conversas } = useConversas();
  const { mensagensExtraPorContato } = useMensagensExtra();
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
  const [extrasNovo, setExtrasNovo] = useState<CamposExtras>(CAMPOS_EXTRAS_VAZIOS);
  const [filtroOrigem, setFiltroOrigem] = useState(filtrosContatos[0]);

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

  const contatosFiltrados = contatos.filter((c) => {
    if (filtroOrigem === "Todos") return true;
    if (filtroOrigem === "Meus leads") return c.responsavel === nomeUsuario;
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
                Fechar <IconClose width={11} height={11} />
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
            <CamposExtrasFieldset valores={extrasNovo} onChange={(patch) => setExtrasNovo((prev) => ({ ...prev, ...patch }))} />
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

        <div className="mb14">
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
                {contato.whatsapp ? (
                  <a
                    href={`/conversas?contato=${encodeURIComponent(contato.nome)}`}
                    className="btn primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <IconWhatsApp width={14} height={14} /> Enviar WhatsApp
                  </a>
                ) : null}
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
                Fechar <IconClose width={11} height={11} />
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
                <CamposExtrasFieldset valores={extrasEdit} onChange={(patch) => setExtrasEdit((prev) => ({ ...prev, ...patch }))} />
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
                <div className="config-grid-2">
                  <div className="field">
                    <label>Sobrenome</label>
                    <div className="input">{contato.sobrenome || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Empresa</label>
                    <div className="input">{contato.empresa || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Cargo</label>
                    <div className="input">{contato.cargo || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Telefone fixo</label>
                    <div className="input">{contato.telefoneFixo || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Cidade</label>
                    <div className="input">{contato.cidade || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Estado</label>
                    <div className="input">{contato.estado || "—"}</div>
                  </div>
                  <div className="field">
                    <label>País</label>
                    <div className="input">{contato.pais || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Canal preferido</label>
                    <div className="input">{contato.canalPreferido || "—"}</div>
                  </div>
                  <div className="field">
                    <label>Melhor horário pra contato</label>
                    <div className="input">{contato.melhorHorario || "—"}</div>
                  </div>
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
                mensagensPorContato: mensagensExtraPorContato,
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
