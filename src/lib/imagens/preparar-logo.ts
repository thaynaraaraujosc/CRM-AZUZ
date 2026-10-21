import { LIMITE_DA_LOGO, LOGO_AREA, LOGO_DENSIDADE, tamanhoDaLogo } from "@/lib/imagens/tamanho-da-logo";

/**
 * Prepara a logo NO NAVEGADOR, antes de mandar pro servidor.
 *
 * Por que aqui e não no servidor: o arquivo que a pessoa escolhe costuma ter 2 MB e 2000 px de
 * largura pra ocupar 32 px de tela. Reduzir antes de subir poupa a viagem inteira — e o que chega
 * ao banco é a imagem do tamanho em que ela será vista, não um original que ninguém vai usar.
 *
 * PNG, sempre: a logo da agência quase sempre tem fundo transparente, e JPEG não tem transparência
 * (o fundo viraria um quadrado branco dentro do quadradinho escuro do menu).
 */
export async function prepararLogoDaEmpresa(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem (PNG, JPG ou SVG).");
  }

  const bitmap = await criarBitmap(arquivo);
  const original = medir(bitmap);
  const { largura, altura } = tamanhoDaLogo(original.largura, original.altura);

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("Não deu pra preparar essa imagem neste navegador.");
  // `imageSmoothingQuality` é o que separa uma redução nítida de uma borrada quando a imagem
  // original é muito maior que o destino, que é o caso normal aqui.
  pincel.imageSmoothingEnabled = true;
  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(bitmap, 0, 0, largura, altura);

  const dataUrl = tela.toDataURL("image/png");
  if (dataUrl.length > LIMITE_DA_LOGO) {
    throw new Error("Essa imagem ficou grande demais mesmo depois de reduzida. Tente um arquivo mais simples.");
  }
  return dataUrl;
}

/**
 * As dimensões de origem.
 *
 * SVG sem `width`/`height` no próprio arquivo carrega com 0 em alguns navegadores, e 0 faria a
 * conta de escala devolver `NaN` — a logo sumiria sem erro nenhum. Nesse caso vale o tamanho do
 * espaço em alta densidade, que é o maior que a imagem precisaria ter.
 */
function medir(bitmap: ImageBitmap | HTMLImageElement): { largura: number; altura: number } {
  const largura = "naturalWidth" in bitmap ? bitmap.naturalWidth || bitmap.width : bitmap.width;
  const altura = "naturalHeight" in bitmap ? bitmap.naturalHeight || bitmap.height : bitmap.height;
  if (largura > 0 && altura > 0) return { largura, altura };
  return { largura: LOGO_AREA.largura * LOGO_DENSIDADE, altura: LOGO_AREA.altura * LOGO_DENSIDADE };
}

/**
 * O bitmap da imagem.
 *
 * `createImageBitmap` é o caminho rápido e existe em todo navegador atual, mas NÃO lê SVG em parte
 * deles — e logo de agência costuma ser SVG. O `<img>` lê, então ele é a reserva em vez de uma
 * mensagem de erro para o formato mais provável.
 */
async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function" && arquivo.type !== "image/svg+xml") {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      // Cai pro `<img>` abaixo.
    }
  }

  const endereco = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((resolver, recusar) => {
      const imagem = new Image();
      imagem.onload = () => resolver(imagem);
      imagem.onerror = () => recusar(new Error("Não deu pra abrir essa imagem. Tente outro arquivo."));
      imagem.src = endereco;
    });
  } finally {
    URL.revokeObjectURL(endereco);
  }
}
