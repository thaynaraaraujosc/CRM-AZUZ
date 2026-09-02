"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  CATEGORIAS_COMPROMISSO,
  compromissosConflitantes,
  compromissosDeTarefas,
  HOJE_ISO,
  useAgenda,
  type CategoriaCompromisso,
  type Compromisso,
} from "@/lib/agenda-context";
import { useTarefas } from "@/lib/tarefas-context";
import { useContatos } from "@/lib/contatos-context";
import { useEquipe } from "@/lib/equipe-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import { Topbar, Drawer } from "@/components/ui";
import { IconAlerta } from "@/components/icons";
import { SeletorDeData } from "@/components/seletor-de-data";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDe(ano: number, mesIndex0: number, dia: number) {
  return `${ano}-${pad2(mesIndex0 + 1)}-${pad2(dia)}`;
}

function categoriaRotulo(categoria?: CategoriaCompromisso) {
  return CATEGORIAS_COMPROMISSO.find((c) => c.valor === categoria)?.rotulo ?? "Outro";
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatarDataCurta(dataIso: string) {
  const [, m, d] = dataIso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/** Formato "d mmm" (ex.: "28 jul") — mesma heurística de `TaskCard.data` usada por
 * `compromissosDeTarefas`, pra uma tarefa criada aqui continuar aparecendo na Agenda depois. */
function formatarDataTarefa(dataIso: string) {
  const [, m, d] = dataIso.split("-").map(Number);
  return `${d} ${MESES_ABREV[m - 1]}`;
}

type FormCompromisso = {
  categoria: CategoriaCompromisso;
  titulo: string;
  contatoBusca: string;
  contatoId: string | undefined;
  contatoNome: string;
  responsavel: string;
  dataIso: string;
  hora: string;
  horaFim: string;
  local: string;
  descricao: string;
};

function formVazio(dataIso: string, responsavelPadrao: string): FormCompromisso {
  return {
    categoria: "outro",
    titulo: "",
    contatoBusca: "",
    contatoId: undefined,
    contatoNome: "",
    responsavel: responsavelPadrao,
    dataIso,
    hora: "09:00",
    horaFim: "",
    local: "",
    descricao: "",
  };
}

export default function AgendaPage() {
  const router = useRouter();
  const { colunas, criarTarefa } = useTarefas();
  const { contatos } = useContatos();
  const { mensagensExtraPorContato } = useMensagensExtra();
  const { membros } = useEquipe();
  const {
    compromissos,
    criarAgendamento,
    editarAgendamento,
    reagendar,
    cancelar,
    concluir,
  } = useAgenda();

  const { data: sessao } = useSession();
  const responsavelPadrao = membros[0]?.nome ?? sessao?.user?.name ?? "";

  const [ano, setAno] = useState(() => Number(HOJE_ISO.split("-")[0]));
  const [mesIndex0, setMesIndex0] = useState(() => Number(HOJE_ISO.split("-")[1]) - 1);
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const [maisAberto, setMaisAberto] = useState<{ dataIso: string; anchor: AnchorRect } | null>(null);
  const { ref: maisRef, posicao: maisPos } = useFloatingPosition(maisAberto?.anchor ?? null, !!maisAberto, 8, () => setMaisAberto(null));

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormCompromisso>(() => formVazio(HOJE_ISO, responsavelPadrao));
  const [conflitos, setConflitos] = useState<Compromisso[]>([]);
  const [forcarSalvar, setForcarSalvar] = useState(false);

  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [reagendarAberto, setReagendarAberto] = useState(false);
  const [reagendarData, setReagendarData] = useState({ dataIso: "", hora: "", horaFim: "" });
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [enviarMensagemCancelamento, setEnviarMensagemCancelamento] = useState(false);

  const [toasts, setToasts] = useState<{ id: string; texto: string }[]>([]);
  const proximoToastId = useRef(0);

  function avisar(texto: string) {
    const id = `toast-${proximoToastId.current++}`;
    setToasts((prev) => [...prev, { id, texto }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const compromissosManuais = compromissos.filter((c) => c.status !== "cancelado");
  const compromissosAutomaticos = compromissosDeTarefas(colunas, ano);

  const todosCompromissos = useMemo(
    () => [...compromissosManuais, ...compromissosAutomaticos],
    [compromissosManuais, compromissosAutomaticos],
  );

  const compromissosFiltrados = useMemo(
    () =>
      todosCompromissos.filter((c) => {
        if (filtroResponsavel !== "todos" && c.responsavel !== filtroResponsavel) return false;
        if (filtroCategoria !== "todas") {
          if (filtroCategoria === "tarefa") {
            if (c.origem !== "tarefa") return false;
          } else if ((c.categoria ?? "outro") !== filtroCategoria || c.origem === "tarefa") {
            return false;
          }
        }
        return true;
      }),
    [todosCompromissos, filtroResponsavel, filtroCategoria],
  );

  function eventosDoDia(dataIso: string) {
    return compromissosFiltrados
      .filter((c) => c.dataIso === dataIso)
      .sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));
  }

  const compromissoDetalhe = detalheId ? compromissos.find((c) => c.id === detalheId) ?? null : null;

  function irParaHoje() {
    const [anoHoje, mesHoje] = HOJE_ISO.split("-").map(Number);
    setAno(anoHoje);
    setMesIndex0(mesHoje - 1);
    setDiaSelecionado(HOJE_ISO);
    setView((v) => (v === "lista" ? "lista" : "mes"));
  }

  function mudarMes(delta: number) {
    let novoMes = mesIndex0 + delta;
    let novoAno = ano;
    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }
    setMesIndex0(novoMes);
    setAno(novoAno);
    setDiaSelecionado(null);
  }

  function abrirNovo(dataIso?: string) {
    setEditandoId(null);
    setForm(formVazio(dataIso ?? diaSelecionado ?? HOJE_ISO, responsavelPadrao));
    setConflitos([]);
    setForcarSalvar(false);
    setFormAberto(true);
  }

  function abrirEdicao(c: Compromisso) {
    setEditandoId(c.id);
    setForm({
      categoria: c.categoria ?? "outro",
      titulo: c.tipo,
      contatoBusca: c.contato && c.contato !== "—" ? c.contato : "",
      contatoId: c.contatoId,
      contatoNome: c.contato && c.contato !== "—" ? c.contato : "",
      responsavel: c.responsavel,
      dataIso: c.dataIso,
      hora: c.hora,
      horaFim: c.horaFim ?? "",
      local: c.local ?? "",
      descricao: c.descricao ?? "",
    });
    setConflitos([]);
    setForcarSalvar(false);
    setDetalheId(null);
    setFormAberto(true);
  }

  function salvarForm(forcar = forcarSalvar) {
    const titulo = form.titulo.trim();
    if (!titulo || !form.dataIso || !form.hora) return;

    if (!forcar) {
      const encontrados = compromissosConflitantes(compromissos, {
        dataIso: form.dataIso,
        hora: form.hora,
        horaFim: form.horaFim || undefined,
        responsavel: form.responsavel,
        ignorarId: editandoId ?? undefined,
      });
      if (encontrados.length > 0) {
        setConflitos(encontrados);
        return;
      }
    }

    const dados = {
      contato: form.contatoNome || "—",
      contatoId: form.contatoId,
      responsavel: form.responsavel,
      dataIso: form.dataIso,
      hora: form.hora,
      horaFim: form.horaFim || undefined,
      tipo: titulo,
      categoria: form.categoria,
      descricao: form.descricao.trim() || undefined,
      local: form.local.trim() || undefined,
    };

    if (editandoId) {
      editarAgendamento(editandoId, dados);
      avisar("Compromisso atualizado.");
    } else {
      criarAgendamento(dados);
      avisar("Compromisso criado.");
    }
    setFormAberto(false);
    setConflitos([]);
    setForcarSalvar(false);
  }

  const contatosFiltrados = useMemo(() => {
    const termo = form.contatoBusca.trim().toLowerCase();
    if (!termo || form.contatoNome === form.contatoBusca) return [];
    return contatos.filter((c) => c.nome.toLowerCase().includes(termo)).slice(0, 6);
  }, [contatos, form.contatoBusca, form.contatoNome]);

  function abrirDetalhe(c: Compromisso) {
    if (c.origem === "tarefa") return;
    setDetalheId(c.id);
    setReagendarAberto(false);
    setCancelarAberto(false);
    setMotivoCancelamento("");
    setEnviarMensagemCancelamento(false);
  }

  function confirmarReagendamento() {
    if (!compromissoDetalhe || !reagendarData.dataIso || !reagendarData.hora) return;
    reagendar(compromissoDetalhe.id, reagendarData.dataIso, reagendarData.hora, reagendarData.horaFim || undefined);
    avisar("Compromisso reagendado.");
    setReagendarAberto(false);
    setDetalheId(null);
  }

  /** Conversa "pertence" ao canal WhatsApp via QR Code (Baileys) quando a última mensagem recebida
   * chegou por ele — mesmo critério de `contatoUsaWhatsappBaileys()` em conversas/page.tsx, decide
   * pra onde o aviso de cancelamento deve sair de verdade. */
  function contatoUsaWhatsappBaileys(nomeContato: string): boolean {
    const extras = mensagensExtraPorContato[nomeContato] ?? [];
    for (let i = extras.length - 1; i >= 0; i--) {
      if (extras[i].tipo === "in") return extras[i].canal === "whatsapp_baileys";
    }
    return false;
  }

  function confirmarCancelamento() {
    if (!compromissoDetalhe) return;
    cancelar(compromissoDetalhe.id, motivoCancelamento.trim() || undefined);

    if (!enviarMensagemCancelamento) {
      avisar("Compromisso cancelado.");
      setDetalheId(null);
      return;
    }

    const contato = contatos.find((c) => c.id === compromissoDetalhe.contatoId);
    const numero = contato?.whatsapp;
    if (!numero) {
      avisar("Compromisso cancelado — esse contato não tem WhatsApp cadastrado pra avisar.");
      setDetalheId(null);
      return;
    }

    const primeiroNome = contato.nome.split(" ")[0];
    const texto =
      `Olá, ${primeiroNome}! Seu compromisso "${compromissoDetalhe.tipo}" foi cancelado.` +
      (motivoCancelamento.trim() ? ` Motivo: ${motivoCancelamento.trim()}.` : "");
    const rota = contatoUsaWhatsappBaileys(contato.nome)
      ? "/api/integracoes/whatsapp-baileys/enviar"
      : "/api/integracoes/meta/whatsapp/enviar";

    avisar("Compromisso cancelado — enviando aviso pelo WhatsApp…");
    fetch(rota, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destinatario: numero, texto }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro);
        avisar(`Aviso de cancelamento enviado a ${contato.nome}.`);
      })
      .catch(() => avisar(`Compromisso cancelado, mas não deu pra avisar ${contato.nome} pelo WhatsApp.`));

    setDetalheId(null);
  }

  function criarTarefaRelacionada() {
    if (!compromissoDetalhe) return;
    criarTarefa({
      titulo: compromissoDetalhe.tipo,
      contato: compromissoDetalhe.contato !== "—" ? compromissoDetalhe.contato : undefined,
      contatoId: compromissoDetalhe.contatoId,
      data: formatarDataTarefa(compromissoDetalhe.dataIso),
      responsavel: {
        nome: compromissoDetalhe.responsavel,
        initials: compromissoDetalhe.responsavel.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase(),
      },
      urgencia: "Média",
      descricao: `Tarefa criada a partir do compromisso "${compromissoDetalhe.tipo}".`,
    });
    avisar("Tarefa relacionada criada.");
    setDetalheId(null);
  }

  const primeiroDiaSemana = new Date(ano, mesIndex0, 1).getDay();
  const totalDias = new Date(ano, mesIndex0 + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const listaCompromissos = useMemo(() => {
    const porDia = new Map<string, Compromisso[]>();
    for (const c of compromissosFiltrados) {
      if (!porDia.has(c.dataIso)) porDia.set(c.dataIso, []);
      porDia.get(c.dataIso)!.push(c);
    }
    return [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dataIso, itens]) => ({
        dataIso,
        itens: itens.sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99")),
      }));
  }, [compromissosFiltrados]);

  return (
    <>
      <Topbar
        title="Agenda"
        sub="Agenda operacional — compromissos manuais e tarefas com data em um só lugar"
        actions={
          <>
            <button type="button" className="btn ghost" onClick={irParaHoje}>
              Hoje
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              {(["mes", "lista"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`fchip${view === v ? " active" : ""}`}
                  onClick={() => setView(v)}
                >
                  {v === "mes" ? "Mês" : "Lista"}
                </button>
              ))}
            </div>
            <button type="button" className="btn primary" onClick={() => abrirNovo()}>
              + Novo compromisso
            </button>
          </>
        }
      />

      <div className="content">
        <div className="card mb14" style={{ padding: "10px 17px" }}>
          <div className="filters-row">
            <select
              className="input"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
            >
              <option value="todos">Todos os responsáveis</option>
              {membros.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="todas">Todos os tipos</option>
              {CATEGORIAS_COMPROMISSO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
              <option value="tarefa">Tarefas com data</option>
            </select>
          </div>
        </div>

        {view === "mes" ? (
          <div className="card mb14">
            <div className="panel-h">
              <button type="button" className="btn ghost" onClick={() => mudarMes(-1)}>
                ← Mês anterior
              </button>
              <h4>
                {MESES[mesIndex0]} de {ano}
              </h4>
              <button type="button" className="btn ghost" onClick={() => mudarMes(1)}>
                Próximo mês →
              </button>
            </div>
            <div className="agenda-grid">
              {DIAS_SEMANA.map((d) => (
                <div className="agenda-dow" key={d}>
                  {d}
                </div>
              ))}
              {celulas.map((dia, i) => {
                if (dia === null) return <div className="agenda-cell vazia" key={`v-${i}`} />;
                const dataIso = isoDe(ano, mesIndex0, dia);
                const eventos = eventosDoDia(dataIso);
                const ehHoje = dataIso === HOJE_ISO;
                const selecionado = dataIso === diaSelecionado;
                return (
                  <button
                    type="button"
                    key={dataIso}
                    className={`agenda-cell${ehHoje ? " hoje" : ""}${selecionado ? " selecionada" : ""}`}
                    onClick={() => setDiaSelecionado(dataIso)}
                  >
                    <span className="agenda-daynum">{dia}</span>
                    {eventos.slice(0, 2).map((e) => (
                      <span
                        key={e.id}
                        className={`agenda-evento${e.origem === "tarefa" ? " automatico" : ""}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          abrirDetalhe(e);
                        }}
                      >
                        {e.hora ? `${e.hora} · ` : ""}
                        {e.origem === "tarefa" ? e.descricao ?? e.tipo : e.tipo}
                      </span>
                    ))}
                    {eventos.length > 2 ? (
                      <span
                        className="agenda-evento-mais"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setMaisAberto({ dataIso, anchor: (ev.currentTarget as HTMLElement).getBoundingClientRect() });
                        }}
                      >
                        +{eventos.length - 2} mais
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card mb14">
            <div className="panel-h">
              <h4>Todos os compromissos</h4>
            </div>
            {listaCompromissos.length === 0 ? (
              <p className="hint" style={{ padding: "0 17px 17px" }}>
                Nada agendado com esses filtros.
              </p>
            ) : (
              listaCompromissos.map(({ dataIso, itens }) => (
                <div key={dataIso}>
                  <p
                    className="hint"
                    style={{ padding: "10px 17px 4px", fontWeight: 700, textTransform: "uppercase", fontSize: 10.5 }}
                  >
                    {formatarDataCurta(dataIso)}
                    {dataIso === HOJE_ISO ? " · hoje" : ""}
                  </p>
                  {itens.map((e) => (
                    <div
                      className="activity-row"
                      key={e.id}
                      style={{ cursor: e.origem === "tarefa" ? "default" : "pointer" }}
                      onClick={() => abrirDetalhe(e)}
                    >
                      <div className="avatar">{e.hora || "—"}</div>
                      <div className="body">
                        <p className="name">{e.origem === "tarefa" ? e.descricao ?? e.tipo : e.tipo}</p>
                        <p className="meta">
                          {e.contato !== "—" ? `${e.contato} · ` : ""}
                          {e.responsavel}
                          {e.local ? ` · ${e.local}` : ""}
                        </p>
                      </div>
                      <span className={`pill${e.origem === "tarefa" ? " on" : ""}`}>
                        {e.origem === "tarefa" ? "Tarefa" : categoriaRotulo(e.categoria)}
                      </span>
                      {e.status === "concluido" ? <span className="pill on">Concluído</span> : null}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {view === "mes" && diaSelecionado ? (
          <div className="card">
            <div className="panel-h">
              <h4>{formatarDataCurta(diaSelecionado)}</h4>
              <button type="button" className="btn primary" onClick={() => abrirNovo(diaSelecionado)}>
                + Novo compromisso
              </button>
            </div>
            {eventosDoDia(diaSelecionado).length === 0 ? (
              <p className="hint" style={{ padding: "0 17px 17px" }}>
                Nada agendado nesse dia ainda.
              </p>
            ) : (
              eventosDoDia(diaSelecionado).map((e) => (
                <div
                  className="activity-row"
                  key={e.id}
                  style={{ cursor: e.origem === "tarefa" ? "default" : "pointer" }}
                  onClick={() => abrirDetalhe(e)}
                >
                  <div className="avatar">{e.hora || "—"}</div>
                  <div className="body">
                    <p className="name">{e.origem === "tarefa" ? e.descricao ?? e.tipo : e.tipo}</p>
                    <p className="meta">
                      {e.contato !== "—" ? `${e.contato} · ` : ""}
                      {e.responsavel}
                      {e.local ? ` · ${e.local}` : ""}
                    </p>
                  </div>
                  <span className={`pill${e.origem === "tarefa" ? " on" : ""}`}>
                    {e.origem === "tarefa" ? "Tarefa" : categoriaRotulo(e.categoria)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {maisAberto && maisPos && typeof document !== "undefined"
        ? createPortal(
            <>
              <div onClick={() => setMaisAberto(null)} style={{ position: "fixed", inset: 0, zIndex: 190 }} />
              <div
                ref={maisRef}
                className="dropdown-pop"
                style={{ position: "fixed", top: maisPos.top, left: maisPos.left, zIndex: 200, width: 280 }}
              >
                <p className="hint" style={{ padding: "6px 12px 2px", fontWeight: 700 }}>
                  {formatarDataCurta(maisAberto.dataIso)}
                </p>
                {eventosDoDia(maisAberto.dataIso).map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => {
                      setMaisAberto(null);
                      abrirDetalhe(e);
                    }}
                  >
                    <span className="n">
                      {e.hora ? `${e.hora} — ` : ""}
                      {e.origem === "tarefa" ? e.descricao ?? e.tipo : e.tipo}
                    </span>
                    <span className="r">{e.responsavel}</span>
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}

      <Drawer
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        titulo={editandoId ? "Editar compromisso" : "Novo compromisso"}
        rodape={
          <>
            <button type="button" className="btn ghost" onClick={() => setFormAberto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn primary" onClick={() => salvarForm()}>
              Salvar
            </button>
          </>
        }
      >
        <div className="field">
          <label>Tipo</label>
          <div className="filters-row" style={{ margin: 0, flexWrap: "wrap" }}>
            {CATEGORIAS_COMPROMISSO.map((c) => (
              <button
                type="button"
                key={c.valor}
                className={`fchip${form.categoria === c.valor ? " active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, categoria: c.valor }))}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Título</label>
          <input
            className="input"
            style={{ width: "100%" }}
            type="text"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Retorno da Marina Costa"
          />
        </div>
        <div className="field" style={{ position: "relative" }}>
          <label>Contato</label>
          <input
            className="input"
            style={{ width: "100%" }}
            type="text"
            value={form.contatoBusca}
            onChange={(e) =>
              setForm((f) => ({ ...f, contatoBusca: e.target.value, contatoId: undefined, contatoNome: "" }))
            }
            placeholder="Buscar contato…"
          />
          {contatosFiltrados.length > 0 ? (
            <div className="dropdown-pop" style={{ position: "static", marginTop: 4, width: "100%" }}>
              {contatosFiltrados.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="dropdown-item"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() =>
                    setForm((f) => ({ ...f, contatoId: c.id, contatoNome: c.nome, contatoBusca: c.nome }))
                  }
                >
                  <span className="n">{c.nome}</span>
                  <span className="r">{c.empresa || c.whatsapp || ""}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>Responsável</label>
          <select
            className="input"
            style={{ width: "100%" }}
            value={form.responsavel}
            onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
          >
            {membros.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data</label>
          <SeletorDeData
            valor={form.dataIso}
            onChange={(iso) => setForm((f) => ({ ...f, dataIso: iso }))}
          />
        </div>
        <div className="filters-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Hora início</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="time"
              value={form.hora}
              onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hora fim</label>
            <input
              className="input"
              style={{ width: "100%" }}
              type="time"
              value={form.horaFim}
              onChange={(e) => setForm((f) => ({ ...f, horaFim: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label>Local</label>
          <input
            className="input"
            style={{ width: "100%" }}
            type="text"
            value={form.local}
            onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
            placeholder="Ex.: Sala 2, videochamada…"
          />
        </div>
        <div className="field">
          <label>Descrição (opcional)</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 60, resize: "vertical" }}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Anotações sobre esse agendamento"
          />
        </div>

        {conflitos.length > 0 ? (
          <div className="card" style={{ padding: 12, borderColor: "var(--red, #dc2626)" }}>
            <p className="hint" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <IconAlerta width={13} height={13} /> Conflito de horário com {conflitos.length} compromisso(s) de {form.responsavel}:
            </p>
            {conflitos.map((c) => (
              <p key={c.id} className="hint" style={{ fontWeight: 600 }}>
                {c.hora}
                {c.horaFim ? `–${c.horaFim}` : ""} — {c.tipo}
              </p>
            ))}
            <div className="section-foot" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setConflitos([])}
              >
                Ajustar horário
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setConflitos([]);
                  salvarForm(true);
                }}
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        aberto={!!compromissoDetalhe}
        onFechar={() => setDetalheId(null)}
        titulo={compromissoDetalhe?.tipo ?? ""}
        subtitulo={compromissoDetalhe ? formatarDataCurta(compromissoDetalhe.dataIso) : undefined}
      >
        {compromissoDetalhe ? (
          <>
            <div className="field">
              <label>Quando</label>
              <p className="hint">
                {formatarDataCurta(compromissoDetalhe.dataIso)} às {compromissoDetalhe.hora || "—"}
                {compromissoDetalhe.horaFim ? ` até ${compromissoDetalhe.horaFim}` : ""}
              </p>
            </div>
            <div className="field">
              <label>Contato</label>
              <p className="hint">{compromissoDetalhe.contato !== "—" ? compromissoDetalhe.contato : "Nenhum vinculado"}</p>
            </div>
            <div className="field">
              <label>Responsável</label>
              <p className="hint">{compromissoDetalhe.responsavel}</p>
            </div>
            {compromissoDetalhe.local ? (
              <div className="field">
                <label>Local</label>
                <p className="hint">{compromissoDetalhe.local}</p>
              </div>
            ) : null}
            {compromissoDetalhe.descricao ? (
              <div className="field">
                <label>Descrição</label>
                <p className="hint">{compromissoDetalhe.descricao}</p>
              </div>
            ) : null}
            <div className="field">
              <label>Status</label>
              <p className="hint">
                {compromissoDetalhe.status === "concluido"
                  ? "Concluído"
                  : compromissoDetalhe.status === "cancelado"
                  ? `Cancelado${compromissoDetalhe.motivoCancelamento ? ` — ${compromissoDetalhe.motivoCancelamento}` : ""}`
                  : "Agendado"}
              </p>
            </div>

            {compromissoDetalhe.status === "agendado" ? (
              <>
                <div className="filters-row" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="btn ghost" onClick={() => abrirEdicao(compromissoDetalhe)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      concluir(compromissoDetalhe.id);
                      avisar("Compromisso concluído.");
                      setDetalheId(null);
                    }}
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setReagendarAberto((v) => !v);
                      setReagendarData({
                        dataIso: compromissoDetalhe.dataIso,
                        hora: compromissoDetalhe.hora,
                        horaFim: compromissoDetalhe.horaFim ?? "",
                      });
                    }}
                  >
                    Reagendar
                  </button>
                  {compromissoDetalhe.contatoId ? (
                    <button type="button" className="btn ghost" onClick={() => router.push("/contatos")}>
                      Abrir contato
                    </button>
                  ) : null}
                  <button type="button" className="btn ghost" onClick={criarTarefaRelacionada}>
                    Criar tarefa
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ color: "var(--red, #dc2626)" }}
                    onClick={() => setCancelarAberto((v) => !v)}
                  >
                    Cancelar
                  </button>
                </div>

                {reagendarAberto ? (
                  <div className="card" style={{ padding: 12, marginTop: 8 }}>
                    <div className="field">
                      <label>Nova data</label>
                      <SeletorDeData
                        valor={reagendarData.dataIso}
                        onChange={(iso) => setReagendarData((r) => ({ ...r, dataIso: iso }))}
                      />
                    </div>
                    <div className="filters-row">
                      <div className="field" style={{ flex: 1 }}>
                        <label>Hora início</label>
                        <input
                          className="input"
                          style={{ width: "100%" }}
                          type="time"
                          value={reagendarData.hora}
                          onChange={(e) => setReagendarData((r) => ({ ...r, hora: e.target.value }))}
                        />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label>Hora fim</label>
                        <input
                          className="input"
                          style={{ width: "100%" }}
                          type="time"
                          value={reagendarData.horaFim}
                          onChange={(e) => setReagendarData((r) => ({ ...r, horaFim: e.target.value }))}
                        />
                      </div>
                    </div>
                    <button type="button" className="btn primary block" onClick={confirmarReagendamento}>
                      Confirmar reagendamento
                    </button>
                  </div>
                ) : null}

                {cancelarAberto ? (
                  <div className="card" style={{ padding: 12, marginTop: 8 }}>
                    <div className="field">
                      <label>Motivo do cancelamento</label>
                      <textarea
                        className="input"
                        style={{ width: "100%", minHeight: 50, resize: "vertical" }}
                        value={motivoCancelamento}
                        onChange={(e) => setMotivoCancelamento(e.target.value)}
                        placeholder="Ex.: Paciente remarcou por conta própria"
                      />
                    </div>
                    <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={enviarMensagemCancelamento}
                        onChange={(e) => setEnviarMensagemCancelamento(e.target.checked)}
                      />
                      Avisar o contato do cancelamento pelo WhatsApp
                    </label>
                    <button
                      type="button"
                      className="btn primary block"
                      style={{ marginTop: 8, background: "var(--red, #dc2626)" }}
                      onClick={confirmarCancelamento}
                    >
                      Confirmar cancelamento
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Drawer>

      {toasts.length > 0 ? (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              {t.texto}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
