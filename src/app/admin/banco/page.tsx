"use client";

import { useEffect, useState } from "react";

import { Ajuda, Topbar, KpiCard } from "@/components/ui";

type CustoBanco = {
  ligadoHa: string;
  saida: { total: string; porDia: string; custoMensalEstimadoUSD: number };
  consultas: { selects: number; porMinuto: number; bytesPorSelect: string };
  conexoes: { abertas: number; totalDesdeQueSubiu: number; recusadas: number; maximo: string };
  memoria: { bufferPoolConfigurado: string; bufferPoolEmUso: string };
  anexosNoBanco: {
    mensagens: number;
    tamanho: string;
    porWorkspace: { workspaceId: string; nome: string; mensagens: number; tamanho: string }[];
  };
  maioresTabelas: { tabela: string; linhas: number; tamanho: string }[];
  versao: string;
};

/**
 * Onde a fatura do banco é MEDIDA, não adivinhada.
 *
 * PRA QUE ELA SERVE, já que a pergunta apareceu: toda vez que a conta da hospedagem sobe, a
 * discussão vai pro campo do palpite. Esta tela responde duas coisas com número: o gasto é de
 * poucas consultas gigantes ou de muitas pequenas (o conserto é diferente em cada caso), e sobrou
 * anexo pesado dentro do banco — em qual empresa.
 *
 * O texto de cada número virou "?": quem já sabe não precisa reler a explicação toda vez, e o
 * painel passa a caber numa tela.
 */
export default function AdminBancoPage() {
  const [dados, setDados] = useState<CustoBanco | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/custo-banco")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then(setDados)
      .catch(() => setErro("Falha ao medir o banco."));
  }, []);

  if (erro) {
    return (
      <div className="view">
        <Topbar title="Custo do banco" sub="Medição direta do MySQL." />
        <p className="admin-secao" style={{ color: "var(--danger)" }}>{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="view">
        <Topbar title="Custo do banco" sub="Medição direta do MySQL." />
        <p className="admin-secao">Medindo…</p>
      </div>
    );
  }

  const { saida, consultas, conexoes, memoria, anexosNoBanco } = dados;

  return (
    <div className="view">
      <Topbar
        title="Custo do banco"
        sub={`O que o banco gasta hoje · ligado há ${dados.ligadoHa} · MySQL ${dados.versao}`}
      />

      {/*
        O QUE ESTA TELA SERVE, em uma linha cada.
        
        Ela existe pra responder "por que a conta do banco subiu?" sem palpite. A explicação longa
        de cada número virou "?": quem já sabe não lê a mesma parede de texto toda vez, e quem não
        sabe passa o mouse.
      */}
      <div className="grid kpi4">
        <KpiCard
          label="Saída por dia"
          value={saida.porDia}
          ajuda="Quanto dado sai do banco por dia. É isto que a hospedagem cobra como egresso — e é a maior linha da fatura."
        />
        <KpiCard
          label="Custo estimado no mês"
          value={`US$ ${saida.custoMensalEstimadoUSD.toFixed(2)}`}
          ajuda="A saída por dia multiplicada pelo mês, no preço de egresso da hospedagem. É estimativa: a fatura real pode variar com o que mais rodar no mesmo servidor."
        />
        <KpiCard
          label="Bytes por consulta"
          value={consultas.bytesPorSelect}
          ajuda="Número alto quer dizer poucas consultas gigantes (o conserto é pedir menos colunas e menos linhas). Número baixo com muitas consultas quer dizer o contrário (o conserto é cache)."
        />
        <KpiCard
          label="Consultas por minuto"
          value={String(consultas.porMinuto)}
          ajuda="Quantas vezes por minuto o CRM pergunta alguma coisa ao banco, somando todos os clientes."
        />
      </div>

      <div className="card admin-secao">
        <div className="panel-h">
          <h4>
            Anexos ainda dentro do banco
            <Ajuda texto="Arquivo gravado dentro da própria mensagem, no formato antigo. Cada byte daqui sai do banco toda vez que alguém abre as Conversas daquela empresa, e é cobrado como saída. O botão que move pra nuvem fica em Configurações → Plano e cobrança, dentro da empresa." />
          </h4>
        </div>
        <div style={{ padding: "0 17px 17px" }}>
          {anexosNoBanco.mensagens === 0 ? (
            <p className="r">Nada pendente em nenhuma empresa.</p>
          ) : (
            <>
              <p className="r" style={{ marginBottom: 12 }}>
                <strong>{anexosNoBanco.mensagens}</strong> mensagens · <strong>{anexosNoBanco.tamanho}</strong> no total
              </p>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Mensagens</th>
                      <th>Tamanho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anexosNoBanco.porWorkspace.map((w) => (
                      <tr key={w.workspaceId}>
                        <td><span className="n">{w.nome}</span></td>
                        <td>{w.mensagens}</td>
                        <td>{w.tamanho}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card admin-secao">
        <div className="panel-h">
          <h4>
            Maiores tabelas
            <Ajuda texto="Onde o espaço está. Tabela grande não é problema por si só — ela vira problema quando é lida inteira em toda tela." />
          </h4>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Tabela</th>
                <th>Linhas</th>
                <th>Tamanho</th>
              </tr>
            </thead>
            <tbody>
              {dados.maioresTabelas.map((t) => (
                <tr key={t.tabela}>
                  <td><span className="n">{t.tabela}</span></td>
                  <td>{t.linhas.toLocaleString("pt-BR")}</td>
                  <td>{t.tamanho}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card admin-secao">
        <div className="panel-h">
          <h4>
            Memória e conexões
            <Ajuda texto="Conexão recusada em número crescente é o sinal de que o banco está no limite: é a hora de aumentar o plano da hospedagem, antes de o CRM começar a dar erro de conexão." />
          </h4>
        </div>
        <div className="config-grid-2" style={{ padding: "0 17px 17px" }}>
          <div className="field">
            <label>Buffer pool configurado</label>
            <p className="r">{memoria.bufferPoolConfigurado}</p>
          </div>
          <div className="field">
            <label>Buffer pool em uso</label>
            <p className="r">{memoria.bufferPoolEmUso}</p>
          </div>
          <div className="field">
            <label>Conexões abertas</label>
            <p className="r">{conexoes.abertas} de {conexoes.maximo}</p>
          </div>
          <div className="field">
            <label>Conexões recusadas</label>
            <p className="r">{conexoes.recusadas.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
