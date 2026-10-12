"use client";

import { useState } from "react";
import { useIdioma } from "@/lib/idioma-context";

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
  const { t: traduzir } = useIdioma();
  const [aba, setAba] = useState("elevacao");
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>{traduzir("Amostra do sistema visual")}</h2>
          </div>
          <p className="sub">{traduzir("Todos os componentes, em todos os estados, numa tela só")}</p>
        </div>
        <div className="top-actions">
          <button type="button" className="btn primary" onClick={() => setModalAberto(true)}>
            {traduzir("Abrir modal")}
          </button>
        </div>
      </div>

      <div className="content amostra">
        {/* ------------------------------------------------------------ elevação */}
        <section className="amostra-secao">
          <h3>{traduzir("Níveis de profundidade")}</h3>
          <p className="amostra-nota">
            {traduzir("Cinco planos. Cada um se reconhece por sombra e borda, não por cor diferente.")}
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
          <h3>{traduzir("Botões")}</h3>
          <p className="amostra-nota">{traduzir("Seis variantes. Cada uma com repouso, hover, foco e desabilitado.")}</p>
          <div className="amostra-linha">
            <button type="button" className="btn primary">{traduzir("Primário")}</button>
            <button type="button" className="btn acento">{traduzir("Acento")}</button>
            <button type="button" className="btn">{traduzir("Secundário")}</button>
            <button type="button" className="btn ghost">{traduzir("Fantasma")}</button>
            <button type="button" className="btn danger">{traduzir("Perigo")}</button>
            <button type="button" className="btn primary" disabled>{traduzir("Desabilitado")}</button>
          </div>
          <div className="amostra-linha">
            <button type="button" className="btn primary sm">{traduzir("Pequeno")}</button>
            <button type="button" className="btn sm">{traduzir("Pequeno")}</button>
          </div>
        </section>

        {/* ------------------------------------------------------------ campos */}
        <section className="amostra-secao">
          <h3>{traduzir("Campos")}</h3>
          <p className="amostra-nota">
            {traduzir("Fundo branco, borda perceptível em repouso. O azul aparece só no foco.")}
          </p>
          <div className="amostra-grid-2">
            <div className="field">
              <label htmlFor="a-nome">{traduzir("Nome")}</label>
              <input id="a-nome" className="input" placeholder="Clínica Aurora" />
            </div>
            <div className="field">
              <label htmlFor="a-sel">{traduzir("Etapa")}</label>
              <select id="a-sel" className="input" defaultValue="novo">
                <option value="novo">{traduzir("Novo lead")}</option>
                <option value="prop">{traduzir("Proposta")}</option>
              </select>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ abas e chips */}
        <section className="amostra-secao">
          <h3>{traduzir("Abas, chips e selos")}</h3>
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
            <span className="amostra-selo">{traduzir("Neutro")}</span>
            <span className="amostra-selo amostra-selo-acento">{traduzir("Ativo")}</span>
            <span className="amostra-selo amostra-selo-ok">{traduzir("Conectado")}</span>
            <span className="amostra-selo amostra-selo-erro">{traduzir("Perdido")}</span>
          </div>
        </section>

        {/* ------------------------------------------------------------ tipografia */}
        <section className="amostra-secao">
          <h3>{traduzir("Tipografia")}</h3>
          <div className="card amostra-tipo">
            <p className="amostra-t-page">{traduzir("Título de página")}</p>
            <p className="amostra-t-secao">{traduzir("Título de seção")}</p>
            <p className="amostra-t-card">{traduzir("Título de card")}</p>
            <p className="amostra-t-corpo">
              Corpo. É o texto que se lê de verdade, e por isso tem a medida de leitura limitada e o
              contraste mais alto do que qualquer informação de apoio.
            </p>
            <p className="amostra-t-label">{traduzir("RÓTULO")}</p>
            <p className="amostra-t-apoio">{traduzir("Texto de apoio, para explicar sem competir.")}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ mensagens */}
        <section className="amostra-secao">
          <h3>{traduzir("Conversa")}</h3>
          <p className="amostra-nota">
            {traduzir("Recebida e enviada precisam se distinguir de longe, sem duas cores quase iguais.")}
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
          <h3>{traduzir("Tabela")}</h3>
          <div className="card amostra-tabela-caixa">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{traduzir("Campanha")}</th>
                  <th>{traduzir("Investimento")}</th>
                  <th>{traduzir("Leads")}</th>
                  <th>{traduzir("Custo / lead")}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Implantes · Setembro</td><td>R$ 4.820,00</td><td>38</td><td>R$ 126,84</td></tr>
                <tr><td>Clareamento · Institucional</td><td>R$ 1.240,00</td><td>12</td><td>R$ 103,33</td></tr>
                <tr><td>{traduzir("Avaliação gratuita")}</td><td>R$ 960,00</td><td>21</td><td>R$ 45,71</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalAberto ? (
        <>
          <div className="amostra-veu" onClick={() => setModalAberto(false)} aria-hidden="true" />
          <div className="amostra-modal" role="dialog" aria-label={traduzir("Exemplo de modal")}>
            <div className="amostra-modal-h">
              <h4>{traduzir("Desconectar o Google Ads?")}</h4>
            </div>
            <div className="amostra-modal-corpo">
              <p>
                As campanhas param de aparecer na tela de Tráfego. Nenhum lead, contato ou conversa é
                apagado, e você pode reconectar quando quiser.
              </p>
            </div>
            <div className="amostra-modal-f">
              <button type="button" className="btn ghost" onClick={() => setModalAberto(false)}>
                {traduzir("Cancelar")}
              </button>
              <button type="button" className="btn danger" onClick={() => setModalAberto(false)}>
                {traduzir("Desconectar")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
