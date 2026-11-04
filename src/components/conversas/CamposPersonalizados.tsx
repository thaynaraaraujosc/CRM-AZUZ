"use client";

import { useState } from "react";

import { Modal } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";
import {
  MAXIMO_DE_CAMPOS,
  ROTULO_DO_TIPO,
  novoIdDeCampo,
  type CampoDoContato,
  type TipoDeCampo,
  type ValoresDeCampos,
} from "@/lib/contatos/campos-do-contato";

/**
 * OS CAMPOS QUE A PRÓPRIA EMPRESA CRIA NO PAINEL DO CONTATO.
 *
 * A lista fixa do painel — nome, e-mail, empresa, cargo, cidade — é a que serve a todo mundo. O
 * que só serve a UM cliente não pode virar campo do produto: "paciente novo ou antigo" é inútil
 * numa oficina, "placa do veículo" é inútil numa clínica, e tentar atender os dois do jeito
 * errado dá a mesma coisa nos dois casos — um painel cheio de campos em branco.
 *
 * Então a empresa cria os seus, com o nome que quiser, e eles aparecem aqui embaixo dos fixos, na
 * mesma forma dos outros: rótulo em cima, valor embaixo, editável quando o painel está em edição.
 *
 * A DEFINIÇÃO é do workspace (todo contato passa a ter o campo); o VALOR é de cada contato.
 * Apagar um campo some com ele de todos os contatos de uma vez, e é por isso que apagar pede
 * confirmação dentro do próprio botão em vez de sumir no primeiro clique.
 */
export function CamposPersonalizados({
  campos,
  valores,
  editando,
  salvandoDefinicoes,
  onMudarValor,
  onSalvarDefinicoes,
}: {
  campos: CampoDoContato[];
  valores: ValoresDeCampos;
  editando: boolean;
  salvandoDefinicoes: boolean;
  onMudarValor: (id: string, valor: string) => void;
  /** Recebe a lista inteira: criar, apagar e renomear são a mesma gravação. */
  onSalvarDefinicoes: (campos: CampoDoContato[]) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [criando, setCriando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  function criar(campo: CampoDoContato) {
    onSalvarDefinicoes([...campos, campo]);
    setCriando(false);
  }

  function excluir(id: string) {
    onSalvarDefinicoes(campos.filter((c) => c.id !== id));
    setConfirmandoExclusao(null);
  }

  return (
    <>
      {campos.map((campo) => (
        <div className="field" key={campo.id}>
          <label className="cpers-rotulo">
            {campo.nome}
            {editando ? (
              confirmandoExclusao === campo.id ? (
                <span className="cpers-confirma">
                  {traduzir("Apagar de todos os contatos?")}
                  <button type="button" className="link cpers-perigo" onClick={() => excluir(campo.id)}>
                    {traduzir("Apagar")}
                  </button>
                  <button type="button" className="link" onClick={() => setConfirmandoExclusao(null)}>
                    {traduzir("Não")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="link cpers-apagar"
                  onClick={() => setConfirmandoExclusao(campo.id)}
                  disabled={salvandoDefinicoes}
                >
                  {traduzir("Apagar campo")}
                </button>
              )
            ) : null}
          </label>
          {!editando ? (
            <div className="input">{valores[campo.id] || traduzir("Não informado")}</div>
          ) : campo.tipo === "escolha" ? (
            <select
              className="input"
              style={{ width: "100%", cursor: "pointer" }}
              value={valores[campo.id] ?? ""}
              onChange={(e) => onMudarValor(campo.id, e.target.value)}
            >
              <option value="">{traduzir("Não informado")}</option>
              {(campo.opcoes ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              style={{ width: "100%" }}
              type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
              value={valores[campo.id] ?? ""}
              onChange={(e) => onMudarValor(campo.id, e.target.value)}
            />
          )}
        </div>
      ))}

      {campos.length >= MAXIMO_DE_CAMPOS ? (
        <p className="hint">
          {traduzir("Você chegou ao limite de {n} campos.", { n: String(MAXIMO_DE_CAMPOS) })}
        </p>
      ) : (
        <button
          type="button"
          className="btn ghost cpers-criar"
          onClick={() => setCriando(true)}
          disabled={salvandoDefinicoes}
        >
          + {traduzir("Criar campo")}
        </button>
      )}

      <DialogoNovoCampo
        aberto={criando}
        existentes={campos}
        onFechar={() => setCriando(false)}
        onCriar={criar}
      />
    </>
  );
}

/**
 * A caixinha de criar campo.
 *
 * Três perguntas e pronto: como se chama, de que tipo é, e — só quando é lista — quais são as
 * opções. Tipo importa porque é o que decide o teclado do celular e o seletor: "valor da consulta"
 * digitado num campo de texto aceita "mil reais", e aí nenhum relatório soma aquilo um dia.
 */
function DialogoNovoCampo({
  aberto,
  existentes,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  existentes: CampoDoContato[];
  onFechar: () => void;
  onCriar: (campo: CampoDoContato) => void;
}) {
  const { t: traduzir } = useIdioma();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeCampo>("texto");
  const [opcoes, setOpcoes] = useState("");

  function fechar() {
    setNome("");
    setTipo("texto");
    setOpcoes("");
    onFechar();
  }

  const nomeLimpo = nome.trim();
  const listaOpcoes = opcoes
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const repetido = existentes.some((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase());
  const podeCriar =
    nomeLimpo.length >= 2 && !repetido && (tipo !== "escolha" || listaOpcoes.length >= 2);

  function criar() {
    if (!podeCriar) return;
    onCriar({
      id: novoIdDeCampo(existentes),
      nome: nomeLimpo.slice(0, 60),
      tipo,
      ...(tipo === "escolha" ? { opcoes: listaOpcoes } : {}),
    });
    setNome("");
    setTipo("texto");
    setOpcoes("");
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={fechar}
      titulo={traduzir("Criar campo")}
      largura={420}
      rodape={
        <>
          <button type="button" className="btn ghost" onClick={fechar}>
            {traduzir("Cancelar")}
          </button>
          <button type="button" className="btn primary" onClick={criar} disabled={!podeCriar}>
            {traduzir("Criar campo")}
          </button>
        </>
      }
    >
      <div className="field">
        <label>{traduzir("Nome do campo")}</label>
        <input
          className="input"
          style={{ width: "100%" }}
          value={nome}
          autoFocus
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          placeholder={traduzir("Ex.: Origem do paciente")}
        />
        {repetido ? (
          <span className="wa-campo-erro">{traduzir("Já existe um campo com esse nome.")}</span>
        ) : null}
      </div>

      <div className="field">
        <label>{traduzir("Tipo")}</label>
        <select
          className="input"
          style={{ width: "100%", cursor: "pointer" }}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDeCampo)}
        >
          {(Object.keys(ROTULO_DO_TIPO) as TipoDeCampo[]).map((t) => (
            <option key={t} value={t}>
              {traduzir(ROTULO_DO_TIPO[t])}
            </option>
          ))}
        </select>
      </div>

      {tipo === "escolha" ? (
        <div className="field">
          <label>{traduzir("Opções, uma por linha")}</label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 96, resize: "vertical" }}
            value={opcoes}
            onChange={(e) => setOpcoes(e.target.value)}
            placeholder={"Novo\nAntigo"}
          />
          {listaOpcoes.length < 2 ? (
            <span className="hint">{traduzir("Escreva pelo menos duas opções.")}</span>
          ) : null}
        </div>
      ) : null}

      <p className="hint">
        {traduzir(
          "O campo passa a existir em todos os contatos da empresa. O valor é de cada um.",
        )}
      </p>
    </Modal>
  );
}
