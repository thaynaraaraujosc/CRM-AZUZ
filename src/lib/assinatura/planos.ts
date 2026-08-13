/** Catálogo de planos do CRM — fonte única usada tanto pela tela (Plano e cobrança) quanto pelas
 * rotas de API que criam a assinatura na Asaas, pra nunca cobrar um valor diferente do exibido. */
export type PlanoId = "essencial" | "completo" | "escala";

export const PLANOS: Record<PlanoId, { nome: string; valor: number; recursos: string[] }> = {
  essencial: { nome: "Essencial", valor: 99, recursos: ["1 funil", "WhatsApp", "Até 3 usuários"] },
  completo: {
    nome: "Completo",
    valor: 249,
    recursos: ["Funis ilimitados", "WhatsApp/Instagram/TikTok", "Automações", "Azuz IA", "Até 10 usuários"],
  },
  escala: {
    nome: "Escala",
    valor: 449,
    recursos: ["Tudo do Completo", "Usuários ilimitados", "Prioridade no suporte", "Auditoria avançada"],
  },
};

export function ehPlanoValido(valor: string): valor is PlanoId {
  return valor in PLANOS;
}
