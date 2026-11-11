"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CamposPersonalizados } from "@/components/conversas/CamposPersonalizados";
import { QUALIFICACOES } from "@/lib/contatos/qualificacao";
import { IconCheck, IconClose, IconEdit } from "@/components/icons";
import { nomeAindaEhIdCru, nomeExibido } from "@/lib/conversas/exibicao";
import {
  lerCamposDoContato,
  lerValoresDeCampos,
  type CampoDoContato,
  type ValoresDeCampos,
} from "@/lib/contatos/campos-do-contato";
import { tempoDeRelacionamento } from "@/lib/contatos/relacionamento";
import { formatarTelefoneParaExibicao } from "@/lib/telefone";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useIdioma } from "@/lib/idioma-context";
import type { Canal } from "@/lib/data";

/**
 * OS DADOS DO CONTATO — UM SÓ, pra tela do WhatsApp e pra do funil.
 *
 * Eram duas. A do WhatsApp tinha treze campos, os campos que a empresa cria, etiquetas e a caixa
 * pra dar nome a um número; a do funil tinha quatro campos e um botão de salvar. Mesmo contato,
 * mesma tabela, telas diferentes — então preencher "cargo" numa e abrir a outra dava a impressão
 * de que o CRM tinha perdido o dado. Não tinha: ele só não era mostrado ali.
 *
 * Duas telas pro mesmo registro é uma promessa que não se cumpre: toda vez que uma ganha um campo,
 * alguém precisa lembrar da outra, e um mês depois elas divergem de novo. Agora é um componente,
 * usado nos dois lugares. O que mudar aqui muda nos dois, por construção, não por disciplina.
 *
 * ELE SE VIRA SOZINHO: recebe o nome da conversa e o canal, e vai buscar o resto (a agenda, os
 * campos da empresa) nos contextos. É o que permite as duas telas usarem-no com uma linha.
 *
 * A TROCA DE CONTATO é resolvida com `key={nome}` em quem o usa: remontar zera o rascunho de
 * edição de uma vez, sem uma lista de `setX(contato?.y ?? "")` que envelhece a cada campo novo.
 */
export function DadosDoContato({
  nome,
  canal,
  aoRegistrarNoHistorico,
}: {
  /** O nome da conversa aberta. É por ele que o contato é encontrado na agenda. */
  nome: string;
  canal?: string | null;
  /** Anota o que aconteceu na linha do tempo da tela que hospeda o painel. Opcional: o funil
   *  ainda não tem uma. */
  aoRegistrarNoHistorico?: (texto: string) => void;
}) {
  const { t: traduzir } = useIdioma();
  const {
    contatos,
    salvarDadosContato,
    adicionarEtiqueta,
    removerEtiqueta,
    recarregar: recarregarContatos,
  } = useContatos();
  const { conversas, recarregar: recarregarConversas } = useConversas();

  const contato = contatos.find((c) => c.nome === nome) ?? null;

  /*
   * O NÚMERO DA PRÓPRIA CONVERSA PREENCHE O CAMPO WHATSAPP.
   *
   * Numa conversa de WhatsApp o número é a coisa que o CRM SEMPRE sabe — é por ele que a mensagem
   * chegou. E mesmo assim a ficha mostrava "WhatsApp: —": o campo só era preenchido quando o
   * contato tinha sido criado pelo caminho do webhook com o telefone em mãos, e qualquer contato
   * que já existisse por outro caminho (cadastrado à mão, vindo de formulário, casado pelo nome)
   * ficava sem. Perguntar o telefone de quem está falando com você pelo telefone é o tipo de coisa
   * que faz o CRM parecer que não presta atenção.
   *
   * Vale só pra pessoa: `contato` de grupo é o id do grupo (`…@g.us`), que não é telefone de
   * ninguém — e já virou "+120363422457482263" na tela uma vez.
   */
  const conversa = conversas.find((c) => c.nome === nome) ?? null;
  const telefoneDaConversa =
    conversa && !conversa.ehGrupo && conversa.contato && !conversa.contato.includes("@g.us")
      ? formatarTelefoneParaExibicao(conversa.contato) ?? ""
      : "";

  const [emailContato, setEmailContato] = useState(contato?.email ?? "");
  const [whatsappContato, setWhatsappContato] = useState(contato?.whatsapp ?? telefoneDaConversa);
  /*
   * A LISTA DE CONVERSAS CHEGA DEPOIS DO PRIMEIRO DESENHO.
   *
   * O valor inicial do `useState` acima é lido uma vez, e nesse instante a lista ainda pode estar
   * vazia (ela é buscada por fetch). Sem este ajuste, o número só apareceria em quem abrisse a
   * ficha pela segunda vez. É o padrão de "ajustar estado durante o render" do próprio React —
   * comparar com o último valor visto e corrigir —, que não custa um ciclo de efeito a mais.
   *
   * Só preenche o que está VAZIO: número digitado à mão nunca é sobrescrito pelo da conversa.
   */
  const [telefoneVisto, setTelefoneVisto] = useState(telefoneDaConversa);
  if (telefoneDaConversa !== telefoneVisto) {
    setTelefoneVisto(telefoneDaConversa);
    if (!whatsappContato.trim() && telefoneDaConversa) setWhatsappContato(telefoneDaConversa);
  }
  const [nascimentoContato, setNascimentoContato] = useState(contato?.nascimento ?? "");
  const [enderecoContato, setEnderecoContato] = useState(contato?.endereco ?? "");
  const [sobrenomeContato, setSobrenomeContato] = useState(contato?.sobrenome ?? "");
  const [empresaContato, setEmpresaContato] = useState(contato?.empresa ?? "");
  const [cargoContato, setCargoContato] = useState(contato?.cargo ?? "");
  const [cidadeContato, setCidadeContato] = useState(contato?.cidade ?? "");
  const [estadoContato, setEstadoContato] = useState(contato?.estado ?? "");
  const [paisContato, setPaisContato] = useState(contato?.pais ?? "");
  const [canalPreferidoContato, setCanalPreferidoContato] = useState<Canal>(
    contato?.canalPreferido ?? ((canal as Canal) || "WhatsApp"),
  );
  const [melhorHorarioContato, setMelhorHorarioContato] = useState(contato?.melhorHorario ?? "");
  const [editandoContato, setEditandoContato] = useState(false);
  const [statusSalvarContato, setStatusSalvarContato] = useState<
    "ocioso" | "salvando" | "sucesso" | "erro"
  >("ocioso");
  const [novaEtiquetaTexto, setNovaEtiquetaTexto] = useState("");

  /*
   * OS CAMPOS QUE A EMPRESA CRIOU: a DEFINIÇÃO é do workspace, o VALOR é deste contato.
   *
   * A lista é buscada uma vez e serve a qualquer contato; os valores vêm do contato aberto.
   */
  const [camposDoContato, setCamposDoContato] = useState<CampoDoContato[]>([]);
  const [salvandoCamposDefs, setSalvandoCamposDefs] = useState(false);
  const [valoresCampos, setValoresCampos] = useState<ValoresDeCampos>({});
  const [origemDosValoresDeCampos, setOrigemDosValoresDeCampos] = useState("");

  const [nomeParaONumero, setNomeParaONumero] = useState("");
  const [statusNomearNumero, setStatusNomearNumero] = useState<"ocioso" | "salvando" | "erro">(
    "ocioso",
  );
  const [erroNomearNumero, setErroNomearNumero] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/contatos/campos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => {
        if (vivo) setCamposDoContato(lerCamposDoContato(dados));
      })
      .catch(() => {
        /* Sem campos personalizados o painel segue inteiro: só mostra os fixos. */
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
   * OS VALORES SEGUEM O CONTATO — menos enquanto alguém está digitando.
   *
   * Duas coisas trazem valor novo: a lista de campos terminar de carregar (ela chega depois da
   * primeira pintura) e o contato ser salvo. Uma CHAVE junta as duas, e o ajuste é feito durante
   * a renderização — que é o padrão do React pra estado derivado de prop, e evita o render a mais
   * que um `useEffect` com `setState` custaria.
   *
   * A guarda do modo de edição impede o caso feio: a agenda se atualizar no meio do
   * preenchimento e apagar o que a pessoa acabou de escrever.
   */
  const chaveDosValoresDeCampos = `${JSON.stringify(contato?.camposExtras ?? {})}|${camposDoContato
    .map((c) => c.id)
    .join(",")}`;
  if (!editandoContato && chaveDosValoresDeCampos !== origemDosValoresDeCampos) {
    setOrigemDosValoresDeCampos(chaveDosValoresDeCampos);
    setValoresCampos(lerValoresDeCampos(contato?.camposExtras, camposDoContato));
  }

  function emailValido(valor: string) {
    return valor.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  async function salvarDados() {
    if (!emailValido(emailContato)) {
      setStatusSalvarContato("erro");
      return;
    }
    setStatusSalvarContato("salvando");
    try {
      // `salvarDadosContato` já persiste de verdade (ver contatos-context.tsx): a espera aqui é só
      // pra dar a sensação de salvamento antes de o formulário fechar.
      await new Promise((resolve) => setTimeout(resolve, 450));
      salvarDadosContato(nome, {
        email: emailContato.trim() || undefined,
        whatsapp: whatsappContato.trim() || undefined,
        nascimento: nascimentoContato.trim() || undefined,
        endereco: enderecoContato.trim() || undefined,
        sobrenome: sobrenomeContato.trim() || undefined,
        empresa: empresaContato.trim() || undefined,
        cargo: cargoContato.trim() || undefined,
        cidade: cidadeContato.trim() || undefined,
        estado: estadoContato.trim() || undefined,
        pais: paisContato.trim() || undefined,
        canalPreferido: canalPreferidoContato,
        melhorHorario: melhorHorarioContato.trim() || undefined,
        /*
         * Vai SEMPRE, mesmo vazio — ao contrário dos de cima, que viram `undefined` e são
         * ignorados pelo servidor. É que aqui esvaziar um campo tem significado: "apaga o que
         * estava ali". Com `undefined` o valor antigo ficaria gravado e voltaria na tela.
         */
        camposExtras: lerValoresDeCampos(valoresCampos, camposDoContato),
      });
      aoRegistrarNoHistorico?.("Dados do contato atualizados");
      setStatusSalvarContato("sucesso");
      setEditandoContato(false);
      setTimeout(() => setStatusSalvarContato("ocioso"), 2500);
    } catch {
      setStatusSalvarContato("erro");
    }
  }

  function cancelarEdicaoContato() {
    setEmailContato(contato?.email ?? "");
    setWhatsappContato(contato?.whatsapp ?? "");
    setNascimentoContato(contato?.nascimento ?? "");
    setEnderecoContato(contato?.endereco ?? "");
    setSobrenomeContato(contato?.sobrenome ?? "");
    setEmpresaContato(contato?.empresa ?? "");
    setCargoContato(contato?.cargo ?? "");
    setCidadeContato(contato?.cidade ?? "");
    setEstadoContato(contato?.estado ?? "");
    setPaisContato(contato?.pais ?? "");
    setCanalPreferidoContato(contato?.canalPreferido ?? ((canal as Canal) || "WhatsApp"));
    setMelhorHorarioContato(contato?.melhorHorario ?? "");
    setValoresCampos(lerValoresDeCampos(contato?.camposExtras, camposDoContato));
    setStatusSalvarContato("ocioso");
    setEditandoContato(false);
  }

  /**
   * Grava a lista de campos do workspace (criar e apagar passam os dois por aqui).
   *
   * A tela muda na hora e a requisição vai junto: a lista é curta e a operação é rara. Se falhar,
   * a lista volta ao que o servidor respondeu — é melhor ver o campo sumir do que achar que criou
   * e descobrir amanhã que não.
   */
  function salvarDefinicoesDeCampos(novos: CampoDoContato[]) {
    const anteriores = camposDoContato;
    setCamposDoContato(novos);
    setSalvandoCamposDefs(true);
    fetch("/api/contatos/campos", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(novos),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setCamposDoContato(lerCamposDoContato(await r.json()));
      })
      .catch(() => setCamposDoContato(anteriores))
      .finally(() => setSalvandoCamposDefs(false));
  }

  function adicionarEtiquetaRapida() {
    const etiqueta = novaEtiquetaTexto.trim();
    if (!etiqueta) return;
    adicionarEtiqueta(nome, etiqueta);
    aoRegistrarNoHistorico?.(`Etiqueta "${etiqueta}" adicionada`);
    setNovaEtiquetaTexto("");
  }

  function removerEtiquetaRapida(etiqueta: string) {
    removerEtiqueta(nome, etiqueta);
    aoRegistrarNoHistorico?.(`Etiqueta "${etiqueta}" removida`);
  }

  /**
   * Dá nome a um número que ainda não tem.
   *
   * A rota só aceita conversa cujo nome ainda é identificador cru, e por baixo é a mesma
   * transação que o webhook usa quando o @ do Instagram resolve depois: mensagens, card do funil,
   * contato e conversa mudam juntos ou não mudam.
   */
  async function nomearONumero() {
    const novo = nomeParaONumero.trim().replace(/\s+/g, " ");
    if (novo.length < 2) return;
    setStatusNomearNumero("salvando");
    setErroNomearNumero("");
    try {
      const resposta = await fetch("/api/conversas/renomear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ de: nome, para: novo }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu pra salvar o nome.");
      recarregarConversas();
      recarregarContatos();
      aoRegistrarNoHistorico?.(`Número salvo como ${novo}`);
      setNomeParaONumero("");
      setStatusNomearNumero("ocioso");
    } catch (erro) {
      setErroNomearNumero(erro instanceof Error ? erro.message : "Não deu pra salvar o nome.");
      setStatusNomearNumero("erro");
    }
  }

  /**
   * OS CAMPOS, DESCRITOS UMA VEZ SÓ.
   *
   * Eram treze blocos iguais, cada um com o seu `{editando ? <input/> : <div className="input"/>}`.
   * Treze caixas brancas de 44px empilhadas, quase todas dizendo "Não informado": a ficha ficava
   * com dois metros de altura pra mostrar, na prática, três informações.
   *
   * Descritos assim, leitura e edição saem da MESMA lista — e a leitura pode então fazer o que
   * uma ficha faz: mostrar o que existe, numa linha cada, e esconder o que está vazio atrás do
   * botão de editar. Quem quer preencher clica em "Editar" e vê tudo.
   */
  type CampoDaFicha = {
    rotulo: string;
    /** Em leitura, onde o rótulo divide a linha com o valor, um nome curto cabe melhor. */
    rotuloCurto?: string;
    valor: string;
    editor: ReactNode;
    erro?: ReactNode;
  };

  const campos: CampoDaFicha[] = [
    {
      rotulo: traduzir("Sobrenome"),
      valor: sobrenomeContato,
      editor: (
        <input
          className="input"
          value={sobrenomeContato}
          onChange={(e) => setSobrenomeContato(e.target.value)}
          placeholder={traduzir("Sobrenome do contato")}
        />
      ),
    },
    {
      rotulo: "WhatsApp",
      valor: whatsappContato,
      editor: (
        <input
          className="input"
          type="text"
          value={whatsappContato}
          onChange={(e) => setWhatsappContato(e.target.value)}
          placeholder="(00) 90000-0000"
        />
      ),
    },
    {
      rotulo: traduzir("E-mail"),
      valor: emailContato,
      editor: (
        <input
          className={`input${!emailValido(emailContato) ? " wa-input-invalido" : ""}`}
          type="email"
          value={emailContato}
          onChange={(e) => setEmailContato(e.target.value)}
          placeholder="nome@empresa.com"
        />
      ),
      erro: !emailValido(emailContato) ? (
        <span className="wa-campo-erro">{traduzir("E-mail inválido")}</span>
      ) : null,
    },
    {
      rotulo: traduzir("Aniversário"),
      valor: nascimentoContato,
      editor: (
        <input
          className="input"
          value={nascimentoContato}
          onChange={(e) => setNascimentoContato(e.target.value)}
          placeholder="DD/MM/AAAA"
        />
      ),
    },
    {
      rotulo: traduzir("Cidade / Estado / País"),
      rotuloCurto: traduzir("Cidade"),
      valor: [cidadeContato, estadoContato, paisContato].filter(Boolean).join(" · "),
      editor: (
        <div className="ficha-trio">
          <input
            className="input"
            value={cidadeContato}
            onChange={(e) => setCidadeContato(e.target.value)}
            placeholder={traduzir("Cidade")}
          />
          <input
            className="input"
            value={estadoContato}
            onChange={(e) => setEstadoContato(e.target.value)}
            placeholder="UF"
          />
          <input
            className="input"
            value={paisContato}
            onChange={(e) => setPaisContato(e.target.value)}
            placeholder={traduzir("País")}
          />
        </div>
      ),
    },
    {
      rotulo: traduzir("Endereço"),
      valor: enderecoContato,
      editor: (
        <input
          className="input"
          value={enderecoContato}
          onChange={(e) => setEnderecoContato(e.target.value)}
          placeholder={traduzir("Rua, número, bairro")}
        />
      ),
    },
    {
      rotulo: traduzir("Empresa"),
      valor: empresaContato,
      editor: (
        <input
          className="input"
          value={empresaContato}
          onChange={(e) => setEmpresaContato(e.target.value)}
          placeholder={traduzir("Nome da empresa (opcional pra B2C)")}
        />
      ),
    },
    {
      rotulo: traduzir("Cargo"),
      valor: cargoContato,
      editor: (
        <input
          className="input"
          value={cargoContato}
          onChange={(e) => setCargoContato(e.target.value)}
          placeholder={traduzir("Cargo na empresa")}
        />
      ),
    },
    {
      rotulo: traduzir("Canal preferido"),
      valor: canalPreferidoContato,
      editor: (
        <select
          className="input"
          style={{ cursor: "pointer" }}
          value={canalPreferidoContato}
          onChange={(e) => setCanalPreferidoContato(e.target.value as Canal)}
        >
          <option value="WhatsApp">WhatsApp</option>
          <option value="Instagram">Instagram</option>
        </select>
      ),
    },
    {
      rotulo: traduzir("Melhor horário pra contato"),
      rotuloCurto: traduzir("Melhor horário"),
      valor: melhorHorarioContato,
      editor: (
        <input
          className="input"
          value={melhorHorarioContato}
          onChange={(e) => setMelhorHorarioContato(e.target.value)}
          placeholder={traduzir("Ex.: Tardes, depois das 14h")}
        />
      ),
    },
  ];


  /* Há quanto tempo essa pessoa é contato nosso. O `new Date()` acontece dentro da função, e não
     aqui: ler o relógio no corpo do componente é impuro pro compilador do React. */
  const tempoDeContato = tempoDeRelacionamento(contato?.criadoEm);

  return (
    <>
      <div className="panel-h">
        <h4>{traduzir("Dados do contato")}</h4>
        {!editandoContato ? (
          <button type="button" className="btn ficha-editar" onClick={() => setEditandoContato(true)}>
            <IconEdit width={12} height={12} />
            {traduzir("Editar")}
          </button>
        ) : null}
      </div>

      {/*
        O CABEÇALHO DA FICHA: quem é, e há quanto tempo.
        
        "Cliente desde quando?" é a primeira pergunta de quem abre a ficha de alguém, e era a
        única que o painel não respondia — ele tinha treze campos de cadastro e nenhum número.
      */}
      {!editandoContato ? (
        <div className="ficha-topo">
          <strong className="ficha-nome">{nomeExibido(nome, canal)}</strong>
          <div className="ficha-chips">
            {tempoDeContato ? (
              <span className="ficha-chip">
                {traduzir("Contato há")} {tempoDeContato}
              </span>
            ) : null}
            {contato?.etapa ? <span className="ficha-chip">{contato.etapa}</span> : null}
            {contato?.origem ? <span className="ficha-chip">{contato.origem}</span> : null}
          </div>
        </div>
      ) : null}

      {/*
        O NOME, E A CAIXA PRA DAR UM quando ainda não há.
        
        Conversa de número desconhecido nasce com o telefone no lugar do nome. Quem atende
        descobre o nome na terceira linha da conversa e não tinha onde escrevê-lo. Agora escreve,
        salva, e o CRM inteiro passa a chamar a pessoa pelo nome — conversa, contato e card.
        
        Pra quem JÁ TEM nome o campo não aparece: trocar o nome de um contato existente mexeria em
        automação e filtro salvos que apontam pra ele. Isso é outra operação, e ninguém pediu.
      */}
      {nomeAindaEhIdCru(nome) ? (
        <div className="field">
          <label>{traduzir("Nome")}</label>
          <p className="wa-sem-nome">{traduzir("Este número ainda não tem nome salvo.")}</p>
          <div className="ficha-dupla">
            <input
              className="input"
              value={nomeParaONumero}
              maxLength={80}
              placeholder={traduzir("Nome de quem está falando")}
              onChange={(e) => setNomeParaONumero(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nomearONumero()}
            />
            <button
              type="button"
              className="btn primary"
              onClick={nomearONumero}
              disabled={statusNomearNumero === "salvando" || nomeParaONumero.trim().length < 2}
            >
              {statusNomearNumero === "salvando" ? traduzir("Salvando…") : traduzir("Salvar")}
            </button>
          </div>
          {erroNomearNumero ? <span className="wa-campo-erro">{erroNomearNumero}</span> : null}
        </div>
      ) : null}

      {/*
        LEITURA: UMA LINHA POR CAMPO, TODOS ELES — inclusive os vazios.
        
        Eu tinha escondido os vazios atrás de "9 campos ainda em branco", pra encurtar a ficha.
        Estava errado, e a Thaynara apontou o porquê: a ficha de um contato é um formulário de
        trabalho. Quem abre a conversa precisa VER que existe lugar pra aniversário e pra cidade —
        é isso que lembra de perguntar. Escondido, o campo deixa de existir pra quem atende, e a
        contagem "9 em branco" vira uma acusação sem utilidade nenhuma.
        
        O que resolve o tamanho é a linha ser baixa, não o campo sumir: rótulo e valor na mesma
        linha, o vazio como um traço apagado que é também o botão de preencher.
      */}
      {!editandoContato ? (
        <div className="ficha-lista">
          {campos.map((c) => (
            <button
              type="button"
              className={`ficha-linha${c.valor.trim() ? "" : " vazia"}`}
              key={c.rotulo}
              onClick={() => setEditandoContato(true)}
              title={traduzir("Editar")}
            >
              <span className="ficha-rotulo">{c.rotuloCurto ?? c.rotulo}</span>
              <span className="ficha-valor">{c.valor.trim() || "—"}</span>
            </button>
          ))}
        </div>
      ) : (
        campos.map((c) => (
          <div className="field ficha-campo" key={c.rotulo}>
            <label>{c.rotulo}</label>
            {c.editor}
            {c.erro}
          </div>
        ))
      )}

      {/*
        OS CAMPOS QUE A PRÓPRIA EMPRESA CRIOU.
        
        Vêm depois dos fixos e antes das etiquetas de propósito: os de cima são os que todo CRM
        tem, estes são os desta empresa, e etiqueta é outra coisa (marcação solta, não campo com
        valor). Ver `CamposPersonalizados.tsx`.
      */}
      <CamposPersonalizados
        campos={camposDoContato}
        valores={valoresCampos}
        editando={editandoContato}
        salvandoDefinicoes={salvandoCamposDefs}
        onMudarValor={(id, valor) => setValoresCampos((prev) => ({ ...prev, [id]: valor }))}
        onSalvarDefinicoes={salvarDefinicoesDeCampos}
      />

      {/*
        A LEITURA DE QUEM ATENDEU, num clique.
        
        "Coloca pra eu dizer se o cliente é bom, curioso — pra deixar o traqueamento mais
        inteligente, porque toda essa inteligência tem que levar a um lugar, que é retorno pros
        anúncios."
        
        É a peça que o CRM não consegue deduzir sozinho. Ele sabe o que o lead FEZ e sabe devolver
        venda ganha pro Google e pra Meta; o que ele não sabe é o que só quem conversou sabe — se
        era comprador ou alguém matando tempo.
        
        FORA DO FORMULÁRIO DE EDIÇÃO, e isso é a diferença entre ser usado e não ser: marcar
        acontece no meio da conversa, não numa visita à ficha pra "editar contato". Um clique
        grava; clicar de novo na mesma desmarca, porque errar a marcação é comum e desfazer não
        pode exigir abrir formulário.
      */}
      <div className="field">
        <label>{traduzir("Qualificação do lead")}</label>
        <div className="dc-qualificacao">
          {QUALIFICACOES.map((q) => (
            <button
              type="button"
              key={q.valor}
              className={`dc-qual-chip${contato?.qualificacao === q.valor ? ` on ${q.valor}` : ""}`}
              aria-pressed={contato?.qualificacao === q.valor}
              title={traduzir(q.descricao)}
              onClick={() => {
                const novo = contato?.qualificacao === q.valor ? "" : q.valor;
                salvarDadosContato(nome, { qualificacao: novo });
                aoRegistrarNoHistorico?.(
                  novo ? `Lead marcado como "${q.label}"` : `Qualificação do lead removida`,
                );
              }}
            >
              {traduzir(q.label)}
            </button>
          ))}
        </div>
        {contato?.qualificacao === "bom" ? (
          <p className="hint">
            {traduzir("Este é o sinal que volta pro anúncio como lead qualificado.")}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label>{traduzir("Etiquetas")}</label>
        <div className="wa-etiquetas-lista">
          {(contato?.etiquetas ?? []).length === 0 ? (
            <span className="hint">{traduzir("Nenhuma etiqueta ainda.")}</span>
          ) : (
            (contato?.etiquetas ?? []).map((et) => (
              <span className="wa-etiqueta-chip" key={et}>
                {et}
                <button
                  type="button"
                  aria-label={`Remover etiqueta ${et}`}
                  onClick={() => removerEtiquetaRapida(et)}
                >
                  <IconClose width={10} height={10} />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="ficha-dupla ficha-etiqueta-nova">
          <input
            className="input"
            placeholder={traduzir("Nova etiqueta…")}
            value={novaEtiquetaTexto}
            onChange={(e) => setNovaEtiquetaTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarEtiquetaRapida()}
          />
          <button
            type="button"
            className="btn"
            onClick={adicionarEtiquetaRapida}
            disabled={!novaEtiquetaTexto.trim()}
          >
            + {traduzir("Adicionar")}
          </button>
        </div>
      </div>

      {editandoContato ? (
        <div className="section-foot">
          <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={cancelarEdicaoContato}>
            {traduzir("Cancelar")}
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            onClick={salvarDados}
            disabled={statusSalvarContato === "salvando" || !emailValido(emailContato)}
          >
            {statusSalvarContato === "salvando" ? traduzir("Salvando…") : traduzir("Salvar")}
          </button>
        </div>
      ) : null}
      {statusSalvarContato === "sucesso" ? (
        <p className="wa-status-inline wa-status-sucesso">
          <IconCheck width={13} height={13} /> {traduzir("Dados salvos")}
        </p>
      ) : statusSalvarContato === "erro" ? (
        <p className="wa-status-inline wa-status-erro">
          <IconClose width={13} height={13} /> {traduzir("Não deu pra salvar: confira o e-mail")}
        </p>
      ) : null}
    </>
  );
}
