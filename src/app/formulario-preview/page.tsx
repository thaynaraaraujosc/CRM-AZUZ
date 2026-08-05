"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  MENSAGEM_FINAL_PADRAO,
  TIPOS_LAYOUT,
  condicaoBate,
  migrarFormulario,
  type Formulario,
  type PaginaFormulario,
  type PerguntaFormulario,
} from "@/lib/formularios-context";
import { avaliarGatilho, executarFluxo, type ContextoExecucao, type EventoAutomacao, type Ligacoes } from "@/lib/automation-flow/motor";
import type { FluxoAutomacao } from "@/lib/automation-flow/types";
import { PerguntaVisualizacao } from "@/components/campo-resposta";

type OpcaoNome = { id: string; nome: string };

/**
 * Formulário/contatos-sugeridos/equipe-sugerida/fluxos-automacao vêm de rotas públicas dedicadas
 * (ver src/app/api/formularios/[id]/), cada uma resolvendo o workspace a partir do `id` do
 * formulário na URL — nunca da lista inteira de `/api/contatos`, `/api/equipe`, `/api/funis`,
 * `/api/automacoes-fluxos` (essas exigem sessão desde a Fase 2 do multi-tenancy, e listar tudo
 * pra um público não logado vazaria dado de qualquer empresa cadastrada, não só a dona do link).
 */
async function carregarFormulario(id: string): Promise<Formulario | null> {
  try {
    const resposta = await fetch(`/api/formularios/${id}`);
    if (!resposta.ok) return null;
    return migrarFormulario(await resposta.json());
  } catch {
    return null;
  }
}

async function carregarContatosSugeridos(id: string): Promise<OpcaoNome[]> {
  try {
    const resposta = await fetch(`/api/formularios/${id}/contatos-sugeridos`);
    if (!resposta.ok) return [];
    return (await resposta.json()) as OpcaoNome[];
  } catch {
    return [];
  }
}

async function carregarEquipeSugerida(id: string): Promise<OpcaoNome[]> {
  try {
    const resposta = await fetch(`/api/formularios/${id}/equipe-sugerida`);
    if (!resposta.ok) return [];
    return (await resposta.json()) as OpcaoNome[];
  } catch {
    return [];
  }
}

async function carregarFluxosSugeridos(id: string): Promise<FluxoAutomacao[]> {
  try {
    const resposta = await fetch(`/api/formularios/${id}/fluxos-automacao`);
    if (!resposta.ok) return [];
    return (await resposta.json()) as FluxoAutomacao[];
  } catch {
    return [];
  }
}

/** Equivalente em runtime puro de `useFunis().atribuirContatoAoFunil` — move (ou cria) o card desse
 * contato pra etapa escolhida, tirando de onde estivesse antes em qualquer funil do workspace do
 * formulário. Ver src/app/api/formularios/[id]/funil/ — a movimentação acontece toda no servidor,
 * a rota não aceita reconciliar funis inteiros vindos do cliente. Fire-and-forget: `Ligacoes.moverEtapa`
 * é `void`, não espera essa chamada terminar. */
function atribuirContatoAoFunilPublico(
  formularioId: string,
  funilId: string,
  etapaTitulo: string,
  card: { nome: string; valor: string; origem: string; dias: string; data: string; responsavel?: string },
) {
  fetch(`/api/formularios/${formularioId}/funil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ funilId, etapaTitulo, card }),
  }).catch((erro) => console.error("Falha ao atribuir contato ao funil (público):", erro));
}

/** Grava a resposta via API real (ver src/app/api/formularios/[id]/respostas/) — fire-and-forget,
 * não trava o envio do formulário se a rede falhar. */
function registrarRespostaPublica(formularioId: string, valores: Record<string, string>) {
  fetch(`/api/formularios/${formularioId}/respostas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valores }),
  }).catch((erro) => console.error("Falha ao registrar resposta pública:", erro));
}

/** Equivalente em runtime puro de `useContatos().salvarDadosContato` — cria o contato (se ainda não
 * existir, com origem "Formulário") ou funde os dados informados num já existente, no workspace do
 * formulário (ver src/app/api/formularios/[id]/contatos/). Usado tanto pelo submit do formulário
 * quanto pelas `Ligacoes` (`salvarContato`/`atribuirAtendente`) do motor de automações. */
function salvarDadosContatoPublico(formularioId: string, nome: string, dados: Record<string, unknown>) {
  if (!nome) return;
  fetch(`/api/formularios/${formularioId}/contatos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, dados, origemPadrao: "Formulário" }),
  }).catch((erro) => console.error("Falha ao salvar contato público:", erro));
}

/** Cria ou atualiza o contato de verdade a partir das perguntas mapeadas pro CRM — mesmo efeito de
 * `useContatos().criarContato`, mas em runtime puro (sem Provider), via API real. */
function salvarContatoPublico(formularioId: string, dadosMapeados: Record<string, string>) {
  const nome = dadosMapeados.nome;
  if (!nome) return;
  salvarDadosContatoPublico(formularioId, nome, dadosMapeados);
}

/** Dispara "formulario_preenchido" pra todo fluxo publicado e ativo do workspace do formulário,
 * exatamente como `useAutomationFlows().dispararEvento` — mas em runtime puro (sem Provider),
 * buscando os fluxos na rota pública e usando `Ligacoes` que também chamam rotas públicas. */
async function dispararEventoFormularioPublico(formularioId: string, contexto: ContextoExecucao) {
  const fluxos = await carregarFluxosSugeridos(formularioId);
  const evento: EventoAutomacao = { tipo: "formulario_preenchido", contatoNome: contexto.contato.nome };

  const ligacoes: Ligacoes = {
    moverEtapa: (funilId, etapaTitulo, contato) =>
      atribuirContatoAoFunilPublico(formularioId, funilId, etapaTitulo, {
        nome: contato.nome,
        valor: (contato.valor as string) ?? "—",
        origem: "Formulário",
        dias: "0",
        data: new Date().toISOString().slice(0, 10),
        responsavel: contato.responsavel as string | undefined,
      }),
    salvarContato: (nome, dados) => salvarDadosContatoPublico(formularioId, nome, dados),
    atribuirAtendente: (nome, atendente) => salvarDadosContatoPublico(formularioId, nome, { responsavel: atendente }),
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
  // Carregados só depois de montar (não no initializer do useState) — essa página é pré-renderizada
  // no servidor sem `id` disponível; ler direto no initializer faria o HTML da primeira renderização
  // no cliente divergir do HTML do servidor (hydration mismatch).
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [contatosOpcoes, setContatosOpcoes] = useState<OpcaoNome[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<OpcaoNome[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [paginaIndice, setPaginaIndice] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!id) return;
    carregarFormulario(id)
      .then((dados) => {
        setFormulario(dados);
        setCarregado(true);
      })
      .catch((erro) => console.error("Falha ao carregar formulário:", erro));
    carregarContatosSugeridos(id)
      .then(setContatosOpcoes)
      .catch((erro) => console.error("Falha ao carregar contatos sugeridos:", erro));
    carregarEquipeSugerida(id)
      .then(setResponsaveisOpcoes)
      .catch((erro) => console.error("Falha ao carregar equipe sugerida:", erro));
  }, [id]);

  const carregadoFinal = id ? carregado : true;

  const paginasAtivas = useMemo(() => (formulario ? paginasVisiveis(formulario, valores) : []), [formulario, valores]);
  const pagina = paginasAtivas[paginaIndice] ?? null;
  const camposDaPagina = useMemo(() => (pagina ? perguntasVisiveis(pagina, valores) : []), [pagina, valores]);
  const ehUltimaPagina = paginaIndice >= paginasAtivas.length - 1;

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
    salvarContatoPublico(formulario.id, dadosMapeados);

    const nomeContato = dadosMapeados.nome || `Resposta ${new Date().toLocaleString("pt-BR")}`;
    const integracoes = formulario.integracoes;
    if (integracoes?.funilId && integracoes.etapaTitulo) {
      atribuirContatoAoFunilPublico(formulario.id, integracoes.funilId, integracoes.etapaTitulo, {
        nome: nomeContato,
        valor: "—",
        origem: "Formulário",
        dias: "0",
        data: new Date().toISOString().slice(0, 10),
        responsavel: integracoes.responsavelPadrao,
      });
    }

    dispararEventoFormularioPublico(formulario.id, {
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
    }).catch((erro) => console.error("Falha ao disparar automação pública:", erro));

    if (formulario.paginaFinal.urlRedirecionamento && formulario.paginaFinal.redirecionarAutomaticamente) {
      window.location.href = formulario.paginaFinal.urlRedirecionamento;
      return;
    }
    setEnviado(true);
  }

  if (!carregadoFinal) {
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
