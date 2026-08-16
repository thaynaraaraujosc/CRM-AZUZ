/** Descrição legível de dispositivo/navegador a partir do User-Agent real da requisição de login —
 * sem depender de biblioteca externa (parser leve, cobre os casos comuns). Usado só pra exibição em
 * Configurações > Segurança > Sessões ativas, não pra nenhuma decisão de segurança. */
export function descreverDispositivo(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconhecido";

  let navegador = "Navegador desconhecido";
  if (/Edg\//.test(userAgent)) navegador = "Edge";
  else if (/OPR\//.test(userAgent)) navegador = "Opera";
  else if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) navegador = "Chrome";
  else if (/Firefox\//.test(userAgent)) navegador = "Firefox";
  else if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) navegador = "Safari";

  let sistema = "";
  if (/iPhone/.test(userAgent)) sistema = "iPhone";
  else if (/iPad/.test(userAgent)) sistema = "iPad";
  else if (/Android/.test(userAgent)) sistema = "Android";
  else if (/Mac OS X/.test(userAgent)) sistema = "macOS";
  else if (/Windows/.test(userAgent)) sistema = "Windows";
  else if (/Linux/.test(userAgent)) sistema = "Linux";

  return sistema ? `${navegador} · ${sistema}` : navegador;
}

/** IP real do cliente — atrás de proxy (Railway/Vercel), o primeiro valor de `x-forwarded-for` é
 * quem originou a requisição. */
export function capturarIp(request: Request): string | null {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
