import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * APAGAR UMA CONVERSA APAGA A PESSOA INTEIRA DO CRM.
 *
 * "Quando eu apagar as mensagens do chat tem que apagar daqui do funil — tudo é interligado." E,
 * logo depois: "o contato também tem que apagar."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * POR QUE UM TESTE QUE LÊ O CÓDIGO-FONTE, e não um que roda a rota.
 *
 * A rota é quatro `deleteMany` numa transação: não há regra pra provar, há uma LISTA pra não
 * encolher. E listas assim encolhem em refatoração — alguém reescreve a transação, esquece uma
 * linha, e o resultado não quebra teste nenhum: a conversa some, o card fica, e o defeito só
 * aparece semanas depois, quando o funil tem vinte e oito cartões de telefone sem nome prometendo
 * conversas que não existem mais. Foi exatamente assim que ele apareceu da primeira vez.
 *
 * Provar com banco de verdade custaria um banco de verdade; provar com Prisma simulado provaria
 * que o simulacro foi chamado. Este fio é mais barato que os dois e pega a regressão que importa.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * E O QUE ISTO NÃO PROVA, dito pra ninguém confiar demais: que a ordem está certa, que a
 * transação existe, que os `where` apontam pro workspace certo. Isso é leitura de código e
 * revisão — aqui só mora "as quatro continuam lá".
 */

const ROTA = join(process.cwd(), "src/app/api/conversas/[id]/route.ts");
const TELA = join(process.cwd(), "src/app/(app)/conversas/page.tsx");

describe("a rota que apaga a conversa", () => {
  const fonte = readFileSync(ROTA, "utf-8");
  const transacao = fonte.slice(fonte.indexOf("await prisma.$transaction(["));

  it("apaga as mensagens dela", () => {
    // Casadas pelo NOME (`MensagemExtra.contato`), não por chave estrangeira: sem isto elas ficam
    // órfãs no banco, invisíveis e ocupando espaço pra sempre.
    expect(transacao).toMatch(/mensagemExtra\.deleteMany/);
  });

  it("apaga o card do funil", () => {
    /*
     * O defeito original. A conversa saía e o negócio ficava: a caixa de entrada esvaziava e o
     * funil continuava com as mesmas pessoas, cada cartão com um botão "chat" que abre o nada.
     */
    expect(transacao).toMatch(/negocioCard\.deleteMany/);
  });

  it("apaga o contato", () => {
    /*
     * Eu tinha deixado o contato de fora, argumentando que a agenda é patrimônio da empresa. Ela
     * decidiu o contrário. Meia limpeza é pior que nenhuma: quem apaga pra limpar reencontra a
     * mesma pessoa na tela seguinte e apaga de novo, agora em dois lugares.
     */
    expect(transacao).toMatch(/contato\.deleteMany/);
  });

  it("apaga a conversa", () => {
    expect(transacao).toMatch(/conversa\.delete/);
  });

  it("tudo numa transação só", () => {
    // Quatro apagados soltos deixam a pessoa pela metade quando um falha — e "pela metade" aqui é
    // o card sem conversa, que é o estado que deu origem a tudo isto.
    expect(fonte).toContain("prisma.$transaction([");
  });
});

describe("o aviso na tela", () => {
  const fonte = readFileSync(TELA, "utf-8");

  it("diz as quatro coisas que somem, e que Tráfego sente", () => {
    /*
     * Apagar o contato leva junto, por cascata do banco, a origem do lead e a trilha de anúncio —
     * que é o que Tráfego soma pra dizer "custo por lead". Os números de meses passados mudam.
     * Não é defeito; é o preço de apagar de verdade, e quem aperta o botão tem que saber antes.
     */
    const aviso = fonte.slice(fonte.indexOf("Excluir a conversa com {nome}"), fonte.indexOf("Excluir a conversa com {nome}") + 300);
    for (const parte of ["mensagens", "funil", "contato", "Tráfego"]) {
      expect(aviso).toContain(parte);
    }
    expect(aviso).toMatch(/Não dá pra desfazer/);
  });
});
