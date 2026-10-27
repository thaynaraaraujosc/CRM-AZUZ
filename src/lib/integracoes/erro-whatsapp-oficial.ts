/**
 * O erro cru da Meta traduzido pro que a pessoa precisa fazer.
 *
 * A Cloud API responde com código e uma frase em inglês escrita pra quem programa. "(#132001)
 * Template name does not exist in the translation" aparecia inteiro na tela de quem só queria
 * mandar a primeira mensagem pra um cliente: não diz o que aconteceu nem o que fazer.
 *
 * Mesma ideia de `erro-instagram.ts`, e os dois existem pelo mesmo motivo: erro que não se entende
 * vira chamado de suporte, e esse chamado chega sem a informação que resolveria.
 *
 * Puro, sem rede: é tradução de texto, e se prova sem chamar a Meta.
 */

const POR_CODIGO: { codigo: string; explicacao: string }[] = [
  {
    codigo: "132001",
    explicacao:
      "Esse modelo não existe mais nessa conta do WhatsApp, ou não está aprovado no idioma em que foi pedido. A lista foi atualizada: escolha outro, ou crie o modelo de novo no WhatsApp Manager.",
  },
  {
    codigo: "132000",
    explicacao:
      "O modelo espera outra quantidade de informações do que foi preenchido. Isso acontece quando o texto dele muda na Meta e o CRM ainda tem a versão antiga: atualize a lista e tente de novo.",
  },
  {
    codigo: "132005",
    explicacao: "O modelo foi reprovado pela Meta e não pode mais ser enviado. Crie outro no WhatsApp Manager.",
  },
  {
    codigo: "132007",
    explicacao:
      "A Meta bloqueou esse modelo por qualidade: muita gente marcou como spam ou bloqueou o número depois de recebê-lo.",
  },
  {
    codigo: "131047",
    explicacao:
      "Passaram mais de 24 horas desde a última mensagem dessa pessoa. Pra falar agora só com um modelo aprovado.",
  },
  {
    codigo: "131026",
    explicacao:
      "Esse número não recebe pelo WhatsApp: ou não tem conta, ou não aceita mensagem de empresa. Confira o número.",
  },
  {
    codigo: "131031",
    explicacao: "A conta do WhatsApp Business está suspensa pela Meta. Veja as notificações no WhatsApp Manager.",
  },
  {
    codigo: "131049",
    explicacao:
      "A Meta segurou esta mensagem pra proteger a experiência de quem recebe — ela limita quantas mensagens de marketing a mesma pessoa recebe por dia.",
  },
  {
    codigo: "133010",
    explicacao: "O número ainda não terminou o cadastro na Cloud API. Conclua a verificação no WhatsApp Manager.",
  },
  {
    codigo: "130429",
    explicacao: "Muitas mensagens em pouco tempo: a Meta pediu pra esperar. Tente de novo em alguns minutos.",
  },
];

/** A frase pronta pro erro da Meta, ou o texto original quando não há tradução conhecida. */
export function explicarErroDoWhatsApp(cru: string): string {
  const texto = (cru ?? "").trim();
  if (!texto) return "Falha ao enviar pelo WhatsApp.";

  for (const { codigo, explicacao } of POR_CODIGO) {
    if (texto.includes(codigo)) return explicacao;
  }
  return texto;
}
