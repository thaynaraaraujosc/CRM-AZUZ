"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  FORMULARIOS_STORAGE_KEY,
  MENSAGEM_FINAL_PADRAO,
  RESPOSTAS_STORAGE_KEY,
  TIPOS_LAYOUT,
  condicaoBate,
  migrarFormulario,
  type Formulario,
  type PaginaFormulario,
  type PerguntaFormulario,
  type RespostaFormulario,
} from "@/lib/formularios-context";
import { CONTATOS_STORAGE_KEY } from "@/lib/contatos-context";
import { EQUIPE_STORAGE_KEY } from "@/lib/equipe-context";
import { FUNIS_STORAGE_KEY } from "@/lib/funis-context";
import { AUTOMACOES_STORAGE_KEY } from "@/lib/automation-flow-context";
import { avaliarGatilho, executarFluxo, type ContextoExecucao, type EventoAutomacao, type Ligacoes } from "@/lib/automation-flow/motor";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { contatos as contatosMock, equipe as equipeMock, funis as funisMock, type Contato, type Funil, type Membro, type NegocioCard } from "@/lib/data";
import { slugId } from "@/lib/ids";
import { PerguntaVisualizacao } from "@/components/campo-resposta";

/** Sem Provider nessa rota (aba separada, sem acesso ao Context) — lê/grava direto no localStorage,
 * mesmo padrão já usado antes só pra leitura de formulários. */
function carregarFormularios(): Formulario[] {
  if (typeof window === "undefined") return [];
  try {
    const salvos = localStorage.getItem(FORMULARIOS_STORAGE_KEY);
    if (!salvos) return [];
    const lista = JSON.parse(salvos) as unknown[];
    return lista.map(migrarFormulario);
  } catch {
    return [];
  }
}

function carregarContatos(): Contato[] {
  if (typeof window === "undefined") return contatosMock;
  try {
    const salvos = localStorage.getItem(CONTATOS_STORAGE_KEY);
    return salvos ? (JSON.parse(salvos) as Contato[]) : contatosMock;
  } catch {
    return contatosMock;
  }
}

function carregarEquipe(): Membro[] {
  if (typeof window === "undefined") return equipeMock;
  try {
    const salvos = localStorage.getItem(EQUIPE_STORAGE_KEY);
    return salvos ? (JSON.parse(salvos) as Membro[]) : equipeMock;
  } catch {
    return equipeMock;
  }
}

function carregarFunis(): Funil[] {
  if (typeof window === "undefined") return funisMock;
  try {
    const salvos = localStorage.getItem(FUNIS_STORAGE_KEY);
    return salvos ? (JSON.parse(salvos) as Funil[]) : funisMock;
  } catch {
    return funisMock;
  }
}

function carregarFluxosAutomacao(): FluxoAutomacao[] {
  if (typeof window === "undefined") return [];
  try {
    const salvos = localStorage.getItem(AUTOMACOES_STORAGE_KEY);
    return salvos ? (JSON.parse(salvos) as FluxoAutomacao[]) : [];
  } catch {
    return [];
  }
}

/** Equivalente em runtime puro de `useFunis().atribuirContatoAoFunil` — move (ou cria) o card desse
 * contato pra etapa escolhida, tirando de onde estivesse antes em qualquer funil. */
function atribuirContatoAoFunilPublico(
  funilId: string,
  etapaTitulo: string,
  contato: Omit<NegocioCard, "id"> & { id?: string },
) {
  const funis = carregarFunis();
  const semDuplicata = funis.map((f) => ({
    ...f,
    colunas: f.colunas.map((c) => {
      const cards = c.cards.filter((card) => card.nome !== contato.nome);
      return cards.length === c.cards.length ? c : { ...c, cards, total: Math.max(0, c.total - 1) };
    }),
  }));

  const novoCard: NegocioCard = {
    id: contato.id ?? `negocio-${Date.now()}`,
    nome: contato.nome,
    valor: contato.valor,
    origem: contato.origem,
    dias: contato.dias,
    data: contato.data,
    responsavel: contato.responsavel,
  };

  const proximos = semDuplicata.map((f) => {
    if (f.id !== funilId) return f;
    let etapaEncontrada = false;
    const colunas = f.colunas.map((c) => {
      if (c.titulo !== etapaTitulo) return c;
      etapaEncontrada = true;
      return { ...c, cards: [...c.cards, novoCard], total: c.total + 1 };
    });
    return etapaEncontrada ? { ...f, colunas } : f;
  });

  try {
    localStorage.setItem(FUNIS_STORAGE_KEY, JSON.stringify(proximos));
  } catch {
    // localStorage indisponível — segue sem persistir.
  }
}

function registrarRespostaPublica(formularioId: string, valores: Record<string, string>) {
  const resposta: RespostaFormulario = {
    id: `resposta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    formularioId,
    criadoEm: new Date().toISOString(),
    valores,
  };
  try {
    const salvas = localStorage.getItem(RESPOSTAS_STORAGE_KEY);
    const lista = salvas ? (JSON.parse(salvas) as RespostaFormulario[]) : [];
    localStorage.setItem(RESPOSTAS_STORAGE_KEY, JSON.stringify([...lista, resposta]));
  } catch {
    // localStorage indisponível — a resposta não persiste, mas não trava o envio.
  }
}

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Equivalente em runtime puro de `useContatos().salvarDadosContato` — cria o contato (se ainda não
 * existir) ou faz merge dos dados informados, direto no localStorage. Usado tanto pelo submit do
 * formulário quanto pelas `Ligacoes` (`salvarContato`/`atribuirAtendente`) do motor de automações. */
function salvarDadosContatoPublico(nome: string, dados: Record<string, unknown>) {
  if (!nome) return;
  const contatos = carregarContatos();
  const id = slugId(nome);
  const existente = contatos.find((c) => c.id === id);
  const proximos = existente
    ? contatos.map((c) => (c.id === id ? { ...c, ...dados } : c))
    : [
        ...contatos,
        {
          id,
          initials: iniciais(nome),
          nome,
          origem: "Formulário" as Contato["origem"],
          etapa: "Novo" as Contato["etapa"],
          responsavel: "—",
          ultima: "Agora",
          valor: "—",
          ...dados,
        } as Contato,
      ];
  try {
    localStorage.setItem(CONTATOS_STORAGE_KEY, JSON.stringify(proximos));
  } catch {
    // localStorage indisponível — segue sem persistir.
  }
}

/** Cria ou atualiza o contato de verdade a partir das perguntas mapeadas pro CRM — mesmo efeito de
 * `useContatos().criarContato`, mas em runtime puro (sem Provider) direto no localStorage. */
function salvarContatoPublico(dadosMapeados: Record<string, string>) {
  const nome = dadosMapeados.nome;
  if (!nome) return;
  salvarDadosContatoPublico(nome, dadosMapeados);
}

/** Dispara "formulario_preenchido" pra todo fluxo publicado e ativo, exatamente como
 * `useAutomationFlows().dispararEvento` — mas em runtime puro (sem Provider), lendo os fluxos
 * salvos direto do localStorage e usando `Ligacoes` que gravam no localStorage também. */
function dispararEventoFormularioPublico(contexto: ContextoExecucao) {
  const fluxos = carregarFluxosAutomacao();
  const evento: EventoAutomacao = { tipo: "formulario_preenchido", contatoNome: contexto.contato.nome };

  const ligacoes: Ligacoes = {
    moverEtapa: (funilId, etapaTitulo, contato) =>
      atribuirContatoAoFunilPublico(funilId, etapaTitulo, {
        nome: contato.nome,
        valor: (contato.valor as string) ?? "—",
        origem: "Formulário",
        dias: "0",
        data: new Date().toISOString().slice(0, 10),
        responsavel: contato.responsavel as string | undefined,
      }),
    salvarContato: (nome, dados) => salvarDadosContatoPublico(nome, dados),
    atribuirAtendente: (nome, atendente) => salvarDadosContatoPublico(nome, { responsavel: atendente }),
  };

  for (const fluxo of fluxos) {
    if (fluxo.status !== "publicado" || !fluxo.ativa) continue;
    if (!avaliarGatilho(fluxo, evento)) continue;

    const noGatilho = fluxo.nodes.find((n) => n.category === "gatilho");
    if (!noGatilho) continue;
    const primeiraAresta = fluxo.edges.find((e) => e.source === noGatilho.id);
    if (!primeiraAresta) continue;

    executarFluxo(fluxo, primeiraAresta.target, contexto, ligacoes);
  }
}

/** Campos de uma página que devem aparecer, respeitando `oculta` e `logica` (mostrar_se/ocultar_se). */
function perguntasVisiveis(pagina: PaginaFormulario, valores: Record<string, string>): PerguntaFormulario[] {
  return pagina.perguntas.filter((p) => {
    if (p.oculta) return false;
    if (!p.logica || p.logica.regras.length === 0) return true;
    if (p.logica.modo === "obrigatorio_se") return true; // sempre visível, só muda obrigatoriedade
    const bateAlgumaRegra = p.logica.regras.some((r) => condicaoBate(r.operador, valores[r.campoId], r.valor));
    return p.logica.modo === "mostrar_se" ? bateAlgumaRegra : !bateAlgumaRegra;
  });
}

function perguntaEhObrigatoria(pergunta: PerguntaFormulario, valores: Record<string, string>): boolean {
  if (pergunta.obrigatoria) return true;
  if (pergunta.logica?.modo === "obrigatorio_se" && pergunta.logica.regras.length > 0) {
    return pergunta.logica.regras.some((r) => condicaoBate(r.operador, valores[r.campoId], r.valor));
  }
  return false;
}

/** Páginas que devem aparecer, respeitando a condição de exibição de cada uma. */
function paginasVisiveis(formulario: Formulario, valores: Record<string, string>): PaginaFormulario[] {
  return formulario.paginas.filter((p) => {
    if (!p.condicao) return true;
    return condicaoBate(p.condicao.operador, valores[p.condicao.campoId], p.condicao.valor);
  });
}

function FormularioPreviewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const chave = searchParams.get("chave");
  // Carregados só depois de montar (não no initializer do useState) — essa página lê localStorage,
  // que não existe durante o SSR; ler direto no initializer faz o HTML da primeira renderização no
  // cliente divergir do HTML gerado no servidor (hydration mismatch).
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [equipeDisponivel, setEquipeDisponivel] = useState<Membro[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [paginaIndice, setPaginaIndice] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);

  // Carrega do localStorage só depois de montar — não dá pra fazer isso no initializer do useState
  // sem quebrar o hydration (ver comentário acima da declaração dos estados).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFormularios(carregarFormularios());
    setContatos(carregarContatos());
    setEquipeDisponivel(carregarEquipe());
    setCarregado(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const formulario = formularios.find((f) => f.id === id) ?? null;

  const paginasAtivas = useMemo(() => (formulario ? paginasVisiveis(formulario, valores) : []), [formulario, valores]);
  const pagina = paginasAtivas[paginaIndice] ?? null;
  const camposDaPagina = useMemo(() => (pagina ? perguntasVisiveis(pagina, valores) : []), [pagina, valores]);
  const ehUltimaPagina = paginaIndice >= paginasAtivas.length - 1;

  const contatosOpcoes = useMemo(() => contatos.map((c) => ({ id: c.id, nome: c.nome })), [contatos]);
  const responsaveisOpcoes = useMemo(() => equipeDisponivel.map((m) => ({ id: m.id, nome: m.nome })), [equipeDisponivel]);

  function mudarValor(perguntaId: string, valor: string) {
    setValores((prev) => ({ ...prev, [perguntaId]: valor }));
    setErros((prev) => (prev[perguntaId] ? { ...prev, [perguntaId]: "" } : prev));
  }

  function validarPaginaAtual(): boolean {
    const proximosErros: Record<string, string> = {};
    for (const pergunta of camposDaPagina) {
      if (TIPOS_LAYOUT.includes(pergunta.tipo)) continue;
      const valor = valores[pergunta.id]?.trim() ?? "";
      if (perguntaEhObrigatoria(pergunta, valores) && !valor) {
        proximosErros[pergunta.id] = "Campo obrigatório.";
        continue;
      }
      if (valor && pergunta.regex) {
        try {
          if (!new RegExp(pergunta.regex).test(valor)) {
            proximosErros[pergunta.id] = "Formato inválido.";
          }
        } catch {
          // regex configurada errada no builder — não trava o envio do cliente por causa disso.
        }
      }
    }
    setErros(proximosErros);
    return Object.keys(proximosErros).length === 0;
  }

  function avancar() {
    if (!validarPaginaAtual()) return;
    if (ehUltimaPagina) {
      enviar();
    } else {
      setPaginaIndice((i) => i + 1);
    }
  }

  function voltar() {
    setPaginaIndice((i) => Math.max(0, i - 1));
  }

  function enviar() {
    if (!formulario) return;
    registrarRespostaPublica(formulario.id, valores);

    const dadosMapeados: Record<string, string> = {};
    for (const pagina2 of formulario.paginas) {
      for (const pergunta of pagina2.perguntas) {
        if (pergunta.mapeamentoCrm && valores[pergunta.id]) {
          dadosMapeados[pergunta.mapeamentoCrm] = valores[pergunta.id];
        }
      }
    }
    salvarContatoPublico(dadosMapeados);

    const nomeContato = dadosMapeados.nome || `Resposta ${new Date().toLocaleString("pt-BR")}`;
    const integracoes = formulario.integracoes;
    if (integracoes?.funilId && integracoes.etapaTitulo) {
      atribuirContatoAoFunilPublico(integracoes.funilId, integracoes.etapaTitulo, {
        nome: nomeContato,
        valor: "—",
        origem: "Formulário",
        dias: "0",
        data: new Date().toISOString().slice(0, 10),
        responsavel: integracoes.responsavelPadrao,
      });
    }

    dispararEventoFormularioPublico({
      contato: {
        nome: nomeContato,
        etiquetas: [],
        origem: "Formulário",
        responsavel: integracoes?.responsavelPadrao,
        camposPersonalizados: valores,
        funilId: integracoes?.funilId,
        etapaTitulo: integracoes?.etapaTitulo,
        ultimaRespostaEm: new Date().toISOString(),
      },
    });

    if (formulario.paginaFinal.urlRedirecionamento && formulario.paginaFinal.redirecionarAutomaticamente) {
      window.location.href = formulario.paginaFinal.urlRedirecionamento;
      return;
    }
    setEnviado(true);
  }

  if (!carregado) {
    return <div className="form-public-page" />;
  }

  if (!formulario) {
    return (
      <div className="form-public-page">
        <div className="form-public-card" style={{ background: "#ffffff" }}>
          <h2>Formulário não encontrado</h2>
          <p className="hint">Volte pro CRM, abra o formulário e clique em &quot;Pré-visualizar&quot; de novo.</p>
        </div>
      </div>
    );
  }

  if (formulario.status !== "publicado") {
    return (
      <div className="form-public-page">
        <div className="form-public-card" style={{ background: "#ffffff" }}>
          <h2>Formulário indisponível</h2>
          <p className="hint">Este formulário ainda está em rascunho — publique-o no CRM pra receber respostas.</p>
        </div>
      </div>
    );
  }

  if (formulario.senha && chave !== formulario.senha) {
    return (
      <div className="form-public-page">
        <div className="form-public-card" style={{ background: "#ffffff" }}>
          <h2>🔒 Este link precisa de uma senha</h2>
          <p className="hint">Peça o link completo (com a chave de acesso) pra quem te enviou.</p>
        </div>
      </div>
    );
  }

  const tema = formulario.tema;
  const estiloPagina: React.CSSProperties = tema.imagemFundoUrl
    ? { backgroundImage: `url(${tema.imagemFundoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  if (enviado) {
    return (
      <div className="form-public-page" style={estiloPagina}>
        <div className={`form-public-obrigado${tema.temaEscuro ? " tema-escuro" : ""}`} style={{ background: tema.corPrincipal }}>
          <h2>{formulario.paginaFinal.mensagem || MENSAGEM_FINAL_PADRAO}</h2>
          {formulario.paginaFinal.urlRedirecionamento ? (
            <a className="btn primary" href={formulario.paginaFinal.urlRedirecionamento} style={{ marginTop: 14, display: "inline-block" }}>
              Continuar
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="form-public-page" style={estiloPagina}>
      <div
        className={`form-public-card${tema.temaEscuro ? " tema-escuro" : ""}${tema.layout === "duas-colunas" ? " duas-colunas" : ""}${!tema.larguraFixa ? " tela-cheia" : ""}`}
        style={{ background: tema.corPrincipal }}
      >
        {tema.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL livre informada pelo usuário
          <img src={tema.logoUrl} alt="Logo" className="form-public-logo" />
        ) : null}
        {tema.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL livre informada pelo usuário
          <img src={tema.bannerUrl} alt="Banner" className="form-public-banner" />
        ) : null}
        <h2>{formulario.nome}</h2>
        {formulario.descricao ? <p className="hint" style={{ marginBottom: 6 }}>{formulario.descricao}</p> : null}

        {paginasAtivas.length > 1 ? (
          <p className="hint" style={{ margin: "8px 0" }}>
            Página {paginaIndice + 1} de {paginasAtivas.length}
          </p>
        ) : null}
        {pagina?.titulo ? <h4 style={{ margin: "6px 0 10px" }}>{pagina.titulo}</h4> : null}
        {pagina?.descricao ? <p className="hint" style={{ marginBottom: 10 }}>{pagina.descricao}</p> : null}

        <div className="form-public-campos">
          {camposDaPagina.map((pergunta) => (
            <div key={pergunta.id} className={pergunta.largura === "metade" ? "form-campo-metade" : "form-campo-total"}>
              <PerguntaVisualizacao
                pergunta={pergunta}
                indice={0}
                interativo
                valor={valores[pergunta.id] ?? pergunta.valorPadrao ?? ""}
                onMudarValor={(v) => mudarValor(pergunta.id, v)}
                erro={erros[pergunta.id]}
                contatosDisponiveis={contatosOpcoes}
                responsaveisDisponiveis={responsaveisOpcoes}
              />
            </div>
          ))}
        </div>

        <div className="filters-row" style={{ marginTop: 14 }}>
          {paginaIndice > 0 ? (
            <button type="button" className="btn ghost" onClick={voltar}>
              Voltar
            </button>
          ) : null}
          <button type="button" className="btn block" style={{ background: tema.corBotao, color: "#fff" }} onClick={avancar}>
            {ehUltimaPagina ? "Enviar" : "Próxima"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FormularioPreviewPage() {
  return (
    <Suspense fallback={null}>
      <FormularioPreviewContent />
    </Suspense>
  );
}
