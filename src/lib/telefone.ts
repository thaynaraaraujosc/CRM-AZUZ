import { normalizarNumeroBrasileiro } from "@/lib/integracoes/meta";

/**
 * Normaliza um telefone pra comparação/dedupe — só dígitos, mais a correção do 9º dígito do
 * celular brasileiro (`normalizarNumeroBrasileiro`). Usado em todo lugar que precisa decidir "esse
 * é o mesmo número que aquele?" (criação automática de Contato pelo webhook do WhatsApp, dedupe ao
 * salvar contato manualmente) — sem isso, `"(62) 99999-9999"` (com máscara, digitado à mão) nunca
 * bate com `"5562999999999"` (dígitos crus, vindo do webhook) mesmo sendo o mesmo número, e o CRM
 * cria um segundo Contato/Conversa "órfão" pro mesmo cliente.
 */
export function normalizarTelefoneParaComparacao(numero: string): string {
  return normalizarNumeroBrasileiro(numero.replace(/\D/g, ""));
}
