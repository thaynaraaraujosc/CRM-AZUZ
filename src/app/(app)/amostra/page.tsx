"use client";

import { useState } from "react";

/**
 * A prova visual do sistema, numa página só.
 *
 * POR QUE ELA EXISTE. A refatoração visual é a única parte deste projeto que não pode ser conferida
 * por teste: `npm run build` diz que o CSS compila, e não diz nada sobre estar bonito. Nas últimas
 * rodadas isso custou caro — mudanças foram descritas como prontas sem ninguém ter visto, e uma
 * delas deixou o produto pior.
 *
 * Aqui todos os elementos da linguagem aparecem lado a lado, em todos os estados. Aprovar ou
 * corrigir acontece UMA vez, olhando esta página, antes de a linguagem ser propagada por vinte
 * telas. Erro caro vira erro barato.
 *
 * Não tem dado real nem chamada a API: é uma vitrine. Sair do ar não afeta nada do produto.
 */
export default function AmostraPage() {
  const [aba, setAba] = useState("elevacao");
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Amostra do sistema visual</h2>
          </div>
          <p className="sub">Todos os componentes, em todos os estados, numa tela só</p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn primary" onClick={() => setModalAberto(true)}>
            Abrir modal
          </button>
        </div>
      </div>

      <div className="content amostra">
        {/* ------------------------------------------------------------ elevação */}
        <section className="amostra-secao">
          <h3>Níveis de profundidade</h3>
          <p className="amostra-nota">
            Cinco planos. Cada um se reconhece por sombra e borda, não por cor diferente.
          </p>
          <div className="amostra-grid">
            {[
              ["Nível 0 · Fundo", "A superfície de trabalho. Sem sombra, sem borda.", "n0"],
              ["Nível 1 · Estrutura", "Sidebar, cabeçalho. Divisa por linha.", "n1"],
              ["Nível 2 · Card", "Contorno claro e contato com a superfície.", "n2"],
              ["Nível 3 · Controle", "Input, filtro, chip. Dentro de um card.", "n3"],
              ["Nível 4 · Flutuante", "Modal, dropdown. Acima de tudo.", "n4"],
            ].map(([titulo, desc, nivel]) => (
              <div className={`amostra-plano amostra-${nivel}`} key={nivel}>
                <strong>{titulo}</strong>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ botões */}
        <section className="amostra-secao">
          <h3>Botões</h3>
          <p className="amostra-nota">Seis variantes. Cada uma com repouso, hover, foco e desabilitado.</p>
          <div className="amostra-linha">
            <button type="button" className="btn primary">Primário</button>
            <button type="button" className="btn escuro">Escuro</button>
            <button type="button" className="btn">Secundário</button>
            <button type="button" className="btn ghost">Fantasma</button>
            <button type="button" className="btn danger">Perigo</button>
            <button type="button" className="btn primary" disabled>Desabilitado</button>
          </div>
          <div className="amostra-linha">
            <button type="button" className="btn primary sm">Pequeno</button>
            <button type="button" className="btn sm">Pequeno</button>
          </div>
        </section>

        {/* ------------------------------------------------------------ campos */}
        <section className="amostra-secao">
          <h3>Campos</h3>
          <p className="amostra-nota">
            Fundo branco, borda perceptível em repouso. O azul aparece só no foco.
          </p>
          <div className="amostra-grid-2">
            <div className="field">
              <label htmlFor="a-nome">Nome</label>
              <input id="a-nome" className="input" placeholder="Clínica Aurora" />
            </div>
            <div className="field">
              <label htmlFor="a-sel">Etapa</label>
              <select id="a-sel" className="input" defaultValue="novo">
                <option value="novo">Novo lead</option>
                <option value="prop">Proposta</option>
              </select>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ abas e chips */}
        <section className="amostra-secao">
          <h3>Abas, chips e selos</h3>
          <div className="amostra-linha">
            {["elevacao", "tipografia", "cor"].map((chave) => (
              <button
                key={chave}
                type="button"
                className={`amostra-aba${aba === chave ? " ativa" : ""}`}
                onClick={() => setAba(chave)}
              >
                {chave === "elevacao" ? "Profundidade" : chave === "tipografia" ? "Tipografia" : "Cor"}
              </button>
            ))}
          </div>
          <div className="amostra-linha">
            <span className="amostra-selo">Neutro</span>
            <span className="amostra-selo amostra-selo-acento">Ativo</span>
            <span className="amostra-selo amostra-selo-ok">Conectado</span>
            <span className="amostra-selo amostra-selo-erro">Perdido</span>
          </div>
        </section>

        {/* ------------------------------------------------------------ tipografia */}
        <section className="amostra-secao">
          <h3>Tipografia</h3>
          <div className="card amostra-tipo">
            <p className="amostra-t-page">Título de página</p>
            <p className="amostra-t-secao">Título de seção</p>
            <p className="amostra-t-card">Título de card</p>
            <p className="amostra-t-corpo">
              Corpo. É o texto que se lê de verdade, e por isso tem a medida de leitura limitada e o
              contraste mais alto do que qualquer informação de apoio.
            </p>
            <p className="amostra-t-label">RÓTULO</p>
            <p className="amostra-t-apoio">Texto de apoio, para explicar sem competir.</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ mensagens */}
        <section className="amostra-secao">
          <h3>Conversa</h3>
          <p className="amostra-nota">
            Recebida e enviada precisam se distinguir de longe, sem duas cores quase iguais.
          </p>
          <div className="amostra-chat">
            <div className="amostra-balao amostra-balao-recebida">
              Oi! Vi o anúncio de vocês e queria saber o valor da avaliação.
              <span className="amostra-hora">14:02</span>
            </div>
            <div className="amostra-balao amostra-balao-enviada">
              Olá, Marina! A primeira avaliação é gratuita. Posso te encaixar amanhã às 10h?
              <span className="amostra-hora">14:05 ✓✓</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ tabela */}
        <section className="amostra-secao">
          <h3>Tabela</h3>
          <div className="card amostra-tabela-caixa">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Investimento</th>
                  <th>Leads</th>
                  <th>Custo / lead</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Implantes · Setembro</td><td>R$ 4.820,00</td><td>38</td><td>R$ 126,84</td></tr>
                <tr><td>Clareamento · Institucional</td><td>R$ 1.240,00</td><td>12</td><td>R$ 103,33</td></tr>
                <tr><td>Avaliação gratuita</td><td>R$ 960,00</td><td>21</td><td>R$ 45,71</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalAberto ? (
        <>
          <div className="amostra-veu" onClick={() => setModalAberto(false)} aria-hidden="true" />
          <div className="amostra-modal" role="dialog" aria-label="Exemplo de modal">
            <div className="amostra-modal-h">
              <h4>Desconectar o Google Ads?</h4>
            </div>
            <div className="amostra-modal-corpo">
              <p>
                As campanhas param de aparecer na tela de Tráfego. Nenhum lead, contato ou conversa é
                apagado, e você pode reconectar quando quiser.
              </p>
            </div>
            <div className="amostra-modal-f">
              <button type="button" className="btn ghost" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={() => setModalAberto(false)}>
                Desconectar
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
