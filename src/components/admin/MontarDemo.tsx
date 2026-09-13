"use client";

import { useState, type FormEvent } from "react";

type Resultado = {
  workspaceId: string;
  empresa: string;
  email: string;
  resumo: { contatos: number; conversas: number; mensagens: number; tarefas: number; fechados: number };
};

/**
 * Monta e remonta a conta de demonstração.
 *
 * Existe pra resolver duas coisas de uma vez. Demonstrar o CRM hoje significa abrir a conta real e
 * deixar na tela o nome, o telefone e a conversa de cliente de verdade, seja numa reunião de venda
 * seja na gravação do vídeo de apresentação. E conta nova, por outro lado, está vazia: funil sem
 * card e relatório sem número parecem um produto que não faz nada.
 *
 * Remontar é o uso normal, não o excepcional: depois de cada demonstração a conta fica com card
 * arrastado e tarefa concluída, e é o botão que devolve tudo ao estado inicial que faz ela servir
 * na décima vez.
 *
 * A confirmação escrita existe porque a operação APAGA. Ela apaga só a conta de demonstração (a
 * rota recusa qualquer outro alvo), mas um botão destrutivo que dispara no primeiro clique é um
 * hábito ruim de deixar num painel que também mexe em conta de cliente pagante.
 *
 * As classes seguem `CriarContaCortesia` (`config-bloco`, `field`, `input`, `config-acoes`), e não
 * um conjunto próprio: a primeira versão inventou `card` e `label` solto, e o bloco saiu sem
 * espaçamento nenhum, com o rótulo grudado no campo. Componente de painel herda o painel.
 */
export function MontarDemo() {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<Resultado | null>(null);

  const confirmado = confirmacao.trim().toUpperCase() === "MONTAR";

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível montar a conta de demonstração.");
        return;
      }
      setPronto(dados as Resultado);
      setSenha("");
      setConfirmacao("");
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (pronto) {
    return (
      <div className="admin-bloco config-bloco">
        <p className="config-bloco-titulo">Conta de demonstração pronta</p>
        <p className="hint">
          {pronto.empresa}: {pronto.resumo.contatos} contatos, {pronto.resumo.conversas} conversas,{" "}
          {pronto.resumo.mensagens} mensagens, {pronto.resumo.tarefas} tarefas e {pronto.resumo.fechados} negócios
          encerrados. Todos os dados são fictícios: nenhum contato, telefone ou conversa de cliente real aparece
          nessa conta.
        </p>
        <div className="field">
          <label htmlFor="demo-acesso">Entre com este e-mail e a senha que você definiu</label>
          <input id="demo-acesso" className="input" readOnly value={pronto.email} />
        </div>
        <div className="config-acoes">
          <button type="button" className="btn ghost" onClick={() => setPronto(null)}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="admin-bloco config-bloco">
        <p className="config-bloco-titulo">Conta de demonstração</p>
        <p className="hint">
          Empresa fictícia com contatos, conversas, funil, tarefas e negócios encerrados. Para gravar vídeo e
          mostrar o produto sem expor dado de cliente.
        </p>
        <div className="config-acoes">
          <button type="button" className="btn ghost" onClick={() => setAberto(true)}>
            Montar ou remontar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="admin-bloco config-bloco" onSubmit={enviar}>
      <p className="config-bloco-titulo">Montar conta de demonstração</p>
      <p className="hint">
        Isso apaga e recria a conta de demonstração do zero. Nenhuma outra conta é tocada.
      </p>

      <div className="field">
        <label htmlFor="demo-senha">Senha de acesso da conta de demonstração</label>
        <input
          id="demo-senha"
          className="input"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="pelo menos 8 caracteres"
        />
      </div>

      <div className="field">
        <label htmlFor="demo-confirmar">Escreva MONTAR para confirmar</label>
        <input
          id="demo-confirmar"
          className="input"
          type="text"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="off"
          placeholder="MONTAR"
        />
      </div>

      {erro ? <p className="auth-erro">{erro}</p> : null}

      <div className="config-acoes">
        <button type="submit" className="btn primary" disabled={salvando || !confirmado || senha.length < 8}>
          {salvando ? "Montando..." : "Montar conta"}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setAberto(false);
            setErro(null);
            setConfirmacao("");
          }}
          disabled={salvando}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
