/** Catálogo de planos do CRM — fonte única usada tanto pela tela (Plano e cobrança) quanto pelas
 * rotas de API que criam a assinatura na Asaas, pra nunca cobrar um valor diferente do exibido.
 *
 * Plano único (item 5 do pedido): só existe "completo", cobrindo o CRM inteiro — sem Essencial/
 * Escala. `PlanoId` fica com um só valor de propósito (em vez de virar `"completo"` sozinho como
 * string literal solta) pra todo o resto do código que já usa `PlanoId`/`PLANOS[id]` continuar
 * funcionando sem precisar reescrever a forma dos dados. */
export type PlanoId = "completo";

export const PLANOS: Record<PlanoId, { nome: string; valor: number; recursos: string[] }> = {
  completo: {
    nome: "Completo",
    // TODO: valor de teste — voltar pra 249.9 antes de divulgar o cadastro (ver commit que
    // baixou isso pra R$ 5 só pra testar o pagamento de ponta a ponta na Asaas produção).
    valor: 5,
    recursos: ["Funis ilimitados", "WhatsApp/Instagram/TikTok", "Automações", "Azuz IA", "Usuários ilimitados"],
  },
};

export function ehPlanoValido(valor: string): valor is PlanoId {
  return valor in PLANOS;
}
