"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useIdioma } from "@/lib/idioma-context";
import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { MarcaDoTopo } from "@/components/marca-do-topo";
import { publicarNomeDaEmpresa, useIdentidadeDaEmpresa } from "@/lib/empresa/identidade";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { INTELIGENCIA_INICIAL } from "@/lib/inteligencia/estrutura";
import { useFloatingPosition, type AnchorRect } from "@/lib/use-floating-position";
import {
  IconAutomacoes,
  IconInstagram,
  IconRespostaRapida,
  IconWhatsApp,
  IconConfiguracoes,
  IconContatos,
  IconDoc,
  IconPipeline,
  IconRelatorios,
  IconSparkle,
  IconTarefas,
  IconTrafego,
} from "@/components/icons";

type NavEntry = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Sub-rotas agrupadas dentro do menu "Inteligência comercial" na sidebar.
 * A central que conecta tráfego, atividades, performance, jornada do
 * cliente, motivos de perda, relatórios e o telão em tempo real, todos
 * lendo dos mesmos dados (ver `src/lib/metrics.ts` e `src/lib/timeline.ts`).
 */
export const gestaoAtividadeItens: NavEntry[] = [
  { href: "/trafego", label: "Tráfego", Icon: IconTrafego },
  { href: "/atividades-vendas", label: "Atividades", Icon: IconTarefas },
  { href: "/performance-vendas", label: "Performance", Icon: IconTrafego },
  { href: "/jornada-cliente", label: "Jornada do cliente", Icon: IconContatos },
  { href: "/motivos-perda", label: "Motivos de perda", Icon: IconRelatorios },
  { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios },
  { href: "/crm-live", label: "CRM Live", Icon: IconTrafego },
];

const gestaoAtividadeHrefs = new Set(gestaoAtividadeItens.map((i) => i.href));

export const navEntries: NavEntry[] = [
  // Duas caixas de entrada, uma por canal, e não mais uma só chamada "Conversas".
  //
  // Elas estavam juntas, e a mistura tinha um custo que só apareceu com as automações: quem atende
  // WhatsApp e quem atende Instagram não fazem a mesma coisa, não respondem no mesmo tom e não têm
  // as mesmas ferramentas (o Direct tem janela de 24 horas, story, comentário e um perfil com
  // seguidores; o WhatsApp não tem nada disso). Uma lista só obrigava a filtrar por canal a cada
  // visita pra fazer qualquer das duas coisas.
  { href: "/conversas", label: "WhatsApp", Icon: IconWhatsApp },
  { href: "/instagram", label: "Instagram", Icon: IconInstagram },
  { href: "/funil", label: "Funil comercial", Icon: IconPipeline },
  { href: "/formularios", label: "Formulário", Icon: IconDoc },
  /* EQUIPE SAIU DAQUI e virou categoria de Configurações, em 12/11/2026: "coloca o bloco de
     equipe dentro de configurações, faz mais sentido". E faz — convidar alguém, definir papel e
     mexer em permissão é configurar a conta, não trabalhar. O endereço `/equipe` continua o
     mesmo, então link antigo e favorito não quebram. */
  { href: "/contatos", label: "Contatos", Icon: IconContatos },
  ...gestaoAtividadeItens,
  { href: "/automacoes", label: "Automações", Icon: IconAutomacoes },
  /*
   * O SOCIAL SELLER SAIU DE DENTRO DE AUTOMAÇÕES, e virou item próprio aqui embaixo dela.
   *
   * Era uma ABA de Automações, e isso colocava um módulo com menu lateral próprio (automações,
   * resposta automática, templates, painel, execuções) dentro de uma aba de outro módulo: quem
   * entrava em Automações pra mexer no funil caía numa tela com outra navegação dentro. São dois
   * trabalhos — automatizar o atendimento do Direct e automatizar a esteira comercial —, feitos
   * por gente diferente, em momentos diferentes.
   *
   * Fica logo ABAIXO de Automações, e não em outro grupo: a vizinhança é o que diz que os dois são
   * da mesma família, agora sem um morar dentro do outro.
   */
  // Ícone de balão com linhas, e não o do Instagram: o item do Instagram já está lá em cima (a
  // caixa de entrada), e dois itens com o MESMO ícone num menu de dez é o tipo de detalhe que faz
  // a pessoa clicar no errado. O balão diz o que este módulo faz — responder sozinho.
  { href: "/social-seller", label: "Social Seller", Icon: IconRespostaRapida },
  { href: "/azuz-ia", label: "Azuz IA", Icon: IconSparkle },
  { href: "/configuracoes", label: "Configurações", Icon: IconConfiguracoes },
];

/**
 * Posiciona um popover flutuante ao lado do elemento que o abriu, sempre
 * dentro dos limites da tela. Vira pra esquerda se não couber à direita e
 * nunca deixa o topo/base vazar pra fora da viewport (funciona em qualquer
 * tamanho de tela, do desktop ao tablet).
 */
function posicionarFlyoutLateral(
  rect: DOMRect,
  width: number,
  alturaEstimada: number,
) {
  const margem = 12;
  let left = rect.right + 8;
  if (left + width > window.innerWidth - margem) {
    left = rect.left - width - 8;
  }
  left = Math.min(Math.max(left, margem), Math.max(margem, window.innerWidth - width - margem));

  const alturaMax = Math.min(alturaEstimada, window.innerHeight - margem * 2);
  let top = rect.top;
  top = Math.min(top, window.innerHeight - alturaMax - margem);
  top = Math.max(top, margem);

  return { top, left };
}

/*
 * CHAVE NOVA, DE PROPÓSITO.
 *
 * A antiga (`azuz-crm-sidebar-recolhida`) já estava gravada com "0" no navegador de quem usou o
 * CRM com o menu aberto — e "0" significa "deixe aberto". Mudar só o padrão não mudava nada pra
 * essas pessoas: o valor guardado ganhava do padrão, e o menu continuava aberto. Com chave nova,
 * ninguém tem preferência gravada ainda, e o padrão novo vale pra todo mundo até alguém escolher
 * outra coisa.
 */
const CHAVE_SIDEBAR_RECOLHIDA = "azuz-crm-menu-recolhido-v2";

/**
 * A marca de "estou indo" dentro do item do menu.
 *
 * Precisa ser um componente separado porque `useLinkStatus` só funciona DENTRO do `<Link>`. É ele
 * que sabe se aquela navegação específica está em curso.
 *
 * Antes disto, o item só ficava marcado como ativo quando a rota TERMINAVA de trocar (o `active`
 * vem de `usePathname`). Entre o clique e a chegada não acontecia nada, e numa tela pesada isso são
 * segundos de silêncio: que a pessoa lê como "não funcionou" e clica de novo.
 */
function IndoPara() {
  const { pending } = useLinkStatus();
  return <span className={`nav-item-indo${pending ? " ativo" : ""}`} aria-hidden="true" />;
}

export function Sidebar() {
  const { t: traduzir } = useIdioma();
  const pathname = usePathname();
  const { data: sessao } = useSession();
  /*
   * RECOLHIDA POR PADRÃO, E ABRE AO PASSAR O MOUSE.
   *
   * Ela era aberta por padrão e comia 216px de todas as telas o tempo todo — num CRM que é tabela,
   * funil e conversa, essa faixa é largura que faltava pro conteúdo. Recolhida ela ocupa 68px, e
   * o nome de cada item volta assim que o ponteiro encosta: ninguém precisa decorar ícone, e
   * ninguém paga a largura pra isso.
   *
   * Quem preferir a antiga fixa um clique na setinha, e a escolha fica guardada no navegador. O
   * padrão mudou; a opção não sumiu.
   */
  const [recolhida, setRecolhida] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const guardado = localStorage.getItem(CHAVE_SIDEBAR_RECOLHIDA);
      return guardado === null ? true : guardado === "1";
    } catch {
      return true;
    }
  });

  /*
   * A ABERTURA POR HOVER É SÓ VISUAL: `recolhida` não muda.
   *
   * Se o hover mexesse no estado de verdade, passar o mouse gravaria preferência e empurraria o
   * conteúdo da tela pra direita a cada vez — a tela inteira pulando porque o ponteiro passou por
   * cima. Aqui o menu ABRE POR CIMA do conteúdo e devolve o espaço ao sair.
   */
  const [sobreposta, setSobreposta] = useState(false);
  const mostrandoNomes = !recolhida || sobreposta;
  function alternarRecolhida() {
    setRecolhida((prev) => {
      const proximo = !prev;
      try {
        localStorage.setItem(CHAVE_SIDEBAR_RECOLHIDA, proximo ? "1" : "0");
      } catch {
        // localStorage indisponível: só não persiste entre sessões
      }
      return proximo;
    });
  }
  const currentUser = {
    name: sessao?.user?.name ?? "",
    initials: sessao?.user?.initials ?? "",
    role: sessao?.user?.role ?? "",
    email: sessao?.user?.email ?? "",
  };
  const { funis, funilAtivoId, setFunilAtivoId, reordenarFunis } = useFunis();
  /*
   * ARRASTAR O FUNIL NO MENU. "Eu quero que o funil azul seja o primeiro, porque eu quero que lá
   * no chat também ele seja as primeiras respostas. Não consegui arrastar."
   *
   * Não dava mesmo: a lista era de links e nada mais. O arrasto é o nativo do HTML (`draggable`),
   * sem biblioteca — são três ou quatro itens numa barra estreita, e um gesto de uma linha não
   * justifica o peso de um motor de arrastar.
   *
   * `arrastando` é o id do que está na mão; `alvo` é sobre qual item ele está passando. O segundo
   * existe pra desenhar a marca de onde vai cair: sem ela, arrastar numa lista curta é adivinhar.
   */
  const [funilArrastando, setFunilArrastando] = useState<string | null>(null);
  const [funilAlvo, setFunilAlvo] = useState<string | null>(null);

  function soltarFunil(idAlvo: string) {
    const de = funilArrastando;
    setFunilArrastando(null);
    setFunilAlvo(null);
    if (!de || de === idAlvo) return;
    const ids = funis.map((f) => f.id);
    const origem = ids.indexOf(de);
    const destino = ids.indexOf(idAlvo);
    if (origem < 0 || destino < 0) return;
    ids.splice(destino, 0, ids.splice(origem, 1)[0]);
    void reordenarFunis(ids);
  }
  const { membros: equipe } = useEquipe();
  const [contaAberta, setContaAberta] = useState(false);
  const [contaAnchorRect, setContaAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: contaPopRef, posicao: contaPos } = useFloatingPosition(contaAnchorRect, contaAberta, 8, () => setContaAberta(false));
  const [workspaceAberto, setWorkspaceAberto] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeEmpresaSincronizado, setNomeEmpresaSincronizado] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  /*
   * O NOME VEM DO ESTADO COMPARTILHADO, com a sessão como reserva.
   *
   * O token da sessão é tirado no LOGIN e não muda sozinho: enquanto o menu lia só dele, trocar o
   * nome em Configurações › Dados da empresa gravava a coluna e o menu seguia com o nome antigo
   * até a pessoa sair e entrar de novo. A sessão continua valendo no primeiro render, antes de a
   * leitura do workspace chegar — assim o menu nunca abre vazio.
   */
  const identidade = useIdentidadeDaEmpresa();
  const nomeDeVerdade = identidade.nome ?? sessao?.user?.workspaceNome ?? "";
  // "Ajustar estado durante a renderização" (não num useEffect) porque só precisa rodar quando o
  // nome muda de verdade. Padrão recomendado pelo React pra sincronizar com um valor de fora.
  if (nomeDeVerdade && nomeDeVerdade !== nomeEmpresaSincronizado) {
    setNomeEmpresaSincronizado(nomeDeVerdade);
    setNomeEmpresa(nomeDeVerdade);
  }
  const [workspaceAnchorRect, setWorkspaceAnchorRect] = useState<AnchorRect | null>(null);
  const { ref: workspacePopRef, posicao: workspacePos } = useFloatingPosition(workspaceAnchorRect, workspaceAberto, 8, () => setWorkspaceAberto(false));

  // Edição rápida do nome do workspace, aqui no menu (`PATCH /api/workspace`, coluna real).
  // O outro lugar é Configurações › Dados da empresa, que edita o mesmo campo junto com a logo e os
  // dados da agência — a mesma rota e a mesma coluna, então os dois não têm como divergir.
  function salvarNomeWorkspace() {
    const nome = nomeEmpresa.trim();
    if (!nome || nome === nomeEmpresaSincronizado) return;
    setSalvandoNome(true);
    fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        setNomeEmpresaSincronizado(nome);
        // Avisa o resto do app (Configurações lê do mesmo lugar), só depois do `ok` da rota.
        publicarNomeDaEmpresa(nome);
      })
      .catch((erro) => console.error("Falha ao atualizar nome do workspace:", erro))
      .finally(() => setSalvandoNome(false));
  }

  const souAdmin =
    equipe.find((m) => m.nome === currentUser.name)?.papelTipo === "admin";
  const outrosMembros = equipe.filter((m) => m.nome !== currentUser.name);

  const [gestaoAtividadeAberta, setGestaoAtividadeAberta] = useState(false);
  const gestaoAtividadeBtnRef = useRef<HTMLDivElement>(null);
  const [gestaoAtividadePos, setGestaoAtividadePos] = useState({ top: 0, left: 0 });
  const gestaoAtividadeFecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelarFechamentoGestaoAtividade() {
    if (gestaoAtividadeFecharRef.current) {
      clearTimeout(gestaoAtividadeFecharRef.current);
      gestaoAtividadeFecharRef.current = null;
    }
  }

  function abrirGestaoAtividade() {
    cancelarFechamentoGestaoAtividade();
    if (!gestaoAtividadeBtnRef.current) return;
    const rect = gestaoAtividadeBtnRef.current.getBoundingClientRect();
    const alturaEstimada = gestaoAtividadeItens.length * 46;
    setGestaoAtividadePos(posicionarFlyoutLateral(rect, 240, alturaEstimada));
    setGestaoAtividadeAberta(true);
  }

  /** Dá uma folga bem curta antes de fechar, só pra não fechar se o mouse passar rapidinho pelo
   * vão até o submenu: 2s (valor anterior) dava a sensação de "não fecha nunca" quando o mouse
   * saía de vez da sidebar. */
  function agendarFechamentoGestaoAtividade() {
    cancelarFechamentoGestaoAtividade();
    gestaoAtividadeFecharRef.current = setTimeout(() => {
      setGestaoAtividadeAberta(false);
    }, 200);
  }

  /** Se o mouse for direto pra outro item do menu (não pro submenu), fecha na hora. */
  function fecharGestaoAtividadeNaHora() {
    if (!gestaoAtividadeAberta) return;
    cancelarFechamentoGestaoAtividade();
    setGestaoAtividadeAberta(false);
  }

  useEffect(() => cancelarFechamentoGestaoAtividade, []);

  const gestaoAtividadePopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gestaoAtividadeAberta) return;
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (gestaoAtividadeBtnRef.current?.contains(alvo)) return;
      if (gestaoAtividadePopRef.current?.contains(alvo)) return;
      setGestaoAtividadeAberta(false);
    }
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setGestaoAtividadeAberta(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [gestaoAtividadeAberta]);

  return (
    <aside
      className={`sidebar${recolhida ? " recolhida" : ""}${recolhida && sobreposta ? " sobreposta" : ""}`}
      onMouseEnter={() => recolhida && setSobreposta(true)}
      onMouseLeave={() => setSobreposta(false)}
    >
      <div className="sb-brand">
        {/* O quadradinho e o nome vêm do mesmo componente que a prévia em Configurações usa: é o
            que garante que a logo enviada apareça aqui exatamente como foi mostrada lá. */}
        <MarcaDoTopo mostrarNome={mostrandoNomes} />
        <button
          type="button"
          className="sb-recolher"
          aria-label={recolhida ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          onClick={alternarRecolhida}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: recolhida ? "rotate(180deg)" : "none" }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="dropdown-anchor">
        <button
          type="button"
          className="sb-workspace"
          onClick={(e) => {
            if (workspaceAberto) {
              setWorkspaceAberto(false);
            } else {
              setWorkspaceAnchorRect(e.currentTarget.getBoundingClientRect());
              setWorkspaceAberto(true);
            }
          }}
        >
          {mostrandoNomes ? (
            <>
              <p className="l">{traduzir("Workspace")}</p>
              <p className="v">{nomeEmpresa}</p>
            </>
          ) : (
            <div className="avatar sm" title={nomeEmpresa}>
              {(nomeEmpresa || "?")
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
          )}
        </button>

        {workspaceAberto && workspacePos && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setWorkspaceAberto(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  ref={workspacePopRef}
                  className="dropdown-pop"
                  style={{
                    position: "fixed",
                    top: workspacePos.top,
                    left: workspacePos.left,
                    width: 300,
                    padding: "4px 0",
                    zIndex: 201,
                  }}
                >
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 14px 10px" }}>
                <div
                  className="avatar"
                  style={{ width: 44, height: 44, borderRadius: 12, fontSize: 16 }}
                >
                  {(nomeEmpresa || "?")
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </div>
              </div>
              <div className="field">
                <label>{traduzir("Nome da empresa")}</label>
                {souAdmin ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      value={nomeEmpresa}
                      onChange={(e) => setNomeEmpresa(e.target.value)}
                      onBlur={salvarNomeWorkspace}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      disabled={salvandoNome}
                    />
                  </div>
                ) : (
                  <div className="input">{nomeEmpresa || "-"}</div>
                )}
              </div>
              <div className="panel-h divided">
                <h4>{traduzir("Quem está logado agora")}</h4>
              </div>
              <div className="field">
                <label>{traduzir("Nome")}</label>
                <div className="input">{currentUser.name}</div>
              </div>
              <div className="field">
                <label>{traduzir("E-mail")}</label>
                <div className="input">{currentUser.email}</div>
              </div>
              <div className="field">
                <label>{traduzir("Papel")}</label>
                <div className="input">{currentUser.role}</div>
              </div>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>

      <nav className="nav">
        {navEntries.map(({ href, label, Icon }) => {
          if (gestaoAtividadeHrefs.has(href)) {
            if (href !== gestaoAtividadeItens[0].href) return null;
            const gestaoAtiva = gestaoAtividadeItens.some(
              (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
            );
            return (
              <div
                key="gestao-atividade"
                ref={gestaoAtividadeBtnRef}
                onMouseEnter={abrirGestaoAtividade}
                onMouseLeave={agendarFechamentoGestaoAtividade}
              >
                {/*
                  CLICAR ABRE A TELA, em vez de abrir um menu flutuante.

                  "Quando eu clico em inteligência comercial, já abre tudo."

                  Era um <button> que só abria o submenu — e submenu que vive sobre o conteúdo
                  some quando o ponteiro escorrega, e no celular não existe. Agora o clique leva a
                  Tráfego, e lá dentro as sete telas ficam numa coluna fixa ao lado
                  (`MenuInteligencia`), do jeito que Configurações faz.

                  O voo ao passar o mouse continua, como atalho para quem já sabe onde quer ir. O
                  que sumiu foi a dependência dele: por teclado, Tab + Enter agora abre a tela em
                  vez de não fazer nada.
                */}
                <Link
                  href={INTELIGENCIA_INICIAL}
                  prefetch
                  className={`nav-item${gestaoAtiva ? " active" : ""}`}
                  style={{ width: "100%", textAlign: "left" }}
                  title={mostrandoNomes ? undefined : traduzir("Inteligência comercial")}
                >
                  <IconRelatorios />
                  {mostrandoNomes ? (
                    <>
                      {traduzir("Inteligência comercial")}
                      <span className="r" style={{ marginLeft: "auto" }}>▸</span>
                    </>
                  ) : null}
                </Link>
              </div>
            );
          }
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <div key={href} onMouseEnter={fecharGestaoAtividadeNaHora}>
              <Link
                href={href}
                /* Sem isto, o padrão em rota dinâmica prefetcha só a casca até o `loading.tsx`, e o
                   conteúdo da tela ainda é buscado no servidor na hora do clique: é a espera entre
                   clicar e a página entrar. Com `true`, a rota inteira já está no cliente antes do
                   clique. Custa pouco aqui porque as telas são componentes de cliente (o payload é
                   casca, não dados) e a sessão é JWT, então prefetch não vira consulta no banco. */
                prefetch
                className={`nav-item${href === "/conversas" ? " nav-item-whatsapp" : ""}${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={mostrandoNomes ? undefined : traduzir(label)}
              >
                <Icon />
                {mostrandoNomes ? (
                  <>
                    {traduzir(label)}
                    {href === "/azuz-ia" ? <span className="nav-badge-em-breve">{traduzir("Em breve")}</span> : null}
                  </>
                ) : null}
                <IndoPara />
              </Link>
              {href === "/funil" && mostrandoNomes ? (
                <div className="nav-sublist">
                  {funis.map((f) => {
                    const subAtivo = active && f.id === funilAtivoId;
                    return (
                      <Link
                        key={f.id}
                        href="/funil"
                        className={`nav-subitem${subAtivo ? " active" : ""}${
                          funilAlvo === f.id && funilArrastando !== f.id ? " nav-subitem-alvo" : ""
                        }${funilArrastando === f.id ? " nav-subitem-arrastando" : ""}`}
                        draggable
                        onClick={() => setFunilAtivoId(f.id)}
                        onDragStart={(e) => {
                          setFunilArrastando(f.id);
                          // Sem isto o navegador arrasta o LINK: o Chrome cria uma sombra com o
                          // endereço e, ao soltar fora, tenta navegar pra ele.
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", f.id);
                        }}
                        onDragOver={(e) => {
                          // `preventDefault` é o que AUTORIZA o soltar. Sem ele o navegador recusa
                          // a área inteira e o cursor fica com o sinal de proibido o tempo todo.
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (funilAlvo !== f.id) setFunilAlvo(f.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          soltarFunil(f.id);
                        }}
                        onDragEnd={() => {
                          setFunilArrastando(null);
                          setFunilAlvo(null);
                        }}
                      >
                        {f.nome}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {gestaoAtividadeAberta && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={gestaoAtividadePopRef}
              className="dropdown-pop"
              style={{
                position: "fixed",
                top: gestaoAtividadePos.top,
                left: gestaoAtividadePos.left,
                width: 240,
                padding: "4px 0",
                zIndex: 210,
              }}
              onMouseEnter={cancelarFechamentoGestaoAtividade}
              onMouseLeave={agendarFechamentoGestaoAtividade}
            >
              {gestaoAtividadeItens.map((item) => {
                const subAtivo =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (item.href === "/crm-live") {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dropdown-item"
                      style={{ width: "100%", textAlign: "left" }}
                      title={traduzir("Abre numa aba nova: telão pra projetar no escritório")}
                    >
                      <span className="n">{traduzir(item.label)}</span>
                      <span className="r">{traduzir("TV")}</span>
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    /* Só entram em viewport quando o menu abre, então o prefetch acontece no
                       momento em que a pessoa demonstra intenção, não no carregamento da página. */
                    prefetch
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setGestaoAtividadeAberta(false)}
                  >
                    <span className="n">{traduzir(item.label)}</span>
                    {subAtivo ? <span className="r">●</span> : null}
                  </Link>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      <div className="sb-foot">
        <button
          type="button"
          className="sb-foot-info"
          aria-haspopup="true"
          aria-expanded={contaAberta}
          onClick={(e) => {
            if (contaAberta) {
              setContaAberta(false);
            } else {
              setContaAnchorRect(e.currentTarget.getBoundingClientRect());
              setContaAberta(true);
            }
          }}
        >
          <div className="avatar sm" title={mostrandoNomes ? undefined : currentUser.name}>{currentUser.initials}</div>
          {mostrandoNomes ? (
            <div>
              <p className="who">
                {currentUser.name}
                <span className="sb-foot-chevron">▾</span>
              </p>
              <p className="role">{currentUser.role}</p>
            </div>
          ) : null}
        </button>

        {contaAberta && contaPos && typeof document !== "undefined"
          ? createPortal(
              <>
                <div
                  onClick={() => setContaAberta(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 200 }}
                />
                <div
                  ref={contaPopRef}
                  className="account-pop"
                  style={{
                    position: "fixed",
                    top: contaPos.top,
                    left: contaPos.left,
                    right: "auto",
                    bottom: "auto",
                    width: 280,
                    zIndex: 201,
                  }}
                >
                  {souAdmin ? (
                    <>
                      <div className="dropdown-item" style={{ cursor: "default" }}>
                        <span className="n">{traduzir("Trocar de conta")}</span>
                        <span className="r">Você está como {currentUser.name}</span>
                      </div>
                      {outrosMembros.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className="dropdown-item"
                          style={{ width: "100%", textAlign: "left" }}
                          onClick={() => setContaAberta(false)}
                        >
                          <span className="n">{m.nome}</span>
                          <span className="r">{m.papel}</span>
                        </button>
                      ))}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="dropdown-item"
                    style={{ width: "100%", textAlign: "left", borderTop: "1px solid var(--line)" }}
                    onClick={() => {
                      setContaAberta(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                  >
                    <span className="n">↪ Sair</span>
                  </button>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </aside>
  );
}
