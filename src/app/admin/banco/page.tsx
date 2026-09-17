"use client";

import { useEffect, useState } from "react";

import { Topbar, KpiCard } from "@/components/ui";

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
 * A rota `/api/admin/custo-banco` existia havia tempo e nenhuma tela chamava ela. O efeito prático
 * é que a medição estava escrita e continuava invisível, então toda vez que a conta do Railway
 * subia a discussão voltava pro campo do palpite — inclusive o meu, que já errou três hipóteses
 * olhando só o código. Um número que ninguém consegue ver não resolve discussão nenhuma.
 *
 * Duas perguntas esta tela responde direto:
 *
 * 1. "Muitas consultas pequenas" ou "poucas consultas gigantes"? É `bytesPorSelect` que decide, e
 *    o conserto de cada caso é diferente (cache/ETag num, `select`/`take` no outro).
 * 2. Sobrou anexo em base64 dentro do banco, em QUAL workspace? O botão de mover pra nuvem mora
 *    nas Configurações de cada cliente e só enxerga o dele. Aqui a conta é da plataforma inteira.
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
      <Topbar title="Custo do banco" sub={`Medição direta do MySQL · ligado há ${dados.ligadoHa} · v${dados.versao}`} />

      <div className="grid kpi4">
        <KpiCard label="Saída por dia" value={saida.porDia} />
        <KpiCard label="Custo mensal estimado" value={`US$ ${saida.custoMensalEstimadoUSD.toFixed(2)}`} />
        <KpiCard label="Bytes por consulta" value={consultas.bytesPorSelect} />
        <KpiCard label="Consultas por minuto" value={String(consultas.porMinuto)} />
      </div>

      <div className="card admin-secao">
        <div className="panel-h">
          <h4>Anexos ainda dentro do banco</h4>
        </div>
        <div style={{ padding: "0 17px 17px" }}>
          <p className="hint" style={{ paddingTop: 0 }}>
            Arquivo gravado em base64 na própria linha da mensagem, no formato antigo. Cada byte daqui sai do MySQL
            toda vez que a tela de Conversas daquele workspace é carregada do zero — e é cobrado como egresso. O botão
            que move pra nuvem fica em Configurações → Plano e cobrança, dentro do workspace.
          </p>
          {anexosNoBanco.mensagens === 0 ? (
            <p className="r">Nada pendente em nenhum workspace.</p>
          ) : (
            <>
              <p className="r" style={{ marginBottom: 12 }}>
                <strong>{anexosNoBanco.mensagens}</strong> mensagens · <strong>{anexosNoBanco.tamanho}</strong> no total
              </p>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Workspace</th>
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
          <h4>Maiores tabelas</h4>
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
          <h4>Memória e conexões</h4>
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
