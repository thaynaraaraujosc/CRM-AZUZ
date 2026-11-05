"use client";

import { use, useEffect, useState } from "react";

import { Ajuda, Topbar } from "@/components/ui";
import { PRAZOS_DE_CORTESIA } from "@/lib/assinatura/cortesia";
import { PLANOS } from "@/lib/assinatura/planos";
import { useAcoesMembro } from "@/lib/admin/use-acoes-membro";

type Membro = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  papelTipo: string;
  ativo: boolean;
  /** Existe uma senha que NÓS entregamos e que a pessoa ainda não trocou? */
  temSenhaNossa: boolean;
};

type Integracao = {
  id: string;
  provedor: string;
  status: string;
};

type Assinatura = {
  plano: string;
  status: string;
  valor: string;
  proximoVencimento: string | null;
  cortesiaAte: string | null;
  asaasSubscriptionId: string | null;
  /** Contado no servidor: ler o relógio durante o render é proibido pelo compilador do React. */
  diasDeCortesia: number | null;
  ehCortesia: boolean;
} | null;

type WorkspaceDetalhe = {
  id: string;
  nome: string;
  slug: string;
  membros: Membro[];
  integracoes: Integracao[];
  assinatura: Assinatura;
};

const NOME_PROVEDOR: Record<string, string> = {
  meta_whatsapp: "WhatsApp Business (Meta)",
  whatsapp_baileys: "WhatsApp via QR Code",
  meta_instagram: "Instagram",
};

/** Detalhe de um workspace pro super-admin: todos os membros (com botão pra ativar/desativar
 * acesso e trocar papelTipo), integrações conectadas, e a assinatura: com plano/status editáveis
 * direto (sobrescrita manual, ver comentário na rota `PATCH /api/admin/workspaces/[id]`). */
export default function AdminWorkspaceDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [workspace, setWorkspace] = useState<WorkspaceDetalhe | null>(null);
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const [vendoSenha, setVendoSenha] = useState<string | null>(null);
  const [senhaDoMembro, setSenhaDoMembro] = useState<{ id: string; senha: string | null; motivo?: string } | null>(null);
  const { senhaGerada, setSenhaGerada, carregandoId, resetarSenha, entrarComo } = useAcoesMembro();

  function carregar() {
    fetch(`/api/admin/workspaces/${id}`)
      .then((r) => r.json())
      .then(setWorkspace);
  }

  useEffect(carregar, [id]);

  async function alterarStatusAssinatura(valor: string) {
    setSalvandoAssinatura(true);
    await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assinatura: { status: valor } }),
    });
    carregar();
    setSalvandoAssinatura(false);
  }

  /**
   * Liga, desliga ou muda o prazo da cortesia.
   *
   * `cortesia: false` encerra e manda a conta pra tela de pagamento. `true` sem meses é cortesia
   * sem prazo — a conta dada pra sempre; com meses, é cortesia até a data.
   */
  async function alterarCortesia(cortesia: boolean, meses = 0) {
    setSalvandoAssinatura(true);
    await fetch(`/api/admin/workspaces/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assinatura: { cortesia, cortesiaMeses: meses } }),
    });
    carregar();
    setSalvandoAssinatura(false);
  }

  /**
   * Mostra a senha que a Azuz entregou — enquanto ela ainda é a nossa.
   *
   * A senha não vem junto da lista: ela é buscada no clique, por uma rota própria que registra
   * quem olhou. Numa resposta de lista ela ficaria no cache do navegador e na memória de uma aba
   * aberta a tarde inteira, pra todos os usuários de uma vez.
   */
  async function verSenha(membroId: string) {
    setVendoSenha(membroId);
    try {
      const resposta = await fetch(`/api/admin/membros/${membroId}/senha`);
      const dados = (await resposta.json().catch(() => ({}))) as { senha?: string | null; motivo?: string };
      setSenhaDoMembro({ id: membroId, senha: dados.senha ?? null, motivo: dados.motivo });
    } finally {
      setVendoSenha(null);
    }
  }

  async function apagarMembro(membroId: string, nome: string) {
    if (!window.confirm(`Apagar a conta de ${nome}? Isso não tem volta.`)) return;
    const resposta = await fetch(`/api/admin/membros/${membroId}`, { method: "DELETE" });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      window.alert(corpo.erro ?? "Não foi possível apagar.");
      return;
    }
    carregar();
  }

  async function alterarMembro(membroId: string, dados: Partial<Pick<Membro, "ativo" | "papelTipo">>) {
    await fetch(`/api/admin/membros/${membroId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dados),
    });
    carregar();
  }

  if (!workspace) {
    return (
      <div className="view">
        <Topbar title="Workspace" />
        <p className="admin-secao" style={{ color: "var(--text-muted)" }}>Carregando…</p>
      </div>
    );
  }

  const cortesiaAte = workspace.assinatura?.cortesiaAte ? new Date(workspace.assinatura.cortesiaAte) : null;
  const diasRestantes = workspace.assinatura?.diasDeCortesia ?? null;
  const temCobranca = Boolean(workspace.assinatura?.asaasSubscriptionId?.trim());
  const cortesiaLigada = Boolean(workspace.assinatura?.ehCortesia);

  /**
   * O estado da cortesia em uma frase, pro "?" — porque ele muda de conta pra conta.
   *
   * Quando existe cobrança de verdade na Asaas, a frase diz isso em voz alta: marcar cortesia
   * aqui LIBERA O ACESSO e não encerra nada lá. São dois sistemas, e quem esquece do segundo
   * descobre pela fatura do cliente.
   */
  const avisoDaAsaas = temCobranca
    ? " A cobrança na Asaas continua existindo: liberar o acesso aqui não cancela a assinatura lá."
    : "";
  const explicacaoDaCortesia = !cortesiaLigada
    ? (temCobranca
        ? "Esta conta tem cobrança de verdade na Asaas. Marcando “Sim”, ela passa a usar o CRM sem cobrança."
        : "Sem cortesia: a conta precisa pagar pra usar o CRM. Marcando “Sim”, ela é liberada sem nenhuma cobrança.") +
      avisoDaAsaas
    : (cortesiaAte
        ? `Grátis até ${cortesiaAte.toLocaleDateString("pt-BR")}${
            diasRestantes !== null && diasRestantes >= 0
              ? ` — faltam ${diasRestantes} dias, e depois disso a cobrança começa a contar.`
              : " — o prazo já venceu, e a conta está na tela de pagamento."
          }`
        : "De graça por tempo indeterminado, até alguém marcar “Não” aqui. Escolha um prazo se quiser que a cobrança comece sozinha em alguma data.") +
      avisoDaAsaas;

  return (
    <div className="view">
      <Topbar title={workspace.nome} sub={`/${workspace.slug}`} />

      <div className="config-bloco">
        <p className="config-bloco-titulo">
          Assinatura
          <Ajuda texto="Mexer aqui muda o acesso direto no banco. Não cria nem cancela cobrança na Asaas: serve pra liberar, bloquear ou dar cortesia à mão." />
        </p>
        <div className="config-grid-2">
          <div className="field">
            <label>Plano</label>
            <p className="r">
              {PLANOS.completo.nome} ·{" "}
              {PLANOS.completo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
            </p>
          </div>
          <div className="field">
            <label>
              Acesso
              <Ajuda texto="Ativo entra no CRM; pendente, atrasado e cancelado caem na tela de pagamento." />
            </label>
            <select
              className="input"
              style={{ width: "100%" }}
              value={workspace.assinatura?.status ?? "ativa"}
              disabled={salvandoAssinatura}
              onChange={(e) => alterarStatusAssinatura(e.target.value)}
            >
              <option value="pendente">Pendente</option>
              <option value="ativa">Ativo</option>
              <option value="atrasada">Atrasado</option>
              <option value="cancelada">Cancelado</option>
            </select>
          </div>
        </div>

        {/*
          CORTESIA É SIM/NÃO, e o prazo é a pergunta seguinte.
          
          Antes eram só os botões de prazo, e faltava dizer a coisa mais simples: esta conta é de
          cortesia? Sem essa resposta não havia como dar a conta "pra sempre" — que é metade dos
          casos (sócio, parceiro, quem nunca vai ser cobrado) — nem como encerrar sem adivinhar
          qual botão faz isso.
        */}
        <div className="field admin-secao">
          <label>
            Conta de cortesia
            {/* A situação da cortesia mora no "?" junto da explicação: ela muda de conta pra
                conta, e uma frase embaixo dos botões vira parágrafo que ninguém lê depois da
                segunda vez. Quem precisa do prazo de relance lê na lista de empresas. */}
            <Ajuda texto={explicacaoDaCortesia} />
          </label>
          <div className="seg-picker" role="group" aria-label="Conta de cortesia">
            <button
              type="button"
              className={`seg-chip${cortesiaLigada ? " on" : ""}`}
              aria-pressed={cortesiaLigada}
              disabled={salvandoAssinatura}
              onClick={() => alterarCortesia(true, 0)}
            >
              Sim
            </button>
            <button
              type="button"
              className={`seg-chip${cortesiaLigada ? "" : " on"}`}
              aria-pressed={!cortesiaLigada}
              disabled={salvandoAssinatura}
              onClick={() => alterarCortesia(false)}
            >
              Não
            </button>
          </div>

          {cortesiaLigada ? (
            <div className="seg-picker admin-prazos" role="group" aria-label="Prazo da cortesia">
              <button
                type="button"
                className={`seg-chip${cortesiaAte ? "" : " on"}`}
                aria-pressed={!cortesiaAte}
                disabled={salvandoAssinatura}
                onClick={() => alterarCortesia(true, 0)}
              >
                Sem prazo
              </button>
              {/* O PRAZO ESCOLHIDO APARECE COMO A OPÇÃO MARCADA, e não como uma frase embaixo.
                  Os botões de prazo somam meses a partir de hoje: nenhum deles "é" a data que já
                  está valendo, então ela é a própria marca de seleção. Sem isto, com prazo
                  definido nenhum botão ficava aceso e a tela parecia não ter escolha nenhuma. */}
              {cortesiaAte ? (
                <span className="seg-chip on" aria-current="true">
                  {cortesiaAte.toLocaleDateString("pt-BR")}
                </span>
              ) : null}
              {PRAZOS_DE_CORTESIA.map((pr) => (
                <button
                  key={pr.meses}
                  type="button"
                  className="seg-chip"
                  disabled={salvandoAssinatura}
                  onClick={() => alterarCortesia(true, pr.meses)}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Integrações conectadas</p>
        {workspace.integracoes.length === 0 ? (
          <p className="hint admin-secao">Nenhuma integração conectada.</p>
        ) : (
          <div className="config-tabela-scroll">
            <table className="config-tabela-notif">
              <thead>
                <tr>
                  <th>Provedor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workspace.integracoes.map((i) => (
                  <tr key={i.id}>
                    <td>{NOME_PROVEDOR[i.provedor] ?? i.provedor}</td>
                    <td>
                      <span className={`pill${i.status === "conectado" ? " on" : ""}`}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Pessoas ({workspace.membros.length})</p>

        {senhaGerada ? (
          <div className="config-grid-2 admin-secao">
            <div className="field" style={{ padding: 0, gridColumn: "1 / -1" }}>
              <label>
                Senha nova
                <Ajuda texto="Copie agora: por segurança ela é guardada embaralhada e não aparece de novo." />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" style={{ width: "100%", fontFamily: "monospace" }} readOnly value={senhaGerada.senha} />
                <button type="button" className="btn ghost" onClick={() => navigator.clipboard.writeText(senhaGerada.senha)}>
                  Copiar
                </button>
                <button type="button" className="btn ghost" onClick={() => setSenhaGerada(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* A senha pedida fica num aviso próprio, acima da tabela — e não dentro da linha, onde
            ela passaria despercebida e ficaria na tela sem ninguém notar. */}
        {senhaDoMembro ? (
          <div className="config-grid-2 admin-secao">
            <div className="field" style={{ padding: 0, gridColumn: "1 / -1" }}>
              <label>
                Senha de {workspace.membros.find((m) => m.id === senhaDoMembro.id)?.nome ?? "—"}
                <Ajuda texto="É a senha que a Azuz entregou. Ela some daqui no momento em que a pessoa trocar a senha por conta própria — e aí nem o painel tem como ver." />
              </label>
              {senhaDoMembro.senha ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    style={{ width: "100%", fontFamily: "monospace" }}
                    readOnly
                    value={senhaDoMembro.senha}
                  />
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => navigator.clipboard.writeText(senhaDoMembro.senha ?? "")}
                  >
                    Copiar
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setSenhaDoMembro(null)}>
                    Fechar
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <p className="hint" style={{ flex: 1, padding: 0 }}>{senhaDoMembro.motivo}</p>
                  <button type="button" className="btn ghost" onClick={() => setSenhaDoMembro(null)}>
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="config-tabela-scroll">
          <table className="config-tabela-notif">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Tipo</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {workspace.membros.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td>
                  <td>{m.email}</td>
                  <td>{m.papel}</td>
                  <td>
                    <select
                      className="input"
                      value={m.papelTipo}
                      onChange={(e) => alterarMembro(m.id, { papelTipo: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="padrao">Padrão</option>
                      <option value="custom">Custom</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className={`btn ghost${m.ativo ? "" : " danger"}`} onClick={() => alterarMembro(m.id, { ativo: !m.ativo })}>
                      {m.ativo ? "Ativo" : "Bloqueado"}
                    </button>
                  </td>
                  <td>
                    <div className="admin-acoes-linha">
                      {/* "Ver senha" só aparece onde ele tem o que mostrar: conta que a Azuz
                          entregou pronta e que a pessoa ainda não trocou. */}
                      {m.temSenhaNossa ? (
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={vendoSenha === m.id}
                          onClick={() => void verSenha(m.id)}
                        >
                          {vendoSenha === m.id ? "Abrindo…" : "Ver senha"}
                        </button>
                      ) : null}
                      <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => resetarSenha(m.id)}>
                        Nova senha
                      </button>
                      <button type="button" className="btn ghost" disabled={carregandoId === m.id} onClick={() => entrarComo(m.id)}>
                        Entrar como
                      </button>
                      <button type="button" className="btn ghost danger" onClick={() => void apagarMembro(m.id, m.nome)}>
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
