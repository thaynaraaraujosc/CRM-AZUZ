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
      <section className="card">
        <h2>Conta de demonstração pronta</h2>
        <p className="sub">
          {pronto.empresa} · {pronto.resumo.contatos} contatos, {pronto.resumo.conversas} conversas,{" "}
          {pronto.resumo.mensagens} mensagens, {pronto.resumo.tarefas} tarefas e {pronto.resumo.fechados} negócios
          encerrados.
        </p>
        <p>
          Entre com <strong>{pronto.email}</strong> e a senha que você acabou de definir. Todos os dados são
          fictícios: nenhum contato, telefone ou conversa de cliente real aparece nessa conta.
        </p>
        <button type="button" className="btn ghost" onClick={() => setPronto(null)}>
          Fechar
        </button>
      </section>
    );
  }

  if (!aberto) {
    return (
      <section className="card">
        <h2>Conta de demonstração</h2>
        <p className="sub">
          Empresa fictícia com contatos, conversas, funil, tarefas e negócios encerrados. Para gravar vídeo e
          mostrar o produto sem expor dado de cliente.
        </p>
        <button type="button" className="btn primary" onClick={() => setAberto(true)}>
          Montar ou remontar
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Montar conta de demonstração</h2>
      <p className="sub">
        Isso apaga e recria a conta de demonstração do zero. Nenhuma outra conta é tocada.
      </p>

      <form onSubmit={enviar}>
        <label htmlFor="demo-senha">Senha de acesso da conta de demonstração</label>
        <input
          id="demo-senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="pelo menos 8 caracteres"
        />

        <label htmlFor="demo-confirmar">
          Escreva <strong>MONTAR</strong> para confirmar
        </label>
        <input
          id="demo-confirmar"
          type="text"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="off"
        />

        {erro ? <p className="erro">{erro}</p> : null}

        <div className="acoes">
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
    </section>
  );
}
