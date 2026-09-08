import { prisma } from "@/lib/prisma";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { anotarNaLinhaDoTempo } from "@/lib/integracoes/instagram-eventos";

/**
 * O que uma automação consegue FAZER no mundo — separado de QUANDO fazer (o motor).
 *
 * A separação existe por um motivo prático: o botão "Testar" precisa percorrer exatamente o mesmo
 * fluxo, tomar exatamente as mesmas decisões, e **não** mandar mensagem pra ninguém nem mexer no
 * funil. Com as ações atrás de uma interface, o simulador troca a implementação e ganha uma
 * simulação que é o comportamento real — não uma aproximação escrita à parte, que foi o que o
 * simulador antigo era (e que por isso divergia do que acontecia de verdade).
 *
 * Toda ação devolve `{ ok, detalhe, erroTecnico? }` em vez de estourar: uma automação de sete
 * passos não pode morrer inteira porque o Instagram caiu no terceiro. O motor registra a falha
 * naquele nó e decide se segue.
 */
export type ResultadoAcao = {
  ok: boolean;
  /** O que a pessoa lê no histórico ("Mensagem enviada", "Template não aprovado"). */
  detalhe: string;
  /** Detalhe pra investigação: código da Meta, corpo do erro. Nunca credencial. */
  erroTecnico?: string;
};

const ok = (detalhe: string): ResultadoAcao => ({ ok: true, detalhe });
const falha = (detalhe: string, erroTecnico?: string): ResultadoAcao => ({ ok: false, detalhe, erroTecnico });

export type AcoesDoMotor = {
  /** Envia texto pelo canal da conversa daquele contato. */
  enviarTexto: (params: { contatoNome: string; texto: string; canal?: string }) => Promise<ResultadoAcao>;
  /** Grava campos no contato (etiquetas, responsável, campo personalizado, valor…). */
  salvarContato: (params: { contatoNome: string; dados: Record<string, unknown> }) => Promise<ResultadoAcao>;
  /** Move (ou cria) o card do contato numa etapa do funil. */
  moverEtapa: (params: { contatoNome: string; funilId: string; etapaTitulo: string }) => Promise<ResultadoAcao>;
  /** Responde o comentário do Instagram que disparou o fluxo, quando foi um. */
  responderComentario: (texto: string) => Promise<ResultadoAcao>;
  /** Anota no histórico do lead. */
  anotar: (params: { contatoNome: string; canal: string; tipo: string; descricao: string; dados?: Record<string, unknown> }) => Promise<void>;
};

/** As ações de verdade: gravam no banco e falam com os canais. */
export function acoesReais(params: {
  workspaceId: string;
  /** Só existe quando o fluxo foi disparado por um comentário. */
  responderComentario?: (texto: string) => Promise<void>;
}): AcoesDoMotor {
  const { workspaceId } = params;
  return {
    async enviarTexto({ contatoNome, texto }) {
      if (!texto.trim()) return falha("Mensagem vazia — nada foi enviado.");
      try {
        const r = await enviarTextoPeloCanal({ workspaceId, conversaNome: contatoNome, texto });
        return r.enviado ? ok(`Mensagem enviada: "${resumir(texto)}"`) : falha(`Não foi possível enviar: ${r.motivo ?? "motivo desconhecido"}`);
      } catch (erro) {
        return falha("Falha ao enviar a mensagem.", mensagemDoErro(erro));
      }
    },

    async salvarContato({ contatoNome, dados }) {
      try {
        const { count } = await prisma.contato.updateMany({
          where: { workspaceId, nome: contatoNome },
          data: dados,
        });
        return count ? ok(descreverCampos(dados)) : falha(`Contato "${contatoNome}" não encontrado.`);
      } catch (erro) {
        return falha("Falha ao gravar no contato.", mensagemDoErro(erro));
      }
    },

    async moverEtapa({ contatoNome, funilId, etapaTitulo }) {
      try {
        // Filtra pelo workspace ANTES do funil: id de funil é adivinhável, e sem isto uma
        // automação poderia mover um card pra um funil de outro cliente.
        const etapa = await prisma.funilEtapa.findFirst({
          where: { titulo: etapaTitulo, funil: { id: funilId, workspaceId } },
          select: { id: true },
        });
        if (!etapa) return falha(`A etapa "${etapaTitulo}" não existe mais nesse funil.`);

        const card = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome }, select: { id: true } });
        if (card) {
          await prisma.negocioCard.update({ where: { id: card.id }, data: { etapaId: etapa.id, ordem: 0 } });
          return ok(`Movido para "${etapaTitulo}".`);
        }
        await prisma.negocioCard.create({
          data: {
            id: `${workspaceId}-${contatoNome}-${Date.now()}`,
            etapaId: etapa.id,
            ordem: 0,
            workspaceId,
            nome: contatoNome,
            valor: "—",
            origem: "Automação",
            dias: "Hoje",
            data: new Date().toISOString().slice(0, 10),
          },
        });
        return ok(`Card criado em "${etapaTitulo}".`);
      } catch (erro) {
        return falha("Falha ao mover no funil.", mensagemDoErro(erro));
      }
    },

    async responderComentario(texto) {
      // Sem comentário na origem não é erro: é o mesmo fluxo disparado por outro gatilho.
      if (!params.responderComentario) return ok("Ignorado — este disparo não veio de um comentário.");
      try {
        await params.responderComentario(texto);
        return ok(`Comentário respondido: "${resumir(texto)}"`);
      } catch (erro) {
        return falha("Falha ao responder o comentário.", mensagemDoErro(erro));
      }
    },

    async anotar({ contatoNome, canal, tipo, descricao, dados }) {
      await anotarNaLinhaDoTempo({ workspaceId, contatoNome, canal, tipo, descricao, dados });
    },
  };
}

/**
 * As ações do modo seco: registram a INTENÇÃO e não tocam em nada.
 *
 * É o que o botão "Testar" usa. O fluxo percorrido é o mesmo, as decisões são as mesmas, e no fim
 * a lista `intencoes` conta o que teria acontecido.
 */
export function acoesSecas(): AcoesDoMotor & { intencoes: string[] } {
  const intencoes: string[] = [];
  const registrar = (texto: string) => {
    intencoes.push(texto);
    return ok(`${texto} (simulado)`);
  };
  return {
    intencoes,
    async enviarTexto({ contatoNome, texto }) {
      return registrar(`Enviaria para ${contatoNome}: "${resumir(texto)}"`);
    },
    async salvarContato({ contatoNome, dados }) {
      return registrar(`Gravaria em ${contatoNome}: ${descreverCampos(dados)}`);
    },
    async moverEtapa({ contatoNome, etapaTitulo }) {
      return registrar(`Moveria ${contatoNome} para "${etapaTitulo}"`);
    },
    async responderComentario(texto) {
      return registrar(`Responderia o comentário: "${resumir(texto)}"`);
    },
    async anotar() {
      /* histórico do lead não é escrito em simulação */
    },
  };
}

function resumir(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length > 80 ? `${limpo.slice(0, 77)}…` : limpo;
}

function descreverCampos(dados: Record<string, unknown>): string {
  const partes = Object.entries(dados).map(([chave, valor]) =>
    Array.isArray(valor) ? `${chave}: ${valor.join(", ")}` : `${chave}: ${String(valor)}`,
  );
  return partes.join(" · ") || "nada a gravar";
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
