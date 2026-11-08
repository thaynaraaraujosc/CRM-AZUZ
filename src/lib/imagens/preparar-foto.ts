/**
 * A FOTO DE PERFIL, preparada no navegador antes de subir.
 *
 * Mesmo motivo da logo (ver `preparar-logo.ts`): o arquivo que sai da câmera tem 3 MB e 3000 px
 * pra aparecer num círculo de 40. O que vai pro banco é a imagem do tamanho em que ela será
 * vista.
 *
 * QUADRADA, recortada pelo centro. O avatar é um círculo em toda parte do CRM; mandar um
 * retângulo faria o navegador esticar ou cortar de um jeito diferente em cada lugar que desenha
 * o avatar. Recortar uma vez, aqui, é o que garante que a cara da pessoa fique igual no menu, na
 * conversa e na lista da equipe.
 *
 * JPEG, e não PNG: foto não tem transparência pra preservar, e em JPEG a mesma imagem ocupa uma
 * fração do espaço — o campo é um TEXT no banco, e a diferença é entre 30 KB e 400 KB por pessoa.
 */

/** O lado do quadrado gravado. 192 cobre o maior avatar do CRM (64px) em tela de alta densidade. */
export const LADO_DA_FOTO = 192;

/** O teto do que o servidor aceita, em caracteres da data URL. */
export const LIMITE_DA_FOTO = 400_000;

export async function prepararFotoDePerfil(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem (PNG ou JPG).");
  }

  const imagem = await carregar(arquivo);
  const largura = "naturalWidth" in imagem ? imagem.naturalWidth || imagem.width : imagem.width;
  const altura = "naturalHeight" in imagem ? imagem.naturalHeight || imagem.height : imagem.height;
  if (!largura || !altura) throw new Error("Não deu pra ler essa imagem. Tente outro arquivo.");

  // O maior quadrado que cabe na imagem, centralizado: é o enquadramento que as pessoas esperam
  // de um avatar, e evita a decisão de "qual pedaço cortar" numa tela de configuração.
  const lado = Math.min(largura, altura);
  const origemX = (largura - lado) / 2;
  const origemY = (altura - lado) / 2;

  const tela = document.createElement("canvas");
  tela.width = LADO_DA_FOTO;
  tela.height = LADO_DA_FOTO;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("Não deu pra preparar essa imagem neste navegador.");
  pincel.imageSmoothingEnabled = true;
  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(imagem, origemX, origemY, lado, lado, 0, 0, LADO_DA_FOTO, LADO_DA_FOTO);

  const dataUrl = tela.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > LIMITE_DA_FOTO) {
    throw new Error("Essa imagem ficou grande demais mesmo depois de reduzida. Tente outro arquivo.");
  }
  return dataUrl;
}

/** `createImageBitmap` não lê SVG em parte dos navegadores; o `<img>` lê, e é a reserva. */
async function carregar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function" && arquivo.type !== "image/svg+xml") {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      /* cai pro `<img>` */
    }
  }
  const endereco = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((resolver, recusar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => recusar(new Error("Não deu pra ler essa imagem. Tente outro arquivo."));
      img.src = endereco;
    });
  } finally {
    URL.revokeObjectURL(endereco);
  }
}
